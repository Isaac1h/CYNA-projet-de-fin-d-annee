-- Lot D — Lock down public.place_order().
--
-- Until D4 the Lot C client-facing RPC public.place_order() was the
-- creation path for the in-app "confirm payment" placeholder button.
-- After D4 the only legitimate path to create an order is the Stripe
-- webhook calling public.place_order_for_user() with service_role —
-- the client redirects to Stripe Checkout, never writes the order
-- itself.
--
-- Leaving EXECUTE on place_order() for `authenticated` would let a
-- logged-in user POST /rpc/place_order with hand-crafted items[] and
-- create a status='paid' row WITHOUT a Stripe charge. We revoke from
-- anon + authenticated. service_role + postgres (owner) keep EXECUTE
-- so the RPC remains usable for back-office scripts / integration
-- tests via the service key. Symmetric to the lockdown applied to
-- place_order_for_user and upsert_subscription_from_stripe in
-- migration 20260619100100.

revoke execute on function public.place_order(
  public.order_status, text, char(3), jsonb, jsonb
) from anon, authenticated;
