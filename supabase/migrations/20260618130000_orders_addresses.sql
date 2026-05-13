-- Lot C — Adresses + Commandes en base.
-- Mirrors modele-donnees-CYNA.md Domaine 1 (addresses) + Domaine 3 (orders,
-- order_items) + §4 (RLS). Strict scope: 3 tables, 1 enum, RLS, triggers
-- updated_at + single default address per user + place_order() RPC.
-- Stripe columns reserved but unused (filled at Lot D).
--
-- Prerequisites verified before apply (Lot A + Lot B):
--   public.set_updated_at()    — generic updated_at trigger function
--   public.billing_interval    — enum (monthly, annual)
--   public.price_unit          — enum (flat, per_user, per_device)
--   public.is_admin()          — RBAC helper used by RLS
--   public.profiles(id)        — owner FK target

-- ---------------------------------------------------------------------------
-- order_status enum (4 valeurs, conforme à la spec)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum ('pending', 'paid', 'cancelled', 'refunded');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- addresses — carnet d'adresses utilisateur
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  label        text        not null,
  first_name   text        not null,
  last_name    text        not null,
  line1        text        not null,
  line2        text,
  city         text        not null,
  region       text        not null,
  postal_code  text        not null,
  country      text        not null,
  phone        text        not null,
  is_default   boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists addresses_user_idx on public.addresses (user_id);

create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_enforce_default on public.addresses;
create trigger addresses_enforce_default
  before insert or update of is_default on public.addresses
  for each row
  when (new.is_default)
  execute function public.enforce_single_default_address();

alter table public.addresses enable row level security;

drop policy if exists addresses_owner_select on public.addresses;
drop policy if exists addresses_owner_insert on public.addresses;
drop policy if exists addresses_owner_update on public.addresses;
drop policy if exists addresses_owner_delete on public.addresses;

create policy addresses_owner_select on public.addresses
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy addresses_owner_insert on public.addresses
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy addresses_owner_update on public.addresses
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy addresses_owner_delete on public.addresses
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.addresses from anon;

-- ---------------------------------------------------------------------------
-- orders — en-tête de commande
--
-- L'adresse de facturation est COPIÉE FIGÉE (colonnes billing_*) au moment
-- de la commande : une modification ultérieure du carnet d'adresses ne
-- doit pas réécrire l'historique de facturation.
--
-- Stripe : colonnes nullable, vides tant que Lot D n'a pas branché Checkout.
--
-- RGPD / conservation longue durée : user_id est en ON DELETE CASCADE pour
-- le MVP — supprimer un user efface ses commandes. La vraie obligation
-- légale (factures conservées ~10 ans en France) impliquera plus tard une
-- ANONYMISATION (user_id null + nullifier billing_* / email) au lieu d'un
-- cascade. À revoir au lot RGPD / suppression de compte.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id                          uuid                primary key default gen_random_uuid(),
  user_id                     uuid                not null references public.profiles(id) on delete cascade,
  order_number                text                not null unique,
  status                      public.order_status not null default 'pending',
  email                       text                not null,
  subtotal_amount             integer             not null check (subtotal_amount >= 0),
  total_amount                integer             not null check (total_amount    >= 0),
  currency                    char(3)             not null default 'eur',

  billing_label               text,
  billing_first_name          text                not null,
  billing_last_name           text                not null,
  billing_line1               text                not null,
  billing_line2               text,
  billing_city                text                not null,
  billing_region              text,
  billing_postal_code         text                not null,
  billing_country             text                not null,
  billing_phone               text,

  stripe_payment_intent_id    text,
  stripe_checkout_session_id  text,

  created_at                  timestamptz         not null default now(),
  updated_at                  timestamptz         not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists orders_owner_select on public.orders;

create policy orders_owner_select on public.orders
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

revoke all on public.orders from anon;

-- ---------------------------------------------------------------------------
-- order_items — lignes avec snapshot figé
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id                     uuid                       primary key default gen_random_uuid(),
  order_id               uuid                       not null references public.orders(id)   on delete cascade,
  product_id             uuid                                references public.products(id) on delete set null,
  product_name_snapshot  text                       not null,
  billing_interval       public.billing_interval    not null,
  unit_type              public.price_unit          not null,
  unit_amount            integer                    not null check (unit_amount >= 0),
  quantity               integer                    not null check (quantity     > 0),
  line_total             integer                    not null check (line_total  >= 0),
  currency               char(3)                    not null default 'eur',
  created_at             timestamptz                not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists order_items_owner_select on public.order_items;

