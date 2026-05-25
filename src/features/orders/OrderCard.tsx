'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, FileDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { Order } from './types';

const STATUS_CLASS: Record<Order['status'], string> = {
  completed: 'border-green-800 bg-green-900/40 text-green-200',
  pending: 'border-yellow-800 bg-yellow-900/40 text-yellow-200',
  cancelled: 'border-red-800 bg-red-900/40 text-red-200',
};

type Props = { order: Order };

export default function OrderCard({ order }: Props) {
  const t = useTranslations('orderCard');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const detailId = `order-detail-${order.orderNumber}`;

  const [downloading, setDownloading] = useState(false);

  const formatPrice = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    return (value: number): string => nf.format(value);
  }, [locale]);

  const formatDate = useMemo(() => {
    return (iso: string): string =>
      new Date(iso).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
  }, [locale]);

  const statusLabel = t(`status.${order.status}`);

  // Récupère l'URL hébergée par Stripe (`hosted_invoice_url`) via la
  // route GET /api/account/orders/[id]/invoice. Le navigateur ouvre la
  // page Stripe dans un nouvel onglet — on ne sert PAS le binaire
  // nous-mêmes (pas de proxy à durcir, pas de fuite via cache).
  //
  // Sécurité côté route : auth + ownership (`eq user_id = auth.uid()`)
  // AVANT l'appel Stripe. Un user ne peut pas ouvrir la facture d'un
  // autre, même en bricolant order.id.
  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(
        `/api/account/orders/${order.id}/invoice`,
        { method: 'GET' },
      );
      if (response.status === 404) {
        const payload = (await response.json().catch(() => ({}))) as { code?: string };
        toast({
          title: t('toast.noInvoiceTitle'),
          description:
            payload.code === 'no_invoice'
              ? t('toast.noInvoiceDescNoInvoice')
              : t('toast.noInvoiceDescNotFound'),
        });
        return;
      }
      if (!response.ok) {
        toast({
          title: t('toast.downloadFailedTitle'),
          description: t('toast.downloadFailedRetry'),
          variant: 'destructive',
        });
        return;
      }
      const payload = (await response.json()) as { url?: string };
      if (!payload.url) {
        toast({
          title: t('toast.noInvoiceTitle'),
          description: t('toast.noInvoiceStripeMissing'),
        });
        return;
      }
      // noopener pour éviter window.opener côté Stripe ; rel sur l'iframe
      // n'est pas applicable mais window.open avec ces flags suffit.
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({
        title: t('toast.downloadFailedTitle'),
        description: t('toast.downloadFailedNetwork'),
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      aria-labelledby={`${detailId}-heading`}
      className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id={`${detailId}-heading`} className="text-base font-semibold text-foreground">
            {t('labelPrefix')} {order.orderNumber}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.createdAt)} · {t('servicesCount', { count: order.items.length })}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLASS[order.status]}`}
            aria-label={t('statusAria', { label: statusLabel })}
          >
            {statusLabel}
          </span>
          <span className="text-lg font-bold text-primary">{formatPrice(order.total)}</span>
        </div>
      </header>

      <ul role="list" className="mt-4 space-y-1 text-sm text-muted-foreground">
        {order.items.slice(0, 3).map((item, index) => (
          <li key={`${order.orderNumber}-${index}`}>
            <span className="text-foreground">{item.name}</span>
            <span> — {t(`duration.${item.subscriptionDuration}`)} × {item.quantity}</span>
          </li>
        ))}
        {order.items.length > 3 && (
          <li className="text-xs italic">{t('moreItems', { count: order.items.length - 3 })}</li>
        )}
        {order.items.length === 0 && (
          <li className="text-xs italic">{t('noItems')}</li>
        )}
      </ul>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={detailId}
          className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {expanded ? (
            <>
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
              {t('hideDetails')}
            </>
          ) : (
            <>
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
              {t('showDetails')}
            </>
          )}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleDownload()}
          disabled={downloading}
          aria-busy={downloading || undefined}
        >
          <FileDown aria-hidden="true" className="mr-2 h-4 w-4" />
          {downloading ? t('opening') : t('downloadInvoice')}
        </Button>
      </div>

      {expanded && (
        <div id={detailId} className="mt-5 space-y-5 rounded-md border border-border bg-background/40 p-4">
          <section aria-label={t('servicesSectionAria')}>
            <h4 className="mb-2 text-sm font-semibold text-foreground">{t('servicesSection')}</h4>
            <ul role="list" className="space-y-2">
              {order.items.map((item, index) => (
                <li
                  key={`${order.orderNumber}-detail-${index}`}
                  className="flex flex-col gap-1 rounded-md border border-border bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('itemLine', {
                        duration: t(`duration.${item.subscriptionDuration}`),
                        quantity: item.quantity,
                      })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {formatPrice(item.unitPrice * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t('indicativeTotal')}</p>
          </section>

          {/* FIXME-SECURITY: payment method shown as a static placeholder so
              no fake PAN or last4 ever reaches the DOM. Once Stripe lands,
              this will show the masked card (e.g. "Visa •••• 4242") served
              by stripe.paymentMethods.retrieve on the server. */}
          <section aria-label={t('paymentSectionAria')}>
            <h4 className="mb-2 text-sm font-semibold text-foreground">{t('paymentSection')}</h4>
            <div className="flex items-start gap-3 rounded-md border border-border bg-card/40 p-3 text-sm">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <div>
                <p className="text-foreground">{order.paymentMethodMasked}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('paymentNote')}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
