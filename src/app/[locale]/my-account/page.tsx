import type { Metadata } from 'next';
import { Suspense } from 'react';
import MyAccountView from './MyAccountView';

export const metadata: Metadata = {
  title: 'Mon compte — Cyna',
  description: 'Gérez vos informations personnelles, vos adresses et vos méthodes de paiement.',
  robots: { index: false, follow: false },
};

export default function MyAccountPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* MyAccountView calls useSearchParams() to read ?reason=mfa_required
            sent by the /admin middleware. Next requires a Suspense boundary
            around any client component that does so, otherwise the route
            falls back to fully dynamic rendering at build time. */}
        <Suspense fallback={null}>
          <MyAccountView />
        </Suspense>
      </div>
    </div>
  );
}
