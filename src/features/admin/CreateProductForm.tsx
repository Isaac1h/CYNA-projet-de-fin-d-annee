'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { Category } from '@/lib/data';

/**
 * Formulaire de création d'un nouveau produit (CDC XVI §1.3).
 *
 * Le formulaire est volontairement client-side simple : un POST sur
 * /api/admin/products qui orchestre Stripe + RPC admin_create_product
 * côté serveur. Le composant ne touche jamais à Stripe ni à la base —
 * il valide le payload côté UX (UX-only ; la vraie validation est
 * server-side dans la RPC).
 *
 * Choix UX :
 *   - Slug auto-suggéré depuis le nom (lowercase + tirets) mais
 *     éditable, parce que l'admin peut vouloir un slug court ou
 *     thématique différent du nom marketing.
 *   - 3 plans tarifaires (mensuel/annuel/par utilisateur) chacun en
 *     EUR ; l'utilisateur active ceux qu'il veut (au moins un) et
 *     entre un montant entier. Conversion EUR → centimes au submit.
 *   - Devise verrouillée à EUR — cohérent avec le seed et la route.
 *     Le multi-devise est un autre lot.
 */

type Props = {
  categories: Category[];
  /** Appelé après une création réussie. Le parent recharge sa liste. */
  onCreated: () => Promise<void>;
  /** Permet au parent de fermer le formulaire après une création. */
  onClose: () => void;
};

type PlanKey = 'monthly_flat' | 'annual_flat' | 'monthly_per_user';

type PlanConfig = {
  key: PlanKey;
  label: string;
  billing_interval: 'monthly' | 'annual';
  unit_type: 'flat' | 'per_user';
};

const PLANS: ReadonlyArray<PlanConfig> = [
  { key: 'monthly_flat',     label: 'Mensuel',         billing_interval: 'monthly', unit_type: 'flat'     },
  { key: 'annual_flat',      label: 'Annuel',          billing_interval: 'annual',  unit_type: 'flat'     },
  { key: 'monthly_per_user', label: 'Par utilisateur', billing_interval: 'monthly', unit_type: 'per_user' },
];

const slugify = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const AVAILABILITY_OPTIONS = [
  { value: 'in_stock',     label: 'Disponible immédiatement' },
  { value: 'limited',      label: 'Disponibilité limitée' },
  { value: 'out_of_stock', label: 'Service indisponible' },
] as const;

