import { supabase } from '@/lib/supabase';
import type { Product, ProductImage, ProductQuery, StockStatus } from './types';

/**
 * Flattens the normalized catalogue (products + product_images + prices +
 * categories) back into the legacy `Product` shape consumed by every page.
 *
 * Key remappings:
 * - `id` exposed = the slug, so `<Link href={`/product/${p.id}`}>` keeps
 *   producing slug URLs without touching any page.
 * - `category_id` exposed = the parent category's slug, same reason.
 * - `image_url` = the lowest-`position` row in `product_images`.
 * - `price_*` reconstituted in EUR (÷100) from the matching rows in
 *   `prices` (monthly+flat, annual+flat, monthly+per_user).
 * - `stock_status` decoded from the `availability` enum to the French
 *   label the existing UI switches on.
 * - `name` / `description` resolved against the `fr` jsonb key (en/ar/he
 *   will be added by the i18n lot).
 */

type AvailabilityCode = 'in_stock' | 'limited' | 'out_of_stock';
type BillingInterval = 'monthly' | 'annual';
type PriceUnit = 'flat' | 'per_user' | 'per_device';

type PriceRow = {
  billing_interval: BillingInterval;
  unit_type: PriceUnit;
  unit_amount: number;
  currency: string;
  is_active: boolean;
};

type ImageRow = {
  url: string;
  position: number;
  /** jsonb i18n map en base ({fr,en,…}) — peut être null si non renseigné. */
  alt: Record<string, string> | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: Record<string, string> | null;
  description: Record<string, string> | null;
  specs: Record<string, string> | null;
  availability: AvailabilityCode;
  priority: number;
  is_active: boolean;
  created_at: string;
  category: { id: string; slug: string };
  product_images: ImageRow[];
  prices: PriceRow[];
};

const AVAILABILITY_LABEL: Record<AvailabilityCode, StockStatus> = {
  in_stock: 'En Stock',
  limited: 'Limité',
  out_of_stock: 'Rupture de Stock',
};

const AVAILABILITY_CODE: Record<StockStatus, AvailabilityCode> = {
  'En Stock': 'in_stock',
  'Limité': 'limited',
  'Rupture de Stock': 'out_of_stock',
};

const STOCK_ORDER: Record<StockStatus, number> = {
  'En Stock': 0,
  'Limité': 1,
  'Rupture de Stock': 2,
};

const PRODUCT_SELECT = `
  id, slug, name, description, specs, availability, priority, is_active, created_at,
  category:categories!inner ( id, slug ),
  product_images ( url, position, alt ),
  prices ( billing_interval, unit_type, unit_amount, currency, is_active )
`;

const findPriceCents = (
  prices: PriceRow[],
  interval: BillingInterval,
  unit: PriceUnit,
): number => {
  const match = prices.find(
    (p) => p.is_active && p.billing_interval === interval && p.unit_type === unit,
  );
  return match?.unit_amount ?? 0;
};

const sortImages = (images: ImageRow[]): ImageRow[] =>
  [...images].sort((a, b) => a.position - b.position);

const firstImageUrl = (images: ImageRow[]): string =>
  sortImages(images)[0]?.url ?? '';

const toGalleryImage = (row: ImageRow): ProductImage => ({
  url: row.url,
  position: row.position,
  alt: row.alt?.fr ?? null,
});

const toProduct = (row: ProductRow): Product => ({
  id: row.slug,
  pk_id: row.id,
  name: row.name?.fr ?? '',
  description: row.description?.fr ?? '',
  price_monthly: findPriceCents(row.prices, 'monthly', 'flat') / 100,
  price_annual: findPriceCents(row.prices, 'annual', 'flat') / 100,
  price_per_user: findPriceCents(row.prices, 'monthly', 'per_user') / 100,
  category_id: row.category.slug,
  image_url: firstImageUrl(row.product_images),
  images: sortImages(row.product_images).map(toGalleryImage),
  stock_status: AVAILABILITY_LABEL[row.availability],
  technical_specs: row.specs ?? {},
  priority: row.priority,
  is_active: row.is_active,
  created_at: row.created_at,
});

const matchesSearchClient = (product: Product, term: string): boolean => {
  const haystack = `${product.name} ${product.description}`.toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
};

const compareByDefault = (a: Product, b: Product): number => {
  const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
  if (priorityDiff !== 0) return priorityDiff;
  return STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status];
};

