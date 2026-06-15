'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Ban, CheckCircle2, Info, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

// Classes copiées de src/components/ui/input.jsx (composant .jsx sans
// types stricts, non-utilisable en TSX sans cast). On garde l'apparence
// shadcn en ligne — 6 champs seulement, refacto plus tard si besoin.
const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Promotions et codes de réduction — Ticket 55.
 *
 * Reads/writes uniquement via /api/admin/promotions*.
 *
 * Stripe = source de vérité. Aucune table locale (même philosophie
 * que le ticket 22 pour les cartes).
 *
 * Pas d'édition : Stripe n'autorise pas la modification d'un coupon
 * (percent_off / amount_off / duration) après création. L'admin doit
 * désactiver et recréer — signalé par un bandeau info dans la carte
 * de création.
 */

type DiscountType = 'percent' | 'amount';
type Duration = 'once' | 'repeating' | 'forever';

type UiPromotion = {
  id: string;
  code: string;
  active: boolean;
  discountType: DiscountType;
  discountValue: number;
  duration: Duration;
  durationInMonths: number | null;
  expiresAt: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  currency: string | null;
  created: number;
};

const DURATION_LABEL: Record<Duration, string> = {
  once: 'Une facture',
  repeating: 'N mois',
  forever: 'Toujours',
};

const formatDiscount = (p: UiPromotion): string => {
  if (p.discountType === 'percent') return `-${p.discountValue}%`;
  const eur = (p.discountValue / 100).toFixed(2);
  return `-${eur} ${(p.currency ?? 'eur').toUpperCase()}`;
};

const formatDurationLabel = (p: UiPromotion): string => {
  if (p.duration === 'repeating' && p.durationInMonths) {
    return `${p.durationInMonths} mois`;
  }
  return DURATION_LABEL[p.duration];
};

const formatExpiry = (ts: number | null): string => {
  if (!ts) return 'Sans expiration';
  return new Date(ts * 1000).toLocaleDateString('fr-FR');
};

const formatRedemptions = (p: UiPromotion): string => {
  if (p.maxRedemptions == null) return `${p.timesRedeemed} / ∞`;
  return `${p.timesRedeemed} / ${p.maxRedemptions}`;
};

