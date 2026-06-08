'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

/**
 * Mes abonnements.
 *
 * Lecture : `public.subscriptions` via la session anon-keyée. La policy
 * `subscriptions_owner_select` (`auth.uid() = user_id OR is_admin()`)
 * filtre déjà côté base — un bug ici ne peut pas leak les abonnements
 * d'un autre utilisateur.
 *
 * Mutations : POST sur /api/account/subscriptions/[id]/cancel ou
 * /reactivate. La route vérifie l'ownership ET appelle Stripe. La base
 * sera mise à jour quelques secondes plus tard par le webhook
 * `customer.subscription.updated` qui passera par
 * `upsert_subscription_from_stripe`.
 *
 * UX : on rend l'état optimiste à partir de la réponse de la route
 * (Stripe est la source de vérité, la base reflète), puis on programme
 * un refetch ~3 s plus tard pour réconcilier avec ce que le webhook a
 * écrit. Si la réconciliation diverge, le second rendu corrige.
 */

const RECONCILE_DELAY_MS = 3000;

type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

type LocalisedRecord = Record<string, string>;

type DbSubscription = {
  id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  quantity: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  products: { name: LocalisedRecord | null; slug: string } | null;
  prices: {
    billing_interval: 'monthly' | 'annual';
    unit_type: 'flat' | 'per_user' | 'per_device';
  } | null;
};

const SELECT_COLUMNS =
  'id, stripe_subscription_id, status, quantity, current_period_start, ' +
  'current_period_end, cancel_at, cancel_at_period_end, created_at, ' +
  'products(name, slug), prices(billing_interval, unit_type)';

const STATUS_CLASS: Record<SubscriptionStatus, string> = {
  incomplete: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  incomplete_expired: 'border-muted-foreground/40 bg-muted/30 text-muted-foreground',
  trialing: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  active: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  past_due: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  canceled: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  unpaid: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  paused: 'border-muted-foreground/40 bg-muted/30 text-muted-foreground',
};

const CANCELLABLE: ReadonlySet<SubscriptionStatus> = new Set([
  'active',
  'trialing',
  'past_due',
]);

function localisedName(
  rec: LocalisedRecord | null,
  locale: string,
  fallback: string,
): string {
  if (!rec) return fallback;
  return rec[locale] ?? rec.fr ?? rec.en ?? Object.values(rec)[0] ?? fallback;
}

