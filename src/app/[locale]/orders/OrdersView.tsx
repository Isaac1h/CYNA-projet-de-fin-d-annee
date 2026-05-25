'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import OrderFilters from '@/features/orders/OrderFilters';
import OrdersGroupedList from '@/features/orders/OrdersGroupedList';
import { availableYears, filterOrders } from '@/features/orders/filtering';
import { useToast } from '@/components/ui/use-toast';
import type { Order, OrderFilters as OrderFiltersValue } from '@/features/orders/types';
import { getCategories, listOrders, type Category } from '@/lib/data';

const ORDERS_PATH = '/orders';

const DEFAULT_FILTERS: OrderFiltersValue = {
  year: 'all',
  service: 'all',
  status: 'all',
  search: '',
};

const OrdersSkeleton = () => {
  const t = useTranslations('orders');
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-24 animate-pulse rounded-lg border border-border bg-card/40" aria-hidden="true" />
      <div className="h-32 animate-pulse rounded-lg border border-border bg-card/40" aria-hidden="true" />
      <div className="h-32 animate-pulse rounded-lg border border-border bg-card/40" aria-hidden="true" />
      <span className="sr-only">{t('skeleton')}</span>
    </div>
  );
};

export default function OrdersView() {
  const t = useTranslations('orders');
  const router = useRouter();
  const { isAuthenticated, loading, currentUser } = useAuth();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<OrderFiltersValue>(DEFAULT_FILTERS);

  // FIXME-SECURITY: client-side guard, UX only. The real authorisation
  // check will live in the Supabase middleware that validates the JWT in
  // the session cookie before the page renders. Do NOT rely on this
  // useEffect for security.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace({
        pathname: '/login',
        query: { from: safeRedirectTarget(ORDERS_PATH) },
      });
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (loading || !isAuthenticated || !currentUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listOrders(currentUser.id);
        if (cancelled) return;
        setOrders(rows);
      } catch (err) {
        if (cancelled) return;
        toast({
          title: t('loadFailedTitle'),
          description: err instanceof Error ? err.message : t('unknownError'),
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, isAuthenticated, currentUser, toast, t]);

  useEffect(() => {
    let cancelled = false;
    void getCategories().then((result) => {
      if (!cancelled) setCategories(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableServiceTokens = useMemo(() => categories.map((category) => category.name), [categories]);
  const filteredOrders = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const yearOptions = useMemo(() => availableYears(orders), [orders]);

  if (loading || !isAuthenticated) {
    return <OrdersSkeleton />;
  }

  if (!hydrated) {
    return <OrdersSkeleton />;
  }

  if (orders.length === 0) {
    return (
      <section
        aria-labelledby="orders-empty-heading"
        className="rounded-lg border border-border bg-card p-10 shadow-sm"
      >
        <Package aria-hidden="true" className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 id="orders-empty-heading" className="text-xl font-semibold text-foreground">
          {t('empty.heading')}
        </h2>
        <p className="mt-2 max-w-md text-muted-foreground">{t('empty.hint')}</p>
        <Link href="/catalogue" className="mt-6 inline-block">
          <Button size="lg">{t('empty.browse')}</Button>
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <OrderFilters
        filters={filters}
        availableYears={yearOptions}
        availableServices={availableServiceTokens}
        matchCount={filteredOrders.length}
        onChange={setFilters}
      />

      {filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-10">
          <h2 className="text-base font-semibold text-foreground">{t('noMatch.heading')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('noMatch.hint')}</p>
        </div>
      ) : (
        <OrdersGroupedList orders={filteredOrders} />
      )}
    </div>
  );
}
