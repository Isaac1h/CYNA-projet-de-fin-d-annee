-- Lot Outils — Facture PDF via Stripe.
-- Ajoute orders.stripe_invoice_id pour relier directement une commande à
-- son objet Stripe Invoice (in_xxx), peuplé par le webhook au moment du
-- paiement. Permet à la route GET /api/account/orders/[id]/invoice de
-- récupérer en 1 appel Stripe au lieu de 2 (session → invoice).
--
-- Strict scope : 1 colonne + 1 index. Aucune RPC modifiée — le webhook
-- handler fait un UPDATE séparé en service_role après la RPC. Justifié :
-- modifier la signature de place_order_for_user impacterait l'idempotence
-- (récriture jsonb, tests), et l'UPDATE séparé est trivialement idempotent
-- (on écrit la même valeur sur replay).
--
-- Backward compat : la colonne est NULLABLE pour ne pas casser les ordres
-- existants. La route handler fallback sur stripe_checkout_session_id +
-- retrieve session expand=['invoice'] quand stripe_invoice_id est null.

alter table public.orders
  add column if not exists stripe_invoice_id text;

comment on column public.orders.stripe_invoice_id is
  'Stripe Invoice ID (in_xxx) créé au paiement. NULL pour les commandes
   pré-déploiement ou non payées. Peuplé par le webhook
   checkout.session.completed après place_order_for_user.';

-- Partial unique index : une invoice ne peut pas appartenir à deux
-- commandes. NULLs autorisés (pas de contrainte sur les commandes
-- antérieures à cette migration). Cohérent avec
-- orders_stripe_checkout_session_idx (migration 20260619100000).
create unique index if not exists orders_stripe_invoice_idx
  on public.orders (stripe_invoice_id)
  where stripe_invoice_id is not null;
