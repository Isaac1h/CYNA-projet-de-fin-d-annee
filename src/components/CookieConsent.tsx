'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Bannière de consentement cookies.
 *
 * Storage : localStorage (clé `cyna-cookie-consent`, valeurs `'accepted'` |
 * `'rejected'`).
 *
 * Ticket 35 — mesure d'audience Plausible câblée sur ce consent.
 * `Analytics.tsx` écoute l'event `cyna-cookie-consent-changed` dispatché
 * ici par decide() ET l'event natif `storage` pour la synchro cross-tab.
 *
 * i18n LOT 1 Bloc A — libellés externalisés (namespace `cookieConsent`).
 */

const STORAGE_KEY = 'cyna-cookie-consent';
const CONSENT_EVENT = 'cyna-cookie-consent-changed';
type Choice = 'accepted' | 'rejected';

export default function CookieConsent() {
  const t = useTranslations('cookieConsent');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== 'accepted' && stored !== 'rejected') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const decide = (choice: Choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Storage indisponible — on ferme le bandeau quand même.
    }
    try {
      window.dispatchEvent(
        new CustomEvent(CONSENT_EVENT, { detail: { choice } }),
      );
    } catch {
      // CustomEvent indisponible — fallback silencieux.
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-primary/40 bg-secondary text-secondary-foreground"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5 lg:px-8">
        <div className="flex-1">
          <h2 id="cookie-consent-title" className="text-base font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('body')}{' '}
            <Link
              href="/confidentialite"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('learnMore')}
            </Link>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={() => decide('rejected')}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
