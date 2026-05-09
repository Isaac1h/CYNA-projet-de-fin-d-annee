-- Lot D — Stripe schema additions + webhook write paths.
-- Prerequisites: Lot A (prices, products), Lot B (profiles, is_admin),
-- Lot C (orders, order_items, order_status, set_updated_at, place_order).
--
-- Scope of this migration:
--   - profiles.stripe_customer_id        column
--   - prices.stripe_price_id             column
--   - subscription_status enum (8 vals, 1:1 Stripe)
--   - subscriptions table + RLS
--   - stripe_events table (webhook idempotency log)
--   - orders.stripe_checkout_session_id  partial unique index
--   - place_order_for_user() RPC (service_role only, distinct from Lot C)
--   - upsert_subscription_from_stripe() RPC (service_role only)
--
-- NOT in this migration:
--   - payment_methods table (deferred to the lot that actually surfaces
--     last4 / brand in the UI),
--   - revoke execute on place_order() from authenticated (lands at D4
--     alongside the UI bascule so Lot C still has a working order
--     creation path until then).

-- ===========================================================================
-- profiles.stripe_customer_id — pin Stripe Customer to user.
-- prices.stripe_price_id      — pin Stripe Price object (1 per row).
-- ===========================================================================
alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.prices   add column if not exists stripe_price_id    text unique;

-- ===========================================================================
-- subscription_status enum — 1:1 with Stripe's billing statuses.
-- https://docs.stripe.com/api/subscriptions/object#subscription_object-status
-- ===========================================================================
do $$ begin
  create type public.subscription_status as enum (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  );
exception when duplicate_object then null;
end $$;

