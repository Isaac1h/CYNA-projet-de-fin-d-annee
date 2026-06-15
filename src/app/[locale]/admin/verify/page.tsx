import type { Metadata } from 'next';
import { Suspense } from 'react';
import VerifyView from './VerifyView';

export const metadata: Metadata = {
  title: 'Vérification 2FA — Cyna',
  description: "Étape de vérification à deux facteurs pour accéder à l'administration.",
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-md px-4 sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <VerifyView />
        </Suspense>
      </div>
    </div>
  );
}
