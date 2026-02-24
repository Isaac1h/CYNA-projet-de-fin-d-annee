import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for server-side write paths that need to
 * bypass RLS: the Stripe webhook handler, the `profiles.stripe_customer_id`
 * UPDATE in the checkout session route (the column is not in the
 * authenticated UPDATE grant — see Lot B migration).
 *
 * `server-only` makes Next refuse to bundle this module on the client.
 * Lazy + cached so a missing env doesn't crash the build, only the first
 * actual request that tries to use it.
 *
 * Anything inside `/api/webhooks/stripe` that writes to public.orders /
 * public.order_items / public.subscriptions goes through the RPCs granted
 * to service_role (`place_order_for_user`,
 * `upsert_subscription_from_stripe`) — never raw inserts on those tables.
 */

let cached: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase service-role config missing (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