create policy order_items_owner_select on public.order_items
  for select to authenticated
  using (
    exists (
      select 1 from public.orders
       where orders.id = order_items.order_id
         and (orders.user_id = auth.uid() or public.is_admin())
    )
  );

revoke all on public.order_items from anon;

-- ---------------------------------------------------------------------------
-- place_order() — création atomique d'une commande (header + items).
--
-- SECURITY DEFINER pour bypasser RLS et écrire dans orders/order_items
-- (qui n'ont AUCUNE policy INSERT pour `authenticated` ; c'est intentionnel).
-- L'identité est forcée à auth.uid() côté serveur — le client ne peut PAS
-- créer une commande pour quelqu'un d'autre, même en bricolant les params.
--
-- order_number est GÉNÉRÉ ICI (10 hex de gen_random_uuid en majuscules,
-- préfixé 'ORD-'). Le client ne le fournit pas. La contrainte UNIQUE sur
-- order_number reste le filet de sécurité ; le risque de collision sur
-- 40 bits est ~10^-12 par insertion et la transaction rollback proprement
-- si jamais elle survient.
--
-- Recalcul COMPLET côté serveur : le client envoie unit_amount par ligne,
-- la fonction recalcule line_total = unit_amount × quantity puis
-- subtotal = total = somme des line_total. Aucune confiance au total
-- envoyé par le client. (Le contrôle d'intégrité des prix unitaires eux-
-- mêmes viendra au Lot D : recoupement contre la table prices au moment
-- du webhook Stripe `checkout.session.completed`.)
--
-- Items en jsonb pour passer une liste de longueur variable :
--   [{ product_id: uuid|null, name: text, billing_interval: text,
--      unit_type: text, unit_amount: int, quantity: int }]
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_status          public.order_status,
  p_email           text,
  p_currency        char(3),
  p_billing         jsonb,
  p_items           jsonb
)
returns table (id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_order_id     uuid;
  v_order_number text;
  v_total        integer;
begin
  if v_user_id is null then
    raise exception 'place_order: not authenticated' using errcode = '28000';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order: items must be a non-empty array' using errcode = '22023';
  end if;

  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  select coalesce(sum(
           (item ->> 'unit_amount')::integer
           * (item ->> 'quantity')::integer
         ), 0)
    into v_total
    from jsonb_array_elements(p_items) as item;

  if v_total < 0 then
    raise exception 'place_order: negative total' using errcode = '22003';
  end if;

  insert into public.orders (
    user_id, order_number, status, email,
    subtotal_amount, total_amount, currency,
    billing_label, billing_first_name, billing_last_name,
    billing_line1, billing_line2,
    billing_city, billing_region, billing_postal_code, billing_country,
    billing_phone
  ) values (
    v_user_id,
    v_order_number,
    coalesce(p_status, 'pending'),
    p_email,
    v_total,
    v_total,
    coalesce(p_currency, 'eur'),
    nullif(p_billing ->> 'label',         ''),
    p_billing ->> 'first_name',
    p_billing ->> 'last_name',
    p_billing ->> 'line1',
    nullif(p_billing ->> 'line2',         ''),
    p_billing ->> 'city',
    nullif(p_billing ->> 'region',        ''),
    p_billing ->> 'postal_code',
    p_billing ->> 'country',
    nullif(p_billing ->> 'phone',         '')
  )
  returning public.orders.id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name_snapshot,
    billing_interval, unit_type,
    unit_amount, quantity, line_total, currency
  )
  select
    v_order_id,
    nullif(item ->> 'product_id', '')::uuid,
    item ->> 'name',
    (item ->> 'billing_interval')::public.billing_interval,
    (item ->> 'unit_type')::public.price_unit,
    (item ->> 'unit_amount')::integer,
    (item ->> 'quantity')::integer,
    (item ->> 'unit_amount')::integer * (item ->> 'quantity')::integer,
    coalesce(p_currency, 'eur')
  from jsonb_array_elements(p_items) as item;

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.place_order(public.order_status, text, char(3), jsonb, jsonb) from public;
grant execute on function public.place_order(public.order_status, text, char(3), jsonb, jsonb) to authenticated;
