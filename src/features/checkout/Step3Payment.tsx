'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PaymentMethod = 'card' | 'paypal';

type Props = {
  /**
   * Indicative total displayed for UX feedback. FIXME-SECURITY: at the real
   * Stripe integration this number is reference-only — the chargeable amount
   * is the one Stripe Checkout / PaymentIntent receives from our server
   * after re-computing the cart against the catalogue.
   */
  indicativeTotal: number;
  onBack: () => void;
  onConfirmed: () => void;
};

const METHODS: { id: PaymentMethod; icon: typeof CreditCard }[] = [
  { id: 'card', icon: CreditCard },
  { id: 'paypal', icon: Wallet },
];

export default function Step3Payment({ indicativeTotal, onBack, onConfirmed }: Props) {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [processing, setProcessing] = useState(false);

  const formatPrice = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
    });
    return (value: number): string => nf.format(value);
  }, [locale]);

  // The parent CheckoutFlow does the real work via onConfirmed(): POST
  // /api/checkout/session → window.location to the hosted Stripe Checkout.
  // This handler keeps a short simulated wait so the spinner shows before
  // the navigation begins (the actual API round-trip is fast in dev).
  const handleConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setProcessing(false);
    onConfirmed();
  };

  return (
    <form onSubmit={handleConfirm} className="space-y-6" aria-labelledby="step-3-heading">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-3-heading" className="mb-1 text-lg font-semibold text-foreground">
          {t('payment.heading')}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{t('payment.subheading')}</p>

        <fieldset className="mb-6">
          <legend className="sr-only">{t('payment.methodsLegend')}</legend>
          <div role="radiogroup" aria-label={t('payment.methodsLegend')} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {METHODS.map((entry) => {
              const Icon = entry.icon;
              const selected = method === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMethod(entry.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 px-4 py-5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  <Icon aria-hidden="true" className="h-6 w-6" />
                  {t(`payment.methods.${entry.id}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-4">
          <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">{t('payment.notice')}</p>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <span className="text-base font-semibold text-foreground">{t('payment.indicativeAmount')}</span>
          <span className="text-2xl font-bold text-primary" aria-live="polite">
            {formatPrice(indicativeTotal)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('payment.amountFooter')}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBack}
          disabled={processing}
          className="sm:flex-1"
        >
          {t('payment.back')}
        </Button>
        <Button type="submit" size="lg" disabled={processing} className="sm:flex-1">
          {processing ? t('payment.processing') : t('payment.confirm')}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t('payment.stripeNotice')}</p>
    </form>
  );
}
