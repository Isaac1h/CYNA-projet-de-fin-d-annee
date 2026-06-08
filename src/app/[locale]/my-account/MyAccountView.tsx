'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import PersonalInfoSection from '@/features/account/PersonalInfoSection';
import AddressBookSection from '@/features/account/AddressBookSection';
import PaymentMethodsSection from '@/features/account/PaymentMethodsSection';
import SubscriptionsSection from '@/features/account/SubscriptionsSection';
import TwoFactorSection from '@/features/account/TwoFactorSection';

const MY_ACCOUNT_PATH = '/my-account';

const AccountSkeleton = () => {
  const t = useTranslations('account.shell');
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="h-48 animate-pulse rounded-lg border border-border bg-card/40"
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">{t('skeleton')}</span>
    </div>
  );
};

export default function MyAccountView() {
  const t = useTranslations('account.shell');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading, currentUser, logout } = useAuth();

  // The /admin middleware redirects here with ?reason=mfa_required when an
  // admin without a verified TOTP factor tries to enter the back-office.
  const mfaRequired = searchParams.get('reason') === 'mfa_required';

  // FIXME-SECURITY: client-side guard, UX only. The real authorisation
  // check will live in the Supabase middleware that validates the JWT in
  // the session cookie before the page renders. Do NOT rely on this
  // useEffect for security; treat it as a redirect-for-UX.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // safeRedirectTarget ensures the `from` we just built is itself a
      // same-origin path (it is, but routed through the guard for
      // symmetry with the rest of the auth flows).
      router.replace({
        pathname: '/login',
        query: { from: safeRedirectTarget(MY_ACCOUNT_PATH) },
      });
    }
  }, [loading, isAuthenticated, router]);

  // Smooth-scroll the user to the 2FA section when the middleware sent
  // them here for enrollment. Runs after auth has settled so the section
  // is actually mounted at the time of the scroll.
  useEffect(() => {
    if (!mfaRequired || loading || !isAuthenticated) return;
    const target = document.getElementById('two-factor');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [mfaRequired, loading, isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (loading || !isAuthenticated || !currentUser) {
    return <AccountSkeleton />;
  }

  return (
    <div className="space-y-10">
      {mfaRequired && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="mb-1 font-medium leading-none tracking-tight">
            {t('mfaRequiredHeading')}
          </p>
          <p className="leading-relaxed">
            {t('mfaRequiredBodyPrefix')}{' '}
            <a href="#two-factor" className="font-medium underline-offset-4 hover:underline">
              {t('mfaSectionLink')}
            </a>{' '}
            {t('mfaRequiredBodyMid')}{' '}
            <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
              /admin
            </Link>
            {t('mfaRequiredBodySuffix')}
          </p>
        </div>
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('connectedAs')}{' '}
            <span className="font-medium text-foreground">{currentUser.email}</span>
          </p>
        </div>
        <Button type="button" variant="outline" onClick={handleLogout} className="self-start sm:self-auto">
          <LogOut aria-hidden="true" className="mr-2 h-4 w-4" />
          {t('logout')}
        </Button>
      </header>

      <nav aria-label={t('nav.aria')} className="rounded-lg border border-border bg-card/40 p-3 text-sm">
        <ul className="flex flex-wrap gap-2">
          <li>
            <a
              href="#personal-info"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.personalInfo')}
            </a>
          </li>
          <li>
            <a
              href="#addresses"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.addresses')}
            </a>
          </li>
          <li>
            <a
              href="#payment-methods"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.paymentMethods')}
            </a>
          </li>
          <li>
            <a
              href="#subscriptions"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.subscriptions')}
            </a>
          </li>
          <li>
            <a
              href="#two-factor"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.twoFactor')}
            </a>
          </li>
          <li>
            <Link
              href="/orders"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('nav.ordersHistory')}
            </Link>
          </li>
        </ul>
      </nav>

      <PersonalInfoSection />
      <AddressBookSection />
      <PaymentMethodsSection />
      <SubscriptionsSection />
      <TwoFactorSection />
    </div>
  );
}