export default function PromotionsAdminSection() {
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<UiPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDeactivate, setPendingDeactivate] = useState<UiPromotion | null>(null);

  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('20');
  const [duration, setDuration] = useState<Duration>('once');
  const [durationInMonths, setDurationInMonths] = useState('3');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPromotions = useCallback(
    async (withInactive: boolean) => {
      try {
        const url = withInactive
          ? '/api/admin/promotions?includeInactive=true'
          : '/api/admin/promotions';
        const response = await fetch(url);
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? `HTTP ${response.status}`);
        }
        const payload = (await response.json()) as { promotions: UiPromotion[] };
        setPromotions(payload.promotions);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchPromotions(includeInactive);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPromotions, includeInactive]);

  const resetForm = () => {
    setCode('');
    setDiscountType('percent');
    setDiscountValue('20');
    setDuration('once');
    setDurationInMonths('3');
    setExpiresAt('');
    setMaxRedemptions('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const parsedValue = Number(discountValue);
    const parsedMonths = duration === 'repeating' ? Number(durationInMonths) : undefined;
    const parsedExpires = expiresAt
      ? Math.floor(new Date(expiresAt).getTime() / 1000)
      : null;
    const parsedMax = maxRedemptions ? Number(maxRedemptions) : null;
    const cents =
      discountType === 'amount' ? Math.round(parsedValue * 100) : parsedValue;

    try {
      const response = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue: cents,
          duration,
          durationInMonths: parsedMonths,
          expiresAt: parsedExpires,
          maxRedemptions: parsedMax,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      toast({
        title: 'Code promo créé',
        description: `${code.toUpperCase()} est actif et utilisable au checkout.`,
      });
      resetForm();
      await fetchPromotions(includeInactive);
    } catch (err) {
      toast({
        title: 'Création impossible',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const performDeactivate = async (promo: UiPromotion) => {
    setBusyId(promo.id);
    try {
      const response = await fetch(`/api/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      toast({
        title: 'Code désactivé',
        description: `${promo.code} n'est plus utilisable au checkout.`,
      });
      await fetchPromotions(includeInactive);
    } catch (err) {
      toast({
        title: 'Désactivation impossible',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const sorted = useMemo(
    () => [...promotions].sort((a, b) => b.created - a.created),
    [promotions],
  );

  return (
    <section
      id="promotions"
      aria-labelledby="promotions-heading"
      className="space-y-6"
    >
      <header className="flex flex-col gap-2">
        <h2
          id="promotions-heading"
          className="text-xl font-bold text-foreground sm:text-2xl"
        >
          Promotions et codes de réduction
        </h2>
        <p className="text-sm text-muted-foreground">
          Créez des codes activables au checkout (ex.{' '}
          <code className="rounded bg-secondary px-1">RENTREE24</code>). Les codes sont stockés
          chez Stripe ; Cyna ne conserve aucune configuration locale.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Nouveau code promo
        </h3>
        <div
          role="note"
          className="mb-4 flex items-start gap-2 rounded-md border border-border bg-secondary/30 p-3 text-xs text-muted-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Stripe n&apos;autorise pas l&apos;édition d&apos;un code après création. Pour changer un
            paramètre : désactivez le code puis créez-en un nouveau.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Code</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="RENTREE24"
              required
              minLength={3}
              maxLength={32}
              pattern="[A-Z0-9_\-]{3,32}"
              className={`${inputClass} uppercase`}
              aria-describedby="code-help"
            />
            <span id="code-help" className="text-xs text-muted-foreground">
              3 à 32 caractères : A-Z, 0-9, _ ou -
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Type de réduction</span>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as DiscountType)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="percent">Pourcentage (%)</option>
              <option value="amount">Montant fixe (€)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">
              Valeur ({discountType === 'percent' ? '%' : '€'})
            </span>
            <input
              type="number"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              min={discountType === 'percent' ? 1 : 0.01}
              max={discountType === 'percent' ? 100 : undefined}
              step={discountType === 'percent' ? 1 : 0.01}
              required
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Durée du coupon</span>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as Duration)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="once">Une facture</option>
              <option value="repeating">N mois</option>
              <option value="forever">Toujours</option>
            </select>
          </label>

          {duration === 'repeating' && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Nombre de mois</span>
              <input
                type="number"
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
                min={1}
                max={999}
                required
                className={inputClass}
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Date d&apos;expiration (optionnel)</span>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Utilisations max (optionnel)</span>
            <input
              type="number"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              min={1}
              placeholder="Illimité"
              className={inputClass}
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={submitting} aria-busy={submitting || undefined}>
              {submitting ? 'Création…' : 'Créer le code'}
            </Button>
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Tag aria-hidden="true" className="h-4 w-4" />
            Codes existants
          </h3>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Afficher aussi les codes désactivés
          </label>
        </div>

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
            Impossible de charger les codes : {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            Aucun code {includeInactive ? '' : 'actif'}. Créez-en un ci-dessus.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2">Code</th>
                  <th scope="col" className="px-4 py-2">Réduction</th>
                  <th scope="col" className="px-4 py-2">Durée</th>
                  <th scope="col" className="px-4 py-2">Utilisations</th>
                  <th scope="col" className="px-4 py-2">Expire</th>
                  <th scope="col" className="px-4 py-2">Statut</th>
                  <th scope="col" className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {p.code}
                    </td>
                    <td className="px-4 py-3">{formatDiscount(p)}</td>
                    <td className="px-4 py-3">{formatDurationLabel(p)}</td>
                    <td className="px-4 py-3">{formatRedemptions(p)}</td>
                    <td className="px-4 py-3">{formatExpiry(p.expiresAt)}</td>
                    <td className="px-4 py-3">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          <Ban aria-hidden="true" className="h-3 w-3" />
                          Désactivé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPendingDeactivate(p)}
                          disabled={busyId === p.id}
                          aria-label={`Désactiver le code ${p.code}`}
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        >
                          <Ban aria-hidden="true" className="mr-1 h-4 w-4" />
                          Désactiver
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeactivate !== null}
        title={pendingDeactivate ? `Désactiver le code ${pendingDeactivate.code} ?` : ''}
        description="Le code ne pourra plus être utilisé au checkout. Stripe ne permet pas de le réactiver — si besoin, créez un nouveau code."
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        variant="destructive"
        onCancel={() => setPendingDeactivate(null)}
        onConfirm={() => {
          if (pendingDeactivate) {
            const target = pendingDeactivate;
            setPendingDeactivate(null);
            void performDeactivate(target);
          }
        }}
      />
    </section>
  );
}