-- ===========================================================================
-- subscriptions — Stripe is the source of truth; the webhook writes via
-- service_role (no client write). Reads are RLS-scoped to the owner + admin.
-- ===========================================================================
create table if not exists public.subscriptions (
  id                       uuid                       primary key default gen_random_uuid(),
  user_id                  uuid                       not null references public.profiles(id) on delete cascade,
  product_id               uuid                                references public.products(id),
  price_id                 uuid                                references public.prices(id),
  stripe_subscription_id   text                       not null unique,
  stripe_customer_id       text                       not null,
  status                   public.subscription_status not null,
  quantity                 integer                    not null default 1 check (quantity > 0),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  cancel_at_period_end     boolean                    not null default false,
  created_at               timestamptz                not null default now(),
  updated_at               timestamptz                not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions
  for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

revoke all on public.subscriptions from anon;

-- ===========================================================================
-- stripe_events — idempotency log for the webhook. No client read.
-- ===========================================================================
create table if not exists public.stripe_events (
  id            text        primary key,    -- evt_xxx (Stripe event id)
  type          text        not null,
  livemode      boolean     not null,
  received_at   timestamptz not null default now()
);

create index if not exists stripe_events_received_idx
  on public.stripe_events (received_at desc);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;

-- ===========================================================================
-- orders.stripe_checkout_session_id — partial unique index. The webhook
-- relies on this for the last line of idempotency defense.
-- ===========================================================================
create unique index if not exists orders_stripe_checkout_session_idx
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ===========================================================================
-- place_order_for_user() — webhook-callable order creation.
--
-- DISTINCT from public.place_order() (Lot C):
--   - takes p_user_id EXPLICITLY (no auth.uid() inside a webhook),
--   - takes p_stripe_checkout_session_id + p_stripe_payment_intent_id,
--   - early-returns existing row if a session id is already on file
--     (idempotency last line of defense),
--   - granted to service_role ONLY (the webhook handler is the only
--     caller; a hijacked authenticated session cannot reach it).
--
-- Total recalculated server-side (sum unit_amount × quantity). The caller
-- cannot smuggle a total — there is no p_total argument.
-- ===========================================================================
create or replace function public.place_order_for_user(
  p_user_id                       uuid,
  p_status                        public.order_status,
  p_email                         text,
  p_currency                      char(3),
  p_billing                       jsonb,
  p_items                         jsonb,
  p_stripe_checkout_session_id    text,
  p_stripe_payment_intent_id      text
)
returns table (id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_total        integer;
begin
  if p_user_id is null then
    raise exception 'place_order_for_user: p_user_id is required' using errcode = '23502';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'place_order_for_user: items must be a non-empty array' using errcode = '22023';
  end if;

  if p_stripe_checkout_session_id is not null then
    select o.id, o.order_number into v_order_id, v_order_number
      from public.orders o
     where o.stripe_checkout_session_id = p_stripe_checkout_session_id
     limit 1;
    if v_order_id is not null then
      return query select v_order_id, v_order_number;
      return;
    end if;
  end if;

  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  select coalesce(sum(
           (item ->> 'unit_amount')::integer
           * (item ->> 'quantity')::integer
         ), 0)
    into v_total
    from jsonb_array_elements(p_items) as item;

  if v_total < 0 then
    raise exception 'place_order_for_user: negative total' using errcode = '22003';
  end if;

  insert into public.orders (
    user_id, order_number, status, email,
    subtotal_amount, total_amount, currency,
    billing_label, billing_first_name, billing_last_name,
    billing_line1, billing_line2,
    billing_city, billing_region, billing_postal_code, billing_country,
    billing_phone,
    stripe_checkout_session_id, stripe_payment_intent_id
  ) values (
    p_user_id,
    v_order_number,
    coalesce(p_status, 'paid'),
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
    nullif(p_billing ->> 'phone',         ''),
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id
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

revoke all on function public.place_order_for_user(
  uuid, public.order_status, text, char(3), jsonb, jsonb, text, text
) from public;
grant execute on function public.place_order_for_user(
  uuid, public.order_status, text, char(3), jsonb, jsonb, text, text
) to service_role;

-- ===========================================================================
-- upsert_subscription_from_stripe() — webhook subscription upsert.
-- Granted to service_role only.
-- ===========================================================================
create or replace function public.upsert_subscription_from_stripe(
  p_user_id                  uuid,
  p_stripe_subscription_id   text,
  p_stripe_customer_id       text,
  p_product_id               uuid,
  p_price_id                 uuid,
  p_status                   public.subscription_status,
  p_quantity                 integer,
  p_current_period_start     timestamptz,
  p_current_period_end       timestamptz,
  p_cancel_at                timestamptz,
  p_cancel_at_period_end     boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'upsert_subscription_from_stripe: p_user_id is required' using errcode = '23502';
  end if;
  if p_stripe_subscription_id is null then
    raise exception 'upsert_subscription_from_stripe: p_stripe_subscription_id is required' using errcode = '23502';
  end if;
  if p_stripe_customer_id is null then
    raise exception 'upsert_subscription_from_stripe: p_stripe_customer_id is required' using errcode = '23502';
  end if;

  insert into public.subscriptions (
    user_id, stripe_subscription_id, stripe_customer_id, product_id, price_id,
    status, quantity, current_period_start, current_period_end, cancel_at,
    cancel_at_period_end
  ) values (
    p_user_id, p_stripe_subscription_id, p_stripe_customer_id, p_product_id, p_price_id,
    p_status, coalesce(p_quantity, 1), p_current_period_start, p_current_period_end,
    p_cancel_at, coalesce(p_cancel_at_period_end, false)
  )
  on conflict (stripe_subscription_id) do update set
    status                = excluded.status,
    quantity              = excluded.quantity,
    current_period_start  = excluded.current_period_start,
    current_period_end    = excluded.current_period_end,
    cancel_at             = excluded.cancel_at,
    cancel_at_period_end  = excluded.cancel_at_period_end,
    product_id            = coalesce(excluded.product_id, public.subscriptions.product_id),
    price_id              = coalesce(excluded.price_id,   public.subscriptions.price_id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.upsert_subscription_from_stripe(
  uuid, text, text, uuid, uuid, public.subscription_status, integer,
  timestamptz, timestamptz, timestamptz, boolean
) from public;
grant execute on function public.upsert_subscription_from_stripe(
  uuid, text, text, uuid, uuid, public.subscription_status, integer,
  timestamptz, timestamptz, timestamptz, boolean
) to service_role;
