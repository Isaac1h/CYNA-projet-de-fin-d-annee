-- Lot A — Catalogue schema (categories, products, product_images, prices, carousel_slides).
-- Mirrors modele-donnees-CYNA.md §3 (domaine 2) + §4 (RLS) + §5 (FTS).
-- Replaces the simple stub that was never applied to a real database; the
-- broader domains (auth, orders, subscriptions, support) land with their own
-- lots (B → E).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive slugs
create extension if not exists pg_trgm;    -- trigram index for fuzzy search

-- ---------------------------------------------------------------------------
-- Enums (catalogue subset — order/subscription/contact enums land with their lots)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.stock_status as enum ('in_stock', 'limited', 'out_of_stock');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_interval as enum ('monthly', 'annual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.price_unit as enum ('flat', 'per_user', 'per_device');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared across editable tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid        primary key default gen_random_uuid(),
  slug          citext      not null unique,
  name          jsonb       not null,
  description   jsonb,
  image_url     text,
  display_order int         not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.categories is
  'Product categories. name / description are jsonb i18n maps ({fr,en,ar,he}).';

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id            uuid          primary key default gen_random_uuid(),
  category_id   uuid          not null references public.categories(id) on delete restrict,
  slug          citext        not null unique,
  name          jsonb         not null,
  description   jsonb,
  specs         jsonb         not null default '{}'::jsonb,
  availability  stock_status  not null default 'in_stock',
  priority      int           not null default 0,
  is_featured   boolean       not null default false,
  is_active     boolean       not null default true,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now(),
  search_fr     tsvector      generated always as (
    to_tsvector(
      'french',
      coalesce(name->>'fr', '') || ' ' || coalesce(description->>'fr', '')
    )
  ) stored
);

comment on table public.products is
  'Catalogue items. Prices live in public.prices (centimes). search_fr is a
   stored generated tsvector over name/description fr fields.';

create index if not exists products_search_fr_idx
  on public.products using gin (search_fr);
create index if not exists products_name_trgm_idx
  on public.products using gin ((name->>'fr') gin_trgm_ops);
create index if not exists products_category_id_idx
  on public.products (category_id);
create index if not exists products_availability_idx
  on public.products (availability);
create index if not exists products_is_active_idx
  on public.products (is_active);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- product_images (galerie)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id         uuid        primary key default gen_random_uuid(),
  product_id uuid        not null references public.products(id) on delete cascade,
  url        text        not null,
  alt        jsonb,
  position   int         not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.product_images is
  'Product gallery. alt is a jsonb i18n map for WCAG alt text. Lowest
   position wins as "primary" image for list views.';

create index if not exists product_images_product_id_position_idx
  on public.product_images (product_id, position);

-- ---------------------------------------------------------------------------
-- prices (replaces price_monthly/annual/per_user columns; ready for Stripe)
-- ---------------------------------------------------------------------------
create table if not exists public.prices (
  id               uuid             primary key default gen_random_uuid(),
  product_id       uuid             not null references public.products(id) on delete cascade,
  stripe_price_id  text             unique,
  billing_interval billing_interval not null,
  unit_type        price_unit       not null default 'flat',
  unit_amount      integer          not null check (unit_amount >= 0),
  currency         char(3)          not null default 'eur',
  is_active        boolean          not null default true,
  created_at       timestamptz      not null default now(),
  unique (product_id, billing_interval, unit_type)
);

comment on table public.prices is
  'Unit amounts stored as integer centimes. stripe_price_id stays NULL until
   the Stripe lot wires Checkout in.';

create index if not exists prices_product_id_idx on public.prices (product_id);

-- ---------------------------------------------------------------------------
-- carousel_slides (renamed from carousel_items in the simple stub)
-- ---------------------------------------------------------------------------
create table if not exists public.carousel_slides (
  id            uuid        primary key default gen_random_uuid(),
  title         jsonb       not null,
  subtitle      jsonb,
  image_url     text        not null,
  cta_text      jsonb,
  cta_link      text,
  display_order int         not null default 0,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.carousel_slides is
  'Home hero carousel. title / subtitle / cta_text are jsonb i18n maps.
   cta_link is a plain URL (no localisation needed).';

create index if not exists carousel_slides_display_order_idx
  on public.carousel_slides (display_order);

drop trigger if exists carousel_slides_set_updated_at on public.carousel_slides;
create trigger carousel_slides_set_updated_at
  before update on public.carousel_slides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — public read on the 5 catalogue tables, NO writes
-- ---------------------------------------------------------------------------
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.prices          enable row level security;
alter table public.carousel_slides enable row level security;

drop policy if exists categories_public_read      on public.categories;
drop policy if exists products_public_read        on public.products;
drop policy if exists product_images_public_read  on public.product_images;
drop policy if exists prices_public_read          on public.prices;
drop policy if exists carousel_slides_public_read on public.carousel_slides;

create policy categories_public_read
  on public.categories
  for select to anon, authenticated
  using (is_active);

create policy products_public_read
  on public.products
  for select to anon, authenticated
  using (is_active);

create policy product_images_public_read
  on public.product_images
  for select to anon, authenticated
  using (true);

create policy prices_public_read
  on public.prices
  for select to anon, authenticated
  using (is_active);

create policy carousel_slides_public_read
  on public.carousel_slides
  for select to anon, authenticated
  using (is_active);
