import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'À propos — Cyna',
  description:
    "Découvrez Cyna, éditeur de solutions de cybersécurité SaaS (SOC, EDR, XDR) pour les entreprises. Notre mission, nos valeurs et notre approche.",
};

export default async function AProposPage() {
  const t = await getTranslations('legal.about');
  return (
    <div className="bg-background py-10 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('subheading')}</p>
        </header>

        <section aria-labelledby="mission" className="mb-10">
          <h2 id="mission" className="mb-3 text-xl font-semibold text-foreground">
            {t('missionHeading')}
          </h2>
          <p className="text-muted-foreground">{t('missionBody')}</p>
        </section>

        <section aria-labelledby="approche" className="mb-10">
          <h2 id="approche" className="mb-3 text-xl font-semibold text-foreground">
            {t('approachHeading')}
          </h2>
          <p className="text-muted-foreground">{t('approachBody')}</p>
        </section>

        <section aria-labelledby="engagements" className="mb-10">
          <h2 id="engagements" className="mb-3 text-xl font-semibold text-foreground">
            {t('commitmentsHeading')}
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t('sovereignty')}</strong> {t('sovereigntyBody')}
            </li>
            <li>
              <strong className="text-foreground">{t('transparency')}</strong>{' '}
              {t('transparencyBody')}
            </li>
            <li>
              <strong className="text-foreground">{t('accessibility')}</strong>{' '}
              {t('accessibilityBody')}
            </li>
          </ul>
        </section>

        <section aria-labelledby="contact" className="mb-10">
          <h2 id="contact" className="mb-3 text-xl font-semibold text-foreground">
            {t('contactHeading')}
          </h2>
          <p className="text-muted-foreground">
            {t('contactBodyPrefix')}{' '}
            <Link
              href="/tools"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('contactBodyLink')}
            </Link>
            {t('contactBodySuffix')}
          </p>
        </section>
      </article>
    </div>
  );
}
