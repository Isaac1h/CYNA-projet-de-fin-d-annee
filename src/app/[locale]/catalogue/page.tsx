import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import {
  getCategories,
  getProducts,
  type ProductSort,
  type StockFilter,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import Pagination from '@/components/Pagination';
import CatalogueFilters from './CatalogueFilters';

// Metadata reste FR pour l'instant — les meta i18n dynamiques requièrent
// generateMetadata avec locale, ajouté globalement dans un lot polish.
export const metadata: Metadata = {
  title: 'Catalogue — Cyna',
  description:
    "Parcourez le catalogue complet des solutions de sécurité Cyna : SOC, EDR, XDR et plateformes de renseignement sur les menaces.",
};

const VALID_STOCK: StockFilter[] = ['all', 'En Stock', 'Limité', 'Rupture de Stock'];
const VALID_SORT: ProductSort[] = ['default', 'priority', 'availability', 'price_asc', 'price_desc', 'name'];

const PAGE_SIZE = 12;

const readParam = (raw: string | string[] | undefined): string => {
  if (Array.isArray(raw)) return raw[0] ?? '';
  return raw ?? '';
};

const parseStock = (raw: string): StockFilter =>
  (VALID_STOCK as string[]).includes(raw) ? (raw as StockFilter) : 'all';

const parseSort = (raw: string): ProductSort =>
  (VALID_SORT as string[]).includes(raw) ? (raw as ProductSort) : 'default';

const parsePage = (raw: string): number => {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) return 1;
  return value;
};

type SearchParams = {
  category?: string | string[];
  stock?: string | string[];
  sort?: string | string[];
  q?: string | string[];
  page?: string | string[];
};

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations('catalogue');

  const rawCategory = readParam(searchParams.category);
  const stockStatus = parseStock(readParam(searchParams.stock));
  const sort = parseSort(readParam(searchParams.sort));
  const search = readParam(searchParams.q).trim();
  const requestedPage = parsePage(readParam(searchParams.page));

  const categories = await getCategories();
  const validCategoryIds = new Set(categories.map((category) => category.id));
  const categoryId = validCategoryIds.has(rawCategory) ? rawCategory : 'all';

  const products = await getProducts({
    categoryId: categoryId === 'all' ? undefined : categoryId,
    stockStatus,
    sort,
    search: search || undefined,
  });

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visibleProducts = products.slice(start, start + PAGE_SIZE);

  const buildPageHref = (page: number): string => {
    const params = new URLSearchParams();
    if (categoryId !== 'all') params.set('category', categoryId);
    if (stockStatus !== 'all') params.set('stock', stockStatus);
    if (sort !== 'default') params.set('sort', sort);
    if (search) params.set('q', search);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `/catalogue?${query}` : '/catalogue';
  };

  const heading =
    categoryId === 'all'
      ? t('headingAll')
      : t('headingWithCategory', {
          category: categories.find((category) => category.id === categoryId)?.name ?? '',
        });

  return (
    <div className="bg-background py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-3xl">
          <h1 className="mb-3 text-3xl font-bold text-foreground sm:text-4xl">{heading}</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {t('subtitle')}
          </p>
        </header>

        <CatalogueFilters
          categories={categories}
          selectedCategoryId={categoryId}
          selectedStock={stockStatus}
          selectedSort={sort}
          searchTerm={search}
          matchCount={products.length}
        />

        <section
          aria-label={t('resultsAriaLabel')}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>

        {products.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h2 className="text-xl font-semibold text-foreground">{t('noResults.title')}</h2>
            <p className="mt-2 text-muted-foreground">{t('noResults.helper')}</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              hrefForPage={buildPageHref}
              ariaLabel={t('paginationAriaLabel')}
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {t('pageStatus', {
                current: currentPage,
                total: totalPages,
                count: products.length,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
