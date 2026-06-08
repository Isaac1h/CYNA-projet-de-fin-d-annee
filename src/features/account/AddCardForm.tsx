'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { getStripeJs } from '@/lib/stripe-browser';

/**
 * Wrapper Stripe Elements pour l'ajout d'une carte.
 *
 * Reçoit le clientSecret d'un SetupIntent déjà créé côté serveur
 * (POST /api/account/payment-methods). On instancie Elements ICI
 * (pas au niveau de PaymentMethodsSection) pour que la promesse
 * loadStripe ne se déclenche qu'au moment où l'utilisateur clique
 * vraiment sur "Ajouter une carte" — gain de bundle + zéro requête
 * Stripe.js tant que la section reste fermée.
 *
 * confirmSetup avec redirect:'if_required' : 3DS se fait via iframe
 * overlay tant que possible. Si une carte exige une redirection
 * complète (rare), on passe return_url = page courante et un useEffect
 * côté PaymentMethodsSection détectera le retour via query params.
 */

type Props = {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  returnUrl: string;
};

export default function AddCardForm({ clientSecret, onSuccess, onCancel, returnUrl }: Props) {
  return (
    <Elements
      stripe={getStripeJs()}
      options={{
        clientSecret,
        appearance: { theme: 'night', labels: 'floating' },
      }}
    >
      <InnerForm onSuccess={onSuccess} onCancel={onCancel} returnUrl={returnUrl} />
    </Elements>
  );
}

function InnerForm({
  onSuccess,
  onCancel,
  returnUrl,
}: Omit<Props, 'clientSecret'>) {
  const t = useTranslations('account.addCard');
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setSubmitting(true);

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    if (confirmError) {
      // confirmError.message vient déjà localisé par Stripe selon la
      // langue du navigateur — on relaie tel quel.
      setError(confirmError.message ?? t('errorGeneric'));
      setSubmitting(false);
      return;
    }

    // Si on arrive ici sans redirect, le setupIntent est résolu — la
    // carte est attachée au customer côté Stripe. Le parent rafraîchit
    // la liste via GET /api/account/payment-methods.
    if (setupIntent && setupIntent.status === 'succeeded') {
      setSubmitting(false);
      onSuccess();
      return;
    }

    // Cas exotique : pas d'erreur mais statut non-succeeded
    // (processing / requires_action sans redirect). On surface un
    // message neutre et on laisse l'utilisateur réessayer.
    setError(t('errorProcessing'));
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label={t('formAria')}>
      <PaymentElement />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!stripe || !elements || submitting}
          aria-busy={submitting || undefined}
        >
          {submitting ? t('submitting') : t('submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('cancel')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('footer')}</p>
    </form>
  );
}
