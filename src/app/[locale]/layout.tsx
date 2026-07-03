import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import '../globals.css';
import { Providers } from '@/components/providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import Analytics from '@/components/Analytics';
import ChatbotWidget from '@/components/ChatbotWidget';

/**
 * i18n LOT 1 — root layout par locale.
 *
 * Structure App Router : ce fichier remplace l'ancien src/app/layout.tsx.
 * Toutes les routes utilisateur vivent sous src/app/[locale]/*, les routes
 * API restent sous src/app/api/* (hors [locale]) → aucun préfixe locale
 * sur /api/*, non-régression garantie côté webhook Stripe et routes admin.
 *
 * `<html lang={locale} dir={dir}>` :
 *   - lang injecté pour SEO + a11y (screen readers)
 *   - dir dynamique — prêt pour le lot 2 RTL (ar/he) sans refactor
 */

export const metadata: Metadata = {
  title: 'Cyna — Solutions de Sécurité Entreprise',
  description:
    'Protégez votre organisation avec des plateformes SOC, EDR, XDR et de renseignement sur les menaces.',
};

// Pré-génère les params statiques pour chaque locale (permet aux pages
// server components de rendre statiquement sur chaque langue).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const RTL_LOCALES: ReadonlyArray<string> = ['ar', 'he'];

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Active le rendering statique par locale (perf).
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <CookieConsent />
            <Analytics />
            <ChatbotWidget />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
