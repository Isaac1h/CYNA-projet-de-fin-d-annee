import type { Metadata } from 'next';
import { Suspense } from 'react';
import SuccessView from './SuccessView';

export const metadata: Metadata = {
  title: 'Commande confirmée — Cyna',
  description:
    "Confirmation de votre commande après le paiement Stripe. La commande est créée côté serveur par le webhook Stripe.",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage() {
  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        {/* SuccessView reads ?session_id via useSearchParams — Suspense
            is required by Next so the route doesn't fall back to fully
            dynamic at build time. */}
        <Suspense fallback={null}>
          <SuccessView />
        </Suspense>
      </div>
    </div>
  );
}
