'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { emptyBilling } from './validation';
import StepIndicator from './StepIndicator';
import Step2Billing from './Step2Billing';
import Step3Payment from './Step3Payment';
import type { BillingAddress, CheckoutStep } from './types';

/**
 * Checkout SPA shell.
 *
 * Flow from Lot D onwards:
 *   1. (gated) Checkout requires an authenticated session — Stripe
 *      Subscription mode is bound to a Customer, and the Customer is
 *      pinned on profiles.stripe_customer_id. Anonymous users are
 *      redirected to /login. Guest checkout is dropped.
 *   2. Billing snapshot collected in-app (Step2Billing).
 *   3. "Payer avec Stripe" → POST /api/checkout/session → window.location
 *      to the hosted Stripe Checkout. The cart is NOT cleared here; it
 *      is cleared on /checkout/success once the success_url lands (the
 *      user might cancel from Stripe and come back to /checkout with
 *      the cart intact).
 *
 * The order is created server-side by the Stripe webhook
 * (`checkout.session.completed` → `place_order_for_user`), NOT by this
 * button. The Lot C `place_order()` RPC is no longer reachable from a
 * client session (cf. migration 20260619200000).
 *
 * i18n LOT 1 — Router imported from `@/i18n/navigation` so that all
 * `.replace('/login')` and `.replace('/cart')` calls preserve the active
 * locale prefix. Stripe redirect (`window.location.assign`) is unchanged:
 * the URL Stripe returns is absolute and points to /checkout/success
 * (Stripe's success_url), and next-intl doesn't govern external redirects.
 */

const splitFullName = (fullName?: string): { firstName: string; lastName: string } => {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  const [firstName, ...rest] = parts;
  return { firstName: firstName ?? '', lastName: rest.join(' ') };
};

const FlowSkeleton = () => {
  const t = useTranslations('checkout');
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-12 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
      <div className="h-64 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
      <span className="sr-only">{t('skeletonSr')}</span>
    </div>
  );
};

export default function CheckoutFlow() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const { cartItems, hydrated } = useCart();
  const { isAuthenticated, currentUser, loading } = useAuth();
  const { toast } = useToast();
  const [redirecting, setRedirecting] = useState(false);

  // Skip the legacy Step 1 (Authentification) — guest flow dropped at
  // Lot D. The StepIndicator still has 4 entries: "Authentification"
  // shows as completed by virtue of the redirect that landed us here.
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(2);
  const [billing, setBilling] = useState<BillingAddress>(() => emptyBilling());

  // Force authentication. Stripe Subscription mode requires a Customer,
  // which is bound to a user account. We never let the checkout proceed
  // anonymously from Lot D on.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace({ pathname: '/login', query: { from: '/checkout' } });
    }
  }, [loading, isAuthenticated, router]);

  // Prefill billing from the authenticated profile.
  useEffect(() => {
    if (currentStep > 2) return;
    if (isAuthenticated && currentUser) {
      const { firstName, lastName } = splitFullName(currentUser.full_name);
      setBilling((prev) => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        email: prev.email || currentUser.email,
      }));
    }
  }, [isAuthenticated, currentUser, currentStep]);

  // Guard against direct access with an empty cart.
  useEffect(() => {
    if (!hydrated) return;
    if (cartItems.length === 0) {
      router.replace('/cart');
    }
  }, [hydrated, cartItems.length, router]);

  if (!hydrated || loading) {
    return <FlowSkeleton />;
  }
  if (!isAuthenticated) {
    return <FlowSkeleton />;
  }
  if (cartItems.length === 0) {
    return <FlowSkeleton />;
  }

  const handleBillingDone = (data: BillingAddress) => {
    setBilling(data);
    setCurrentStep(3);
  };

  const handlePaymentConfirmed = async () => {
    if (redirecting) return;
    setRedirecting(true);
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing,
          items: cartItems.map((item) => ({
            productSlug: item.id,
            subscriptionDuration: item.subscriptionDuration,
            quantity: item.quantity,
          })),
        }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      // Leave the SPA. Cart stays intact — /checkout/success will clear
      // it once the user lands back from Stripe.
      window.location.assign(payload.url);
    } catch (err) {
      toast({
        title: t('errorToast.title'),
        description: err instanceof Error ? err.message : t('errorToast.unknown'),
        variant: 'destructive',
      });
      setRedirecting(false);
    }
  };

  return (
    <div className="space-y-10">
      <StepIndicator current={currentStep} />

      <div>
        {currentStep === 2 && (
          <Step2Billing
            initial={billing}
            onBack={() => router.replace('/cart')}
            onContinue={handleBillingDone}
          />
        )}
        {currentStep === 3 && (
          <Step3Payment
            indicativeTotal={cartItems.reduce((sum, item) => {
              const unit =
                item.subscriptionDuration === 'annual'
                  ? (item.price_annual ?? 0)
                  : item.subscriptionDuration === 'per_user'
                    ? (item.price_per_user ?? 0)
                    : (item.price_monthly ?? 0);
              return sum + unit * item.quantity;
            }, 0)}
            onBack={() => setCurrentStep(2)}
            onConfirmed={() => void handlePaymentConfirmed()}
          />
        )}
      </div>

      {redirecting && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {t('redirecting')}
        </p>
      )}
    </div>
  );
}
