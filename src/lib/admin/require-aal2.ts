import 'server-only';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * Admin guard exigeant AAL2 (mot de passe + TOTP validé sur la session
 * courante) pour toutes les routes /api/admin/*.
 *
 * Contexte : le middleware sur `/admin/*` exigeait déjà AAL2 pour rendre
 * une page BO. Mais son matcher ne couvre pas `/api/admin/*`, donc un
 * admin AAL1 (mot de passe OK, TOTP pas fait) pouvait muter les données
 * via API en contournant l'UI. Ce helper ferme ce gap au niveau route.
 *
 * Ordre des checks (important pour la sémantique des messages d'erreur) :
 *
 *   1. `auth.getUser()` (round-trip Supabase Auth, valide la signature du
 *      JWT — pas `getSession()` qui lit juste le cookie).
 *      → 401 { error: 'authentication required' } sinon.
 *
 *   2. `rpc('is_admin')` = role='admin' AND is_active (côté profiles).
 *      → 403 { error: 'admin required' } sinon.
 *
 *   3. `auth.mfa.getAuthenticatorAssuranceLevel()` — vraie source de
 *      vérité du niveau d'assurance de la session (dérivé du JWT `aal`
 *      claim côté SDK).
 *      → 403 { error: 'aal2 required', step_up_path: '/admin/verify' }
 *        sinon. Le payload est machine-readable pour que l'UI (fetcher
 *        côté BO) puisse détecter et rediriger vers /admin/verify.
 *
 * Non-régression garantie pour un admin AAL2 : cette fonction renvoie
 * exactement le user et le client supabase que la route utilisait déjà
 * (ceux de `getServerSupabase()`). Aucun changement de comportement
 * fonctionnel sur les routes appelantes.
 *
 * IMPORTANT — LIMITE ASSUMÉE (voir CLAUDE.md, note F2/F3) : ce guard ne
 * protège QUE les routes /api/admin/*. Les policies RLS `*_admin_read`
 * (categories, carousel, homepage_content, admin_audit_log, prices/
 * products via colonnes admin) restent gatées par `is_admin()` seul, qui
 * ne considère PAS l'AAL. Un admin AAL1 peut donc encore LIRE ces tables
 * via supabase-js directement (pas via API). Un lot F3 (is_admin() AAL2-
 * aware côté DB) fermera ce résiduel — risque de LECTURE, pas de mutation.
 */

export type AdminGuardOk = {
  ok: true;
  supabase: SupabaseClient;
  user: User;
};

export type AdminGuardDenied = {
  ok: false;
  response: NextResponse;
};

export type AdminGuardResult = AdminGuardOk | AdminGuardDenied;

export async function requireAdminAAL2(): Promise<AdminGuardResult> {
  const supabase = getServerSupabase();

  // 1. Authentification.
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'authentication required' },
        { status: 401 },
      ),
    };
  }

  // 2. Rôle admin (via RPC pour rester cohérent avec is_admin() côté DB —
  //    même check que RLS et RPCs SECURITY DEFINER).
  const { data: isAdmin, error: roleErr } = await supabase.rpc('is_admin');
  if (roleErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `authorization check failed: ${roleErr.message}` },
        { status: 500 },
      ),
    };
  }
  if (isAdmin !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'admin required' }, { status: 403 }),
    };
  }

  // 3. AAL2 — step-up TOTP effectif sur la session courante.
  const { data: aal, error: aalErr } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `assurance level check failed: ${aalErr.message}` },
        { status: 500 },
      ),
    };
  }
  if (aal?.currentLevel !== 'aal2') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'aal2 required', step_up_path: '/admin/verify' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, supabase, user };
}
