'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, CreditCard, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import AddCardForm from './AddCardForm';

/**
 * Méthodes de paiement — gestion réelle Stripe (ticket 22).
 *
 * Reads/writes uniquement via les routes /api/account/payment-methods*.
 * AUCUNE donnée carte ne transite par notre app — saisie via Stripe
 * Elements, tokenisée par Stripe.
 *
 * Owner-guard sur chaque route (auth + retrieve + comparaison customer)
 * — pas de logique de sécurité côté client.
 */

type Card = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
};

type ListResponse = { cards: Card[]; defaultCardId: string | null };

const BRAND_LABEL: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
  unknown: 'Card',
};

const formatBrand = (brand: string): string =>
  BRAND_LABEL[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);

const formatExpiry = (m: number, y: number): string =>
  `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`;

export default function PaymentMethodsSection() {
  const t = useTranslations('account.paymentMethods');
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [defaultCardId, setDefaultCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Card | null>(null);
  const [addClientSecret, setAddClientSecret] = useState<string | null>(null);
  const [openingAdd, setOpeningAdd] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const response = await fetch('/api/account/payment-methods');
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      const payload = (await response.json()) as ListResponse;
      setCards(payload.cards);
      setDefaultCardId(payload.defaultCardId);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchCards();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchCards]);

  // Retour de redirection 3DS (rare — Stripe force un full redirect quand
  // l'iframe overlay ne suffit pas). AddCardForm passe return_url =
  // /my-account#payment-methods ; Stripe y ajoute setup_intent / redirect_status.
  // Sans ce hook l'utilisateur reviendrait sur une page qui semble vide et
  // devrait recliquer "Ajouter une carte" alors que la carte est déjà
  // enregistrée côté Stripe.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const setupIntent = params.get('setup_intent');
    const status = params.get('redirect_status');
    if (!setupIntent || !status) return;
    if (status === 'succeeded') {
      toast({ title: t('toastAdded.title'), description: t('toastAdded.desc') });
      void fetchCards();
    } else if (status === 'failed') {
      toast({
        title: t('toastAddFailed.title'),
        description: t('toastAddFailed.desc'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('toastAddPending.title'),
        description: t('toastAddPending.desc'),
      });
      void fetchCards();
    }
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, '', cleanUrl);
  }, [fetchCards, toast, t]);

  const openAdd = async () => {
    setOpeningAdd(true);
    try {
      const response = await fetch('/api/account/payment-methods', { method: 'POST' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      const { clientSecret } = (await response.json()) as { clientSecret: string };
      setAddClientSecret(clientSecret);
    } catch (err) {
      toast({
        title: t('toastPrepareFailedTitle'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setOpeningAdd(false);
    }
  };

  const onAddSuccess = async () => {
    setAddClientSecret(null);
    toast({ title: t('toastAdded.title'), description: t('toastAdded.desc') });
    await fetchCards();
  };

  const performDelete = async (card: Card) => {
    setBusyId(card.id);
    try {
      const response = await fetch(`/api/account/payment-methods/${card.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.status === 404) {
          toast({
            title: t('toastNotFound.title'),
            description: t('toastNotFound.desc'),
          });
        } else {
          throw new Error(payload.error ?? `HTTP ${response.status}`);
        }
      } else {
        toast({
          title: t('toastDeletedTitle'),
          description: `${formatBrand(card.brand)} •••• ${card.last4}`,
        });
      }
      await fetchCards();
    } catch (err) {
      toast({
        title: t('toastDeleteFailedTitle'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const setAsDefault = async (card: Card) => {
    setBusyId(card.id);
    try {
      const response = await fetch(`/api/account/payment-methods/${card.id}/default`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      setDefaultCardId(card.id);
      toast({
        title: t('toastDefaultUpdatedTitle'),
        description: `${formatBrand(card.brand)} •••• ${card.last4}`,
      });
    } catch (err) {
      toast({
        title: t('toastDefaultUpdateFailedTitle'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  // URL absolue pour confirmSetup return_url (cas 3DS qui force une
  // redirection complète — rare avec les cartes tests).
  const returnUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/my-account#payment-methods`
      : '';

  return (
    <section
      id="payment-methods"
      aria-labelledby="payment-methods-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="payment-methods-heading"
            className="text-xl font-bold text-foreground sm:text-2xl"
          >
            {t('heading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
        </div>
        {!addClientSecret && (
          <Button
            type="button"
            size="sm"
            onClick={() => void openAdd()}
            disabled={openingAdd}
            aria-busy={openingAdd || undefined}
          >
            <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
            {openingAdd ? t('preparing') : t('add')}
          </Button>
        )}
      </header>

      {loading ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {t('loadError', { error })}
        </div>
      ) : cards.length === 0 && !addClientSecret ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          {t('emptyState')}
        </div>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const isDefault = card.id === defaultCardId;
            const isBusy = busyId === card.id;
            return (
              <li
                key={card.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary/30 text-muted-foreground"
                  >
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                      {formatBrand(card.brand)} •••• {card.last4}
                      {isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <Star aria-hidden="true" className="h-3 w-3" />
                          {t('defaultBadge')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('expires', { value: formatExpiry(card.exp_month, card.exp_year) })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 self-end sm:self-auto">
                  {!isDefault && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void setAsDefault(card)}
                      disabled={isBusy}
                      aria-label={t('setDefaultAria', { brand: formatBrand(card.brand), last4: card.last4 })}
                    >
                      <CheckCircle2 aria-hidden="true" className="mr-1 h-4 w-4" />
                      {t('setDefault')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingDelete(card)}
                    disabled={isBusy}
                    aria-label={t('deleteAria', { brand: formatBrand(card.brand), last4: card.last4 })}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 aria-hidden="true" className="mr-1 h-4 w-4" />
                    {t('delete')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {addClientSecret && (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            {t('newCardHeading')}
          </h3>
          <AddCardForm
            clientSecret={addClientSecret}
            onSuccess={() => void onAddSuccess()}
            onCancel={() => setAddClientSecret(null)}
            returnUrl={returnUrl}
          />
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? t('confirmDeleteTitle', {
                brand: formatBrand(pendingDelete.brand),
                last4: pendingDelete.last4,
              })
            : ''
        }
        description={
          pendingDelete && pendingDelete.id === defaultCardId
            ? t('confirmDeleteDefaultBody')
            : t('confirmDeleteBody')
        }
        confirmLabel={t('confirmDelete')}
        cancelLabel={t('confirmDeleteCancel')}
        variant="destructive"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            const target = pendingDelete;
            setPendingDelete(null);
            void performDelete(target);
          }
        }}
      />
    </section>
  );
}
