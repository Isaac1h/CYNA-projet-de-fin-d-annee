import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import OrdersView from './OrdersView';

export const metadata: Metadata = {
  title: 'Historique des commandes — Cyna',
  description: 'Retrouvez l’historique de vos commandes Cyna et téléchargez vos factures.',
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const t = await getTranslations('orders');
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{t('heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
        </header>
        <OrdersView />
      </div>
    </div>
  );
}
