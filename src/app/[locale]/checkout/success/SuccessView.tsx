'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Hourglass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

/**
 * Stripe success landing page.
 *
 * Lifecycle:
 *   1. Stripe redirects here after the user pays. URL :
 *        /checkout/success?session_id=cs_test_xxx
 *   2. Poll public.orders for a row matching this session_id (the row is
 *      created server-side by the webhook on `checkout.session.completed`).
 *      Up to 10 attempts at 1s interval; if the webhook is slow we show
 *      a "paiement en cours de confirmation" state with a manual refresh.
 *   3. The moment the polled order is found, clear the cart exactly once.
 *      Doing it on mount instead would race with CartContext hydration:
 *      setCartItems([]) fires before `hydrated` flips true, the write
 *      effect is skipped, then hydrate reads the still-full localStorage
 *      key and the cart reappears. Gating on `order` defers the clear
 *      until well after hydration. A direct visit to /checkout/success
 *      with no real payment never finds an order → cart is preserved.
 *   4. RLS lets the authenticated user read their own row (auth.uid() =
 *      user_id) — no service-role plumbing client-side.
 */

type OrderRow = {
  order_number: string;
  total_amount: number;
  currency: string;
  email: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  created_at: string;
};

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

const buildFormatPrice = (locale: string) => {
  return (cents: number, currency: string): string => {
    const value = cents / 100;
    const code = (currency || 'eur').toUpperCase();
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(value);
    } catch {
      return `${value.toFixed(2)} ${code}`;
    }
  };
};

export default function SuccessView() {
  const t = useTranslations('checkoutSuccess');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { currentUser, loading } = useAuth();
  const { clearCart } = useCart();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cartCleared = useRef(false);

  const formatPrice = buildFormatPrice(locale);

  // Clear the cart exactly once, the moment the polled order is found.
  // See file header for the rationale (no clearing on mount: races with
  // CartContext hydration; no clearing on timeout or error: the order
  // may still arrive on a subsequent retry and the user might want to
  // retry the same items if the webhook ultimately failed).
  useEffect(() => {
    if (order && !cartCleared.current) {
      clearCart();
      cartCleared.current = true;
    }
  }, [order, clearCart]);

  useEffect(() => {
    if (!sessionId || loading || !currentUser) return;
    let cancelled = false;
    let attempts = 0;

    const fetchOrder = async (): Promise<boolean> => {
      const { data } = await supabase
        .from('orders')
        .select('order_number, total_amount, currency, email, status, created_at')
        .eq('user_id', currentUser.id)
        .eq('stripe_checkout_session_id', sessionId)
        .maybeSingle();
      if (cancelled) return true;
      if (data) {
        setOrder(data as OrderRow);
        return true;
      }
      return false;
    };

    void (async () => {
      while (attempts < MAX_ATTEMPTS) {
        const found = await fetchOrder();
        if (found || cancelled) return;
        attempts++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) setTimedOut(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, loading, currentUser]);

  const handleManualRefresh = async () => {
    if (!sessionId || !currentUser) return;
    setRefreshing(true);
    const { data } = await supabase
      .from('orders')
      .select('order_number, total_amount, currency, email, status, created_at')
      .eq('user_id', currentUser.id)
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle();
    if (data) {
      setOrder(data as OrderRow);
      setTimedOut(false);
    }
    setRefreshing(false);
  };

  if (!sessionId) {
    return (
      <section
        aria-labelledby="success-missing-heading"
        className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
      >
        <h1 id="success-missing-heading" className="text-2xl font-bold text-foreground">
          {t('missing.heading')}
        </h1>
        <p className="mt-2 text-muted-foreground">{t('missing.body')}</p>
        <Link href="/catalogue" className="mt-6 inline-block">
          <Button size="lg">{t('missing.browse')}</Button>
        </Link>
      </section>
    );
  }

  if (order) {
    return (
      <section
        aria-labelledby="success-heading"
        className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"
        >
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h1 id="success-heading" className="mb-2 text-2xl font-bold text-foreground">
          {t('confirmed.heading')}
        </h1>
        <p className="mx-auto mb-6 max-w-md text-muted-foreground">
          {t.rich('confirmed.body', {
            email: order.email,
            em: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
        <dl className="mx-auto mb-8 max-w-sm rounded-md border border-input bg-secondary/40 p-4 text-left">
          <div className="mb-2 flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{t('confirmed.orderNumber')}</dt>
            <dd className="font-mono font-bold text-primary">{order.order_number}</dd>
          </div>
          <div className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{t('confirmed.amountCharged')}</dt>
            <dd className="font-semibold text-foreground">
              {formatPrice(order.total_amount, order.currency)}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/orders" className="sm:flex-1">
            <Button type="button" variant="outline" size="lg" className="w-full">
              {t('confirmed.viewOrders')}
            </Button>
          </Link>
          <Link href="/catalogue" className="sm:flex-1">
            <Button type="button" size="lg" className="w-full">
              {t('confirmed.continueShopping')}
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="pending-heading"
      aria-live="polite"
      className="rounded-lg border border-border bg-card p-8 text-center shadow-sm"
    >
      <div
        aria-hidden="true"
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-secondary"
      >
        <Hourglass className="h-10 w-10 text-primary" />
      </div>
      <h1 id="pending-heading" className="mb-2 text-2xl font-bold text-foreground">
        {t('pending.heading')}
      </h1>
      <p className="mx-auto mb-6 max-w-md text-muted-foreground">{t('pending.body')}</p>
      {timedOut && (
        <p className="mb-6 text-sm text-muted-foreground">{t('pending.timeout')}</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void handleManualRefresh()}
          disabled={refreshing}
        >
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          {refreshing ? t('pending.refreshing') : t('pending.refresh')}
        </Button>
        <Link href="/orders">
          <Button type="button" size="lg">
            {t('pending.viewOrders')}
          </Button>
        </Link>
      </div>
    </section>
  );
}
