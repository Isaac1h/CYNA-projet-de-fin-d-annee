'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import type { Category, ProductSort, StockFilter } from '@/lib/data';

type Props = {
  categories: Category[];
  selectedCategoryId: string;
  selectedStock: StockFilter;
  selectedSort: ProductSort;
  searchTerm: string;
  matchCount: number;
};

const buildHref = (params: URLSearchParams): string => {
  const query = params.toString();
  return query ? `/catalogue?${query}` : '/catalogue';
};

export default function CatalogueFilters({
  categories,
  selectedCategoryId,
  selectedStock,
  selectedSort,
  searchTerm,
  matchCount,
}: Props) {
  const t = useTranslations('catalogue.filters');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
    { value: 'all', label: t('stockAll') },
    { value: 'En Stock', label: t('stockInStock') },
    { value: 'Limité', label: t('stockLimited') },
    { value: 'Rupture de Stock', label: t('stockOutOfStock') },
  ];

  const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
    { value: 'default', label: t('sortDefault') },
    { value: 'availability', label: t('sortAvailability') },
    { value: 'price_asc', label: t('sortPriceAsc') },
    { value: 'price_desc', label: t('sortPriceDesc') },
    { value: 'name', label: t('sortName') },
  ];

  const pushParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page');
      router.push(buildHref(params), { scroll: false });
    },
    [router, searchParams],
  );

  const setParam = (key: string, value: string, fallback: string) => {
    pushParams((params) => {
      if (!value || value === fallback) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setParam('q', searchInput.trim(), '');
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setParam('q', '', '');
  };

  const hasActiveFilters =
    selectedCategoryId !== 'all' ||
    selectedStock !== 'all' ||
    selectedSort !== 'default' ||
    searchTerm.length > 0;

  const handleReset = () => {
    setSearchInput('');
    router.push('/catalogue', { scroll: false });
  };

  return (
    <section aria-label={t('sectionAria')} className="space-y-4">
      <form onSubmit={handleSearchSubmit} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="catalogue-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="catalogue-search"
            type="search"
            value={searchInput}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchInput(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-lg border border-input bg-secondary/40 py-3 pl-11 pr-12 text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searchInput.length > 0 && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label={t('searchClear')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search aria-hidden="true" className="h-4 w-4 sm:hidden" />
          {t('searchSubmit')}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="catalogue-category" className="mb-1 block text-sm font-medium text-muted-foreground">
            {t('category')}
          </label>
          <select
            id="catalogue-category"
            value={selectedCategoryId}
            onChange={(event) => setParam('category', event.target.value, 'all')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t('categoryAll')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="catalogue-stock" className="mb-1 block text-sm font-medium text-muted-foreground">
            {t('stock')}
          </label>
          <select
            id="catalogue-stock"
            value={selectedStock}
            onChange={(event) => setParam('stock', event.target.value, 'all')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="catalogue-sort" className="mb-1 block text-sm font-medium text-muted-foreground">
            {t('sort')}
          </label>
          <select
            id="catalogue-sort"
            value={selectedSort}
            onChange={(event) => setParam('sort', event.target.value, 'default')}
            className="w-full rounded-lg border border-input bg-secondary/40 px-3 py-2 text-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t('matchStatus', { count: matchCount })}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="self-start rounded-md border border-input px-3 py-1.5 text-sm text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-primary sm:self-auto"
          >
            {t('reset')}
          </button>
        )}
      </div>
    </section>
  );
}
