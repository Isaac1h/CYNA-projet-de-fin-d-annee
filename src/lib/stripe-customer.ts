import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe-server';
import { getServiceSupabase } from '@/lib/supabase-service';

/**
 * Get-or-create idempotent du Stripe Customer pour un user.
 *
 * Extrait du /api/checkout/session/route.ts (lot Stripe initial) pour
 * être partagé entre checkout et /api/account/payment-methods.
 *
 * Idempotent :
 *   1. Lit profile.stripe_customer_id avec la session du user (RLS
 *      self-read, policy profiles_self_or_admin_read).
 *   2. Si présent → return as-is.
 *   3. Sinon → stripe.customers.create() + UPDATE profile via service_role.
 *   4. Si l'UPDATE casse sur 23505 (race condition : double-click,
 *      2 onglets, deux requêtes concurrentes ont chacune créé un
 *      customer Stripe entre temps), on re-fetch le profile pour
 *      récupérer le customer id CANONIQUE (celui qui a gagné la course)
 *      et on l'utilise. Le customer Stripe orphelin fraîchement créé
 *      est laissé dans Stripe — pas grave en test mode, négligeable en
 *      prod (à archiver dans un cron de nettoyage si besoin).
 *
 * Sécurité :
 *   - profile.id == user.id par construction (RLS self-read).
 *   - Le customer Stripe créé porte metadata.user_id = user.id pour
 *     que les webhooks puissent retrouver le user d'origine sans
 *     ré-interroger la DB.
 *   - Aucun stripe_customer_id arbitraire n'est jamais accepté du
 *     client — il est TOUJOURS lu depuis profile (via la session du
 *     user) ou créé fresh.
 */
export async function getOrCreateStripeCustomer(
  supabaseUser: SupabaseClient,
  user: { id: string; email?: string | null },
  hints?: { firstName?: string; lastName?: string; email?: string },
): Promise<string> {
  const { data: existing } = await supabaseUser
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  const existingId =
    (existing as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
  if (existingId) return existingId;

  const stripe = getStripe();
  const name =
    hints?.firstName && hints?.lastName
      ? `${hints.firstName} ${hints.lastName}`.trim()
      : undefined;

  const customer = await stripe.customers.create({
    email: hints?.email ?? user.email ?? undefined,
    name,
    metadata: { user_id: user.id },
  });
  const newCustomerId = customer.id;

  const supabaseAdmin = getServiceSupabase();
  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: newCustomerId })
    .eq('id', user.id);

  if (!updateErr) return newCustomerId;

  // 23505 = unique violation : un autre run a posé un customer_id pendant
  // qu'on créait le nôtre. On lit le canonique et on s'en sert.
  if ((updateErr as { code?: string }).code === '23505') {
    const { data: refreshed } = await supabaseUser
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();
    const canonical =
      (refreshed as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
    if (canonical) {
      console.warn(
        `[stripe-customer] race on stripe_customer_id for user ${user.id} — ` +
          `freshly-created ${newCustomerId} is orphaned, using canonical ${canonical}`,
      );
      return canonical;
    }
    // Edge case improbable : 23505 mais le row n'a pas le champ. Fall
    // through au log + retour de notre id (UPDATE devra réussir au prochain
    // round). Non-bloquant.
  }

  console.error(
    `[stripe-customer] failed to persist stripe_customer_id for user ${user.id}: ` +
      `${updateErr.message}. Using freshly-created ${newCustomerId} (will overwrite next call).`,
  );
  return newCustomerId;
}
