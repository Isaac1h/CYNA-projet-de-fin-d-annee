import type { Metadata } from 'next';
import { Suspense } from 'react';
import RegisterView from './RegisterView';

export const metadata: Metadata = {
  title: 'Inscription — Cyna',
  description: 'Créez votre compte Cyna pour accéder à nos solutions de cybersécurité.',
  robots: { index: false, follow: false },
};

const Fallback = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    {[0, 1, 2, 3].map((row) => (
      <div
        key={row}
        className="h-10 animate-pulse rounded-md border border-border bg-card/40"
        aria-hidden="true"
      />
    ))}
    <span className="sr-only">Chargement de la page d&apos;inscription…</span>
  </div>
);

export default function RegisterPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-background py-12 sm:py-16">
      <div className="w-full max-w-md px-4 sm:px-6">
        <Suspense fallback={<Fallback />}>
          <RegisterView />
        </Suspense>
      </div>
    </div>
  );
}
