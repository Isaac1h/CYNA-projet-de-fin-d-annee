import type { Metadata } from 'next';
import AdminView from './AdminView';

export const metadata: Metadata = {
  title: 'Administration — Cyna',
  description: "Tableau de bord d'administration Cyna : produits, commandes, ventes.",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Espace réservé à l&apos;équipe interne Cyna. Tableau de bord, gestion catalogue et
            suivi des commandes.
          </p>
        </header>
        <AdminView />
      </div>
    </div>
  );
}
