import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ContactForm from '@/features/contact/ContactForm';

export const metadata: Metadata = {
  title: 'Contact & support — Cyna',
  description:
    'Contactez les équipes Cyna ou posez une question rapide à notre assistant en ligne. Nous répondons sous 24 heures ouvrées.',
};

export default async function ToolsPage() {
  const t = await getTranslations('tools');
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('subheading')}
          </p>
        </header>

        <ContactForm />
      </div>
    </div>
  );
}
