'use client';

import type { ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import type { OrderFilters as OrderFiltersValue, OrderStatus } from './types';

const STATUS_VALUES: (OrderStatus | 'all')[] = ['all', 'pending', 'completed', 'cancelled'];

type Props = {
  filters: OrderFiltersValue;
  availableYears: number[];
  availableServices: string[];
  matchCount: number;
  onChange: (next: OrderFiltersValue) => void;
};

export default function OrderFilters({
  filters,
  availableYears,
  availableServices,
  matchCount,
  onChange,
}: Props) {
  const t = useTranslations('orders.filters');
  const tCard = useTranslations('orderCard');
  const update = <K extends keyof OrderFiltersValue>(key: K, value: OrderFiltersValue[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const handleYear = (event: ChangeEvent<HTMLSelectElement>) => update('year', event.target.value);
  const handleService = (event: ChangeEvent<HTMLSelectElement>) =>
    update('service', event.target.value);
  const handleStatus = (event: ChangeEvent<HTMLSelectElement>) =>
    update('status', event.target.value as OrderFiltersValue['status']);
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) =>
    update('search', event.target.value);
  const handleClearSearch = () => update('search', '');

  return (
    <section aria-label={t('sectionAria')} className="space-y-4">
      <div className="relative">
        <label htmlFor="orders-search" className="sr-only">
          {t('searchLabel')}
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          id="orders-search"
          type="search"
          value={filters.search}
          onChange={handleSearch}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {filters.search.length > 0 && (
          <button
            type="button"
            onClick={handleClearSearch}
            aria-label={t('searchClear')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="orders-year" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('year')}
          </label>
          <select
            id="orders-year"
            value={filters.year}
            onChange={handleYear}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t('yearAll')}</option>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="orders-service"
            className="mb-1 block text-xs font-medium text-muted-foreground"
          >
            {t('service')}
          </label>
          <select
            id="orders-service"
            value={filters.service}
            onChange={handleService}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t('serviceAll')}</option>
            {availableServices.map((service) => (
              <option key={service} value={service}>
                {service}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="orders-status" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t('status')}
          </label>
          <select
            id="orders-status"
            value={filters.status}
            onChange={handleStatus}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {STATUS_VALUES.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? t('statusAll') : tCard(`status.${status}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {t('matchStatus', { count: matchCount })}
      </p>
    </section>
  );
}
