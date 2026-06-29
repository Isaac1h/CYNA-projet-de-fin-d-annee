import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { validateEmail } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/contact
 *
 * Soumission publique du formulaire de contact. Insère une ligne dans
 * public.contact_messages via la session anon ou authentifiée (RLS s'en
 * charge — pas de service_role ici). Le client ne lit jamais la table.
 *
 * Stratégie :
 *   1. Validation serveur (formats + longueurs + anti-spam léger). C'est
 *      la SEULE validation qui compte ; le client peut être bypassé.
 *      Les CHECK SQL ne sont qu'un filet de sécurité.
 *   2. Si une session est présente, on attache user_id = auth.uid(). Si
 *      anon, on omet complètement user_id du payload — le rôle anon n'a
 *      pas le GRANT colonne sur user_id et tenter de le poser produirait
 *      `permission denied for column user_id` au lieu d'un message clair.
 *   3. INSERT direct via le client serveur anon-keyé. La policy
 *      `contact_messages_public_insert` autorise l'insertion (with_check
 *      empêche le spoofing d'identité). Aucun SELECT n'est tenté en
 *      retour : un visiteur n'a aucun droit de lecture sur la table.
 *
 * Anti-abus minimal :
 *   - Longueurs alignées sur les CHECK SQL (rejette tout dépassement).
 *   - Plafond du nombre d'URLs dans le message (heuristique faible,
 *     mais 99% du spam évident contient > 5 liens).
 *   - Pas de Turnstile / honeypot ici ; à ajouter dans un lot dédié si
 *     on observe du trafic abusif. Le coût d'écriture reste limité par
 *     le CHECK longueur.
 */

const LIMITS = {
  name: { min: 1, max: 120 },
  email: { min: 3, max: 254 },
  subject: { min: 3, max: 200 },
  message: { min: 10, max: 5000 },
} as const;

const MAX_URLS_IN_MESSAGE = 5;
const URL_PATTERN = /\bhttps?:\/\/\S+/gi;

type ContactPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type ValidationFailure = { error: string };

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

function pickString(raw: unknown, field: keyof typeof LIMITS): string | ValidationFailure {
  if (typeof raw !== 'string') return { error: `${field} must be a string` };
  const trimmed = raw.trim();
  const { min, max } = LIMITS[field];
  if (trimmed.length < min) return { error: `${field} must be at least ${min} characters` };
  if (trimmed.length > max) return { error: `${field} must be at most ${max} characters` };
  return trimmed;
}

function validate(body: unknown): ContactPayload | ValidationFailure {
  if (!body || typeof body !== 'object') return { error: 'body must be a JSON object' };
  const b = body as Record<string, unknown>;

  const name = pickString(b.name, 'name');
  if (typeof name !== 'string') return name;

  const email = pickString(b.email, 'email');
  if (typeof email !== 'string') return email;
  if (!validateEmail(email)) return { error: 'email format is invalid' };

  const subject = pickString(b.subject, 'subject');
  if (typeof subject !== 'string') return subject;

  const message = pickString(b.message, 'message');
  if (typeof message !== 'string') return message;

  const urlCount = message.match(URL_PATTERN)?.length ?? 0;
  if (urlCount > MAX_URLS_IN_MESSAGE) {
    return { error: 'message contains too many links' };
  }

  return { name, email, subject, message };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return badRequest('invalid json');
  }

  const parsed = validate(rawBody);
  if ('error' in parsed) return badRequest(parsed.error);

  const supabase = getServerSupabase();

  // Session ? On attache user_id pour traçabilité support. Pas de session
  // → on omet la colonne ; anon n'a pas le grant et la policy l'accepte
  // (`user_id IS NULL OR user_id = auth.uid()`).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row: Record<string, string> = {
    name: parsed.name,
    email: parsed.email,
    subject: parsed.subject,
    message: parsed.message,
  };
  if (user?.id) row.user_id = user.id;

  const { error } = await supabase.from('contact_messages').insert(row);

  if (error) {
    // 42501 = insufficient_privilege (RLS/grant), 23514 = check constraint.
    // On loggue côté serveur mais on ne renvoie pas le détail au client
    // pour ne pas exposer la structure RLS.
    console.error(
      `[api/contact] insert failed: ${error.message} (code=${error.code ?? '?'})`,
    );
    return NextResponse.json(
      { error: 'unable to deliver message, please try again later' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
