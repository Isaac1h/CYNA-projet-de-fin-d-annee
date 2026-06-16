/**
 * Canonical data model exposed by the `@/lib/data` access layer.
 *
 * Pages and components MUST import these types from here (never from
 * `@/lib/demoData` directly). When Supabase lands, the implementations
 * in `products.ts` / `categories.ts` / `carousel.ts` change but the
 * types stay stable.
 */

export type StockStatus = 'En Stock' | 'Limité' | 'Rupture de Stock';

export type Category = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  price_per_user: number;
  category_id: string;
  image_url: string;
  stock_status: StockStatus;
  technical_specs: Record<string, string>;
  /** Higher first. Defaults to 0 when absent. */
  priority?: number;
  created_at: string;
};

export type CarouselItem = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  order_index: number;
  created_at: string;
};

export type ProductSort = 'default' | 'priority' | 'availability' | 'price_asc' | 'price_desc' | 'name';

export type StockFilter = StockStatus | 'all';

export type ProductQuery = {
  categoryId?: string;
  stockStatus?: StockFilter;
  search?: string;
  sort?: ProductSort;
};