export default function CreateProductForm({ categories, onCreated, onClose }: Props) {
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? '');
  const [availability, setAvailability] = useState<'in_stock' | 'limited' | 'out_of_stock'>('in_stock');
  const [priority, setPriority] = useState<number>(0);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Map des prix : pour chaque plan, { enabled, amountEuros (string pour
  // permettre l'input vide / partiel). Au submit, on filtre les plans
  // enabled et on convertit en centimes.
  const [plans, setPlans] = useState<Record<PlanKey, { enabled: boolean; amount: string }>>({
    monthly_flat:     { enabled: true,  amount: '' },
    annual_flat:      { enabled: false, amount: '' },
    monthly_per_user: { enabled: false, amount: '' },
  });

  const [submitting, setSubmitting] = useState(false);

  const suggestedSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugTouched ? slug : suggestedSlug;

  const enabledPlans = (Object.keys(plans) as PlanKey[]).filter((k) => plans[k].enabled);

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    effectiveSlug.length > 0 &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveSlug) &&
    categoryId.length > 0 &&
    enabledPlans.length > 0 &&
    enabledPlans.every((k) => {
      const n = Number(plans[k].amount);
      return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
    });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    // Conversion EUR → centimes (l'utilisateur entre en euros entiers
    // pour rester en phase avec l'affichage prix dans le catalogue).
    const pricesPayload = enabledPlans.map((k) => {
      const plan = PLANS.find((p) => p.key === k)!;
      const euros = Number(plans[k].amount);
      return {
        billing_interval: plan.billing_interval,
        unit_type: plan.unit_type,
        unit_amount: Math.round(euros * 100),
      };
    });

    const body = {
      slug: effectiveSlug,
      name: { fr: name.trim() },
      description: description.trim() ? { fr: description.trim() } : null,
      category_id: categoryId, // slug — la route résout l'UUID
      availability,
      priority,
      is_featured: isFeatured,
      is_active: isActive,
      prices: pricesPayload,
    };

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        stripe_product_id?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      toast({
        title: 'Produit créé',
        description: `Slug : ${effectiveSlug}. Stripe Product : ${payload.stripe_product_id ?? '—'}`,
      });
      await onCreated();
      onClose();
    } catch (err) {
      toast({
        title: 'Création impossible',
        description: err instanceof Error ? err.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Créer un nouveau produit"
      className="rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Créer un produit</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Crée le Stripe Product + Prices puis l&apos;enregistre en base de manière
            atomique. Au moins un plan tarifaire est requis.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le formulaire"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="create-product-name" className="mb-1 block text-xs font-medium text-foreground">
            Nom (FR) *
          </label>
          <input
            id="create-product-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. EndpointShield Avancé"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="create-product-slug" className="mb-1 block text-xs font-medium text-foreground">
            Slug * <span className="text-muted-foreground">(kebab-case, dérivé du nom — éditable)</span>
          </label>
          <input
            id="create-product-slug"
            type="text"
            required
            value={effectiveSlug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            placeholder="endpointshield-avance"
            pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
            aria-describedby="create-product-slug-hint"
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p id="create-product-slug-hint" className="mt-1 text-xs text-muted-foreground">
            Détermine l&apos;URL <code>/product/{effectiveSlug || '…'}</code>. Doit être unique.
          </p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="create-product-desc" className="mb-1 block text-xs font-medium text-foreground">
            Description (FR)
          </label>
          <textarea
            id="create-product-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quelques phrases qui résument la valeur du produit."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="create-product-cat" className="mb-1 block text-xs font-medium text-foreground">
            Catégorie *
          </label>
          <select
            id="create-product-cat"
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="create-product-avail" className="mb-1 block text-xs font-medium text-foreground">
            Disponibilité *
          </label>
          <select
            id="create-product-avail"
            value={availability}
            onChange={(e) => setAvailability(e.target.value as typeof availability)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="create-product-prio" className="mb-1 block text-xs font-medium text-foreground">
            Priorité (0–1000)
          </label>
          <input
            id="create-product-prio"
            type="number"
            min={0}
            max={1000}
            step={1}
            value={priority}
            onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex items-end gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary"
            />
            Mis en avant
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary"
            />
            Actif
          </label>
        </div>
      </div>

      <fieldset className="mt-5 rounded-md border border-border bg-secondary/30 p-4">
        <legend className="px-1 text-xs font-medium text-foreground">Prix initiaux (au moins un) *</legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {PLANS.map((plan) => {
            const state = plans[plan.key];
            return (
              <div key={plan.key} className="rounded-md border border-input bg-background p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={state.enabled}
                    onChange={(e) =>
                      setPlans((prev) => ({
                        ...prev,
                        [plan.key]: { ...prev[plan.key], enabled: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary"
                  />
                  {plan.label}
                </label>
                <div className="mt-2">
                  <label
                    htmlFor={`create-product-price-${plan.key}`}
                    className="sr-only"
                  >
                    Montant {plan.label} en euros
                  </label>
                  <div className="relative">
                    <input
                      id={`create-product-price-${plan.key}`}
                      type="number"
                      min={1}
                      step={1}
                      disabled={!state.enabled}
                      value={state.amount}
                      onChange={(e) =>
                        setPlans((prev) => ({
                          ...prev,
                          [plan.key]: { ...prev[plan.key], amount: e.target.value },
                        }))
                      }
                      placeholder="299"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Montant en euros entiers. Converti en centimes côté serveur. Devise verrouillée EUR.
        </p>
      </fieldset>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Annuler
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              Création…
            </>
          ) : (
            <>
              <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
              Créer le produit
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
