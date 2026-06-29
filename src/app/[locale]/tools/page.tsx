import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ContactForm from '@/features/contact/ContactForm';
import ChatbotShell from '@/features/contact/ChatbotShell';

export const metadata: Metadata = {
  title: 'Contact & support — Cyna',
  description:
    'Contactez les équipes Cyna ou posez une question rapide à notre assistant en ligne. Nous répondons sous 24 heures ouvrées.',
  // Public page — indexable on purpose: this is the entry door to the
  // support funnel and we want it to surface on "contact Cyna" queries.
};

export default async function ToolsPage() {
  const t = await getTranslations('tools');
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            {t('subheading')}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <ContactForm />
          <ChatbotShell />
        </div>
      </div>
    </div>
  );
}