const compareProducts = (sort: ProductQuery['sort']) => (a: Product, b: Product): number => {
  switch (sort) {
    case 'price_asc':
      return a.price_monthly - b.price_monthly;
    case 'price_desc':
      return b.price_monthly - a.price_monthly;
    case 'name':
      return a.name.localeCompare(b.name, 'fr');
    case 'availability':
      return STOCK_ORDER[a.stock_status] - STOCK_ORDER[b.stock_status];
    case 'newest':
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    case 'priority':
    case 'default':
    case undefined:
    default:
      return compareByDefault(a, b);
  }
};

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  // ---- Category filter ----------------------------------------------------
  // The public API takes slug(s); we resolve them to UUIDs in one lookup
  // and filter on the indexed `category_id` column. `categoryIds`
  // (multi-select) supersedes `categoryId` when non-empty.
  const categorySlugs =
    query.categoryIds && query.categoryIds.length > 0
      ? query.categoryIds
      : query.categoryId
        ? [query.categoryId]
        : null;

  let categoryUuids: string[] | null = null;
  if (categorySlugs) {
    const { data: cats, error: catErr } = await supabase
      .from('categories')
      .select('id, slug')
      .in('slug', categorySlugs);
    if (catErr) {
      throw new Error(`Supabase getProducts (category lookup) failed: ${catErr.message}`);
    }
    const uuids = ((cats ?? []) as { id: string }[]).map((c) => c.id);
    if (uuids.length === 0) return [];
    categoryUuids = uuids;
  }

  let request = supabase.from('products').select(PRODUCT_SELECT);

  // Soft-delete: hide is_active=false unless the caller is admin and asked
  // for the full set. Admins pass `includeInactive: true` from
  // /admin/ProductsAdminSection so they can re-activate / hard-delete.
  if (!query.includeInactive) {
    request = request.eq('is_active', true);
  }

  if (categoryUuids) {
    request =
      categoryUuids.length === 1
        ? request.eq('category_id', categoryUuids[0])
        : request.in('category_id', categoryUuids);
  }

  // ---- Stock filter -------------------------------------------------------
  // `stockStatuses` (multi-select) supersedes `stockStatus`. We map the FR
  // labels back to enum codes before sending to Postgres.
  if (query.stockStatuses && query.stockStatuses.length > 0) {
    const codes = query.stockStatuses
      .map((s) => AVAILABILITY_CODE[s])
      .filter((c): c is AvailabilityCode => Boolean(c));
    if (codes.length > 0) {
      request = request.in('availability', codes);
    }
  } else if (query.stockStatus && query.stockStatus !== 'all') {
    const code = AVAILABILITY_CODE[query.stockStatus];
    if (code) {
      request = request.eq('availability', code);
    }
  }

  // ---- Search filter (Postgres FTS) --------------------------------------
  let usedServerSearch = false;
  if (query.search) {
    request = request.textSearch('search_fr', query.search, {
      type: 'plain',
      config: 'french',
    });
    usedServerSearch = true;
  }

  // ---- Sort: push to Postgres where possible -----------------------------
  // Without an explicit ORDER BY, PostgREST may return rows in arbitrary
  // engine order and then clip the response at the server-side `max_rows`
  // cap (1000 by default), so the JS sort below would run on a
  // non-deterministic slice. The stock_status enum was declared
  // in_stock < limited < out_of_stock, so `order('availability', asc)`
  // reproduces STOCK_ORDER exactly. 'name' / 'price_asc' / 'price_desc'
  // stay JS-sorted: name needs jsonb path support and price needs a join
  // on the prices table — safe to defer while the catalogue stays below
  // max_rows.
  switch (query.sort) {
    case 'availability':
      request = request.order('availability', { ascending: true });
      break;
    case 'newest':
      request = request.order('created_at', { ascending: false });
      break;
    case 'priority':
    case 'default':
    case undefined:
      request = request
        .order('priority', { ascending: false })
        .order('availability', { ascending: true });
      break;
    default:
      // 'name', 'price_asc', 'price_desc' → JS sort below (full fetched set).
      break;
  }

  const { data, error } = await request;
  if (error) {
    throw new Error(`Supabase getProducts failed: ${error.message}`);
  }

  let products = ((data ?? []) as unknown as ProductRow[]).map(toProduct);

  // ---- Post-fetch filters that don't fit cleanly in SQL ------------------
  // Price range targets the monthly+flat amount which lives on a related
  // table. Pushing this would need a denormalized column or a view; for
  // catalogues below max_rows the JS filter is fine.
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    products = products.filter((p) => {
      if (query.minPrice !== undefined && p.price_monthly < query.minPrice) return false;
      if (query.maxPrice !== undefined && p.price_monthly > query.maxPrice) return false;
      return true;
    });
  }

  if (query.search && !usedServerSearch) {
    const term = query.search;
    products = products.filter((p) => matchesSearchClient(p, term));
  }

  return [...products].sort(compareProducts(query.sort));
}

export async function getProductById(
  id: string,
  options: { includeInactive?: boolean } = {},
): Promise<Product | null> {
  let request = supabase.from('products').select(PRODUCT_SELECT).eq('slug', id);
  if (!options.includeInactive) {
    request = request.eq('is_active', true);
  }
  const { data, error } = await request.maybeSingle();
  if (error) {
    throw new Error(`Supabase getProductById failed: ${error.message}`);
  }
  return data ? toProduct(data as unknown as ProductRow) : null;
}

export async function getTopProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return getProducts({ categoryId });
}
