-- Lot D — Patch sécurité critique.
--
-- Supabase configure des DEFAULT PRIVILEGES qui auto-grantent EXECUTE à
-- anon + authenticated sur toute fonction créée dans le schéma public.
-- Le `revoke all from public` du SQL D1 (20260619100000_stripe_schema)
-- n'annule pas ces grants role-specific.
--
-- Sans ce patch :
--   - un user logué peut appeler PostgREST POST /rpc/place_order_for_user
--     avec un p_user_id arbitraire et créer une commande payée sans payer,
--   - un user logué peut appeler upsert_subscription_from_stripe et se
--     mettre en status='active'.
--
-- On verrouille explicitement : EXECUTE retiré de anon + authenticated.
-- service_role (utilisé par le webhook handler avec
-- SUPABASE_SERVICE_ROLE_KEY) reste seul autorisé.
--
-- À NOTER pour le futur : tout nouvel ajout de fonction SECURITY DEFINER
-- destinée à être appelée uniquement par le serveur doit inclure le même
-- couple `grant execute ... to service_role` + `revoke execute ... from
-- anon, authenticated`, en plus du `revoke all from public`.

revoke execute on function public.place_order_for_user(
  uuid, public.order_status, text, char(3), jsonb, jsonb, text, text
) from anon, authenticated;

revoke execute on function public.upsert_subscription_from_stripe(
  uuid, text, text, uuid, uuid, public.subscription_status, integer,
  timestamptz, timestamptz, timestamptz, boolean
) from anon, authenticated;
