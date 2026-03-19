import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginView from './LoginView';

export const metadata: Metadata = {
  title: 'Connexion — Cyna',
  description: 'Connectez-vous à votre compte Cyna pour accéder à vos commandes et préférences.',
  robots: { index: false, follow: false },
};

const Fallback = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <span className="sr-only">Chargement de la page de connexion…</span>
  </div>
);

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background py-12 sm:py-16">
      <div className="w-full max-w-md px-4 sm:px-6">
        <Suspense fallback={<Fallback />}>
          <LoginView />
        </Suspense>
      </div>
    </div>
  );
}
