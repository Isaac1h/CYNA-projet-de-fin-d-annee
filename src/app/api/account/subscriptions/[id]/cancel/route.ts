import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/account/subscriptions/[id]/cancel
 *
 * Programme la résiliation de l'abonnement à la fin de la période payée
 * (cancel_at_period_end = true côté Stripe). L'utilisateur garde l'accès
 * jusqu'à `current_period_end`, et la résiliation est réversible via
 * /reactivate tant que la période court.
 *
 * Garde de sécurité critique :
 *
 *   On lit la ligne `public.subscriptions` filtrée par
 *   `id = <param> AND user_id = auth.uid()` AVANT tout appel Stripe.
 *   Le `stripe_subscription_id` exécuté côté Stripe vient de la BASE,
 *   jamais du body. Conséquence :
 *
 *     - Un utilisateur ne peut PAS résilier l'abonnement d'un autre,
 *       même en bricolant l'URL : la RLS `subscriptions_owner_select`
 *       filtre déjà côté Postgres ; la double vérif côté route empêche
 *       qu'un futur changement de policy ne créé une fuite.
 *     - L'identifiant Stripe ne traverse jamais le navigateur ; on ne
 *       peut pas non plus passer une `sub_*` arbitraire pour résilier
 *       à la place d'un autre.
 *
 * Pas d'écriture base ici. L'évènement Stripe `customer.subscription.
 * updated` déclenche le webhook qui appelle `upsert_subscription_from_
 * stripe` (cf. supabase/migrations/20260619100000_stripe_schema.sql).
 * La base reste source unique via Stripe ; cette route est juste un
 * trigger.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANCELLABLE_STATUSES: ReadonlySet<string> = new Set([
  'active',
  'trialing',
  'past_due',
]);

type SubRow = {
  id: string;
  user_id: string;
  stripe_subscription_id: string;
  status: string;
  cancel_at_period_end: boolean;
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'invalid subscription id' }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  // Defense-in-depth : la RLS filtre déjà mais on rend la check explicite.
  // `.eq('user_id', user.id)` empêche un éventuel bug RLS futur de laisser
  // passer une sub étrangère ; et le 404 explicite ne révèle pas l'existence
  // d'une sub appartenant à un autre.
  const { data: row, error: selectError } = await supabase
    .from('subscriptions')
    .select('id, user_id, stripe_subscription_id, status, cancel_at_period_end')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json(
      { error: `lookup failed: ${selectError.message}` },
      { status: 500 },
    );
  }
  if (!row) {
    return NextResponse.json({ error: 'subscription not found' }, { status: 404 });
  }
  const sub = row as SubRow;

  if (!CANCELLABLE_STATUSES.has(sub.status)) {
    return NextResponse.json(
      {
        error: `subscription status '${sub.status}' is not cancellable`,
        status: sub.status,
      },
      { status: 409 },
    );
  }

  if (sub.cancel_at_period_end) {
    // Déjà programmée. Idempotent : on renvoie un OK sans rappeler Stripe.
    return NextResponse.json({ ok: true, already_scheduled: true });
  }

  const stripe = getStripe();
  let updated;
  try {
    updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[account/cancel] stripe.subscriptions.update failed for ${sub.stripe_subscription_id}: ${message}`,
    );
    return NextResponse.json(
      { error: 'unable to schedule cancellation, please try again' },
      { status: 502 },
    );
  }

  // On renvoie ce que Stripe nous donne pour permettre à l'UI d'afficher
  // l'état cible immédiatement, sans attendre l'aller-retour webhook. La
  // base sera reflétée par le webhook customer.subscription.updated dans
  // les secondes qui suivent ; un refetch côté UI confirmera.
  return NextResponse.json({
    ok: true,
    cancel_at_period_end: updated.cancel_at_period_end ?? true,
    cancel_at: updated.cancel_at,
    status: updated.status,
  });
}
