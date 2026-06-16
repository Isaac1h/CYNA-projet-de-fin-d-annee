import { getProducts as readDemoProducts } from '@/lib/demoData';
import type { Product, ProductQuery, StockStatus } from './types';

const STOCK_ORDER: Record<StockStatus, number> = {
  'En Stock': 0,
  'Limité': 1,
  'Rupture de Stock': 2,
};

const normalize = (raw: unknown): Product[] => raw as Product[];

const matchesSearch = (product: Product, term: string): boolean => {
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
    case 'priority':
    case 'default':
    case undefined:
    default:
      return compareByDefault(a, b);
  }
};

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const all = normalize(readDemoProducts());
  const filtered = all.filter((product) => {
    if (query.categoryId && product.category_id !== query.categoryId) return false;
    if (query.stockStatus && query.stockStatus !== 'all' && product.stock_status !== query.stockStatus) {
      return false;
    }
    if (query.search && !matchesSearch(product, query.search)) return false;
    return true;
  });
  return [...filtered].sort(compareProducts(query.sort));
}

export async function getProductById(id: string): Promise<Product | null> {
  const all = normalize(readDemoProducts());
  return all.find((product) => product.id === id) ?? null;
}

export async function getTopProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  return getProducts({ categoryId });
}