export default function SubscriptionsSection() {
  const t = useTranslations('account.subscriptions');
  const locale = useLocale();
  const [items, setItems] = useState<DbSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const formatDate = useCallback(
    (iso: string | null): string => {
      if (!iso) return t('dash');
      return new Date(iso).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
      });
    },
    [locale, t],
  );

  const fetchItems = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('subscriptions')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setItems((data as unknown as DbSubscription[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchItems();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  const applyOptimisticUpdate = (
    id: string,
    patch: Partial<Pick<DbSubscription, 'cancel_at_period_end' | 'cancel_at' | 'status'>>,
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  };

  const callRoute = async (
    id: string,
    action: 'cancel' | 'reactivate',
  ): Promise<void> => {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/account/subscriptions/${id}/${action}`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? t('unknownError'));
      }
      const payload = (await response.json()) as {
        cancel_at_period_end?: boolean;
        cancel_at?: number | null;
        status?: SubscriptionStatus;
      };
      // Optimiste : on rend tout de suite l'état cible, puis on refetch
      // dans 3 s pour réconcilier avec ce que le webhook aura écrit.
      applyOptimisticUpdate(id, {
        cancel_at_period_end:
          payload.cancel_at_period_end ?? (action === 'cancel'),
        cancel_at:
          typeof payload.cancel_at === 'number'
            ? new Date(payload.cancel_at * 1000).toISOString()
            : null,
        status: payload.status,
      });
      window.setTimeout(() => {
        void fetchItems();
      }, RECONCILE_DELAY_MS);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(
        action === 'cancel'
          ? t('cancelFailed', { error: message })
          : t('reactivateFailed', { error: message }),
      );
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  };

  return (
    <section
      id="subscriptions"
      aria-labelledby="subscriptions-heading"
      className="space-y-4"
    >
      <header>
        <h2
          id="subscriptions-heading"
          className="text-xl font-bold text-foreground sm:text-2xl"
        >
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
      </header>

      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {t('loadError', { error })}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const productName = localisedName(
              it.products?.name ?? null,
              locale,
              it.products?.slug ?? t('defaultProduct'),
            );
            const intervalLabel = it.prices
              ? `${t(`interval.${it.prices.billing_interval}`)} · ${t(`unit.${it.prices.unit_type}`)}`
              : null;
            const canCancel = CANCELLABLE.has(it.status) && !it.cancel_at_period_end;
            const canReactivate =
              CANCELLABLE.has(it.status) && it.cancel_at_period_end;
            const periodEnd = formatDate(it.current_period_end);
            const cancelAt = formatDate(it.cancel_at ?? it.current_period_end);

            return (
              <li
                key={it.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {productName}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[it.status]}`}
                      >
                        {t(`status.${it.status}`)}
                      </span>
                      {it.cancel_at_period_end && it.status !== 'canceled' && (
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                          {t('scheduledCancel')}
                        </span>
                      )}
                    </div>
                    {intervalLabel && (
                      <p className="text-xs text-muted-foreground">
                        {intervalLabel}
                        {it.quantity > 1 ? t('quantitySuffix', { value: it.quantity }) : ''}
                      </p>
                    )}
                    {it.cancel_at_period_end ? (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400"
                        />
                        {t('endsOn')}{' '}
                        <span className="font-medium text-foreground">{cancelAt}</span>
                      </p>
                    ) : it.status === 'canceled' ? (
                      <p className="text-sm text-muted-foreground">
                        {t('canceledSince')}{' '}
                        <span className="font-medium text-foreground">{periodEnd}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t('nextRenewal')}{' '}
                        <span className="font-medium text-foreground">{periodEnd}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    {canCancel && confirmingId !== it.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingId(it.id)}
                        disabled={busyId === it.id}
                      >
                        <XCircle aria-hidden="true" className="mr-1 h-4 w-4" />
                        {t('cancel')}
                      </Button>
                    )}
                    {canReactivate && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void callRoute(it.id, 'reactivate')}
                        disabled={busyId === it.id}
                        aria-busy={busyId === it.id || undefined}
                      >
                        <RefreshCw aria-hidden="true" className="mr-1 h-4 w-4" />
                        {busyId === it.id ? t('reactivating') : t('reactivate')}
                      </Button>
                    )}
                  </div>
                </div>

                {confirmingId === it.id && (
                  <div
                    role="alertdialog"
                    aria-labelledby={`confirm-cancel-${it.id}-heading`}
                    aria-describedby={`confirm-cancel-${it.id}-desc`}
                    className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                  >
                    <p
                      id={`confirm-cancel-${it.id}-heading`}
                      className="font-medium text-foreground"
                    >
                      {t('confirmCancelHeading')}
                    </p>
                    <p
                      id={`confirm-cancel-${it.id}-desc`}
                      className="mt-1 text-muted-foreground"
                    >
                      {t.rich('confirmCancelBody', {
                        date: periodEnd,
                        em: (chunks) => (
                          <span className="font-medium text-foreground">{chunks}</span>
                        ),
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => void callRoute(it.id, 'cancel')}
                        disabled={busyId === it.id}
                        aria-busy={busyId === it.id || undefined}
                      >
                        <CheckCircle2 aria-hidden="true" className="mr-1 h-4 w-4" />
                        {busyId === it.id ? t('scheduling') : t('confirmCancelButton')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingId(null)}
                        disabled={busyId === it.id}
                      >
                        {t('cancelDialogCancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
