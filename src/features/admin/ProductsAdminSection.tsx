'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Power,
  Tag,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getCategories, getProducts, type Category, type Product, type StockStatus } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';
import ConfirmDialog from '@/components/ConfirmDialog';
import CreateProductForm from './CreateProductForm';

// ───────────────────────────────────────────────────────────────────────────
// ANO-004 — Édition de prix (câblage UI sur PATCH /api/admin/prices/[id]).
// La route gère elle-même l'invariant Stripe (create new → flip DB →
// archive old) : on lui envoie juste { unit_amount: <centimes> } et on
// affiche son retour.

type BillingInterval = 'monthly' | 'annual';
type UnitType = 'flat' | 'per_user' | 'per_device';

type ProductPrice = {
  id: string;
  product_id: string;
  billing_interval: BillingInterval;
  unit_type: UnitType;
  unit_amount: number;
  currency: string;
  is_active: boolean;
  stripe_price_id: string | null;
};

const INTERVAL_LABEL: Record<BillingInterval, string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
};

const UNIT_LABEL: Record<UnitType, string> = {
  flat: 'Forfait',
  per_user: 'Par utilisateur',
  per_device: 'Par appareil',
};

// centimes → "12.34" (2 décimales, point comme séparateur — l'input
// accepte aussi la virgule, on normalise au parse).
const centimesToEurStr = (centimes: number): string => (centimes / 100).toFixed(2);

// "12,34" | "12.34" | "12" → 1234 centimes. null si invalide ou ≤ 0.
const parseDraftEurToCentimes = (raw: string): number | null => {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
};

const formatEurDisplay = (centimes: number, currency: string): string => {
  const code = (currency || 'eur').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(
      centimes / 100,
    );
  } catch {
    return `${(centimes / 100).toFixed(2)} ${code}`;
  }
};
// ───────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

type SortKey = 'name' | 'category' | 'price' | 'stock' | 'status';
type SortDirection = 'asc' | 'desc';
type AvailabilityCode = 'in_stock' | 'limited' | 'out_of_stock';
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Tous',
  active: 'Actifs',
  inactive: 'Désactivés',
};

const STOCK_TO_CODE: Record<StockStatus, AvailabilityCode> = {
  'En Stock': 'in_stock',
  'Limité': 'limited',
  'Rupture de Stock': 'out_of_stock',
};

const STOCK_LABEL: Record<AvailabilityCode, string> = {
  in_stock: 'En Stock',
  limited: 'Limité',
  out_of_stock: 'Rupture de Stock',
};

const formatPrice = (value: number): string => `$${value.toLocaleString('fr-FR')}`;

type RowError = { code?: string; message: string };

async function patchProduct(pk_id: string, body: Record<string, unknown>): Promise<RowError | null> {
  const res = await fetch(`/api/admin/products/${pk_id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { code: payload.code, message: payload.error ?? `HTTP ${res.status}` };
}

async function deleteProduct(pk_id: string): Promise<RowError | null> {
  const res = await fetch(`/api/admin/products/${pk_id}`, { method: 'DELETE' });
  if (res.ok) return null;
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { code: payload.code, message: payload.error ?? `HTTP ${res.status}` };
}

export default function ProductsAdminSection() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  // ANO-001/002 : cible courante du dialog de confirmation de suppression.
  // null = dialog fermé. La suppression ne part qu'après confirmation.
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);

  // Admin view shows ALL products, including is_active=false, so soft-deleted
  // rows can be re-activated or hard-deleted from here. Public consumers
  // (catalogue, /search, /category, /product) still hide them.
  const reload = useCallback(async () => {
    const [fetchedProducts, fetchedCategories] = await Promise.all([
      getProducts({ includeInactive: true }),
      getCategories(),
    ]);
    setProducts(fetchedProducts);
    setCategories(fetchedCategories);
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        if (cancelled) return;
        toast({
          title: 'Chargement impossible',
          description: err instanceof Error ? err.message : 'Erreur inconnue',
          variant: 'destructive',
        });
        setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, toast]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories) map.set(category.id, category.name);
    return map;
  }, [categories]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredProducts = useMemo(() => {
    switch (statusFilter) {
      case 'active':
        return products.filter((p) => p.is_active);
      case 'inactive':
        return products.filter((p) => !p.is_active);
      case 'all':
      default:
        return products;
    }
  }, [products, statusFilter]);

  const counts = useMemo(
    () => ({
      all: products.length,
      active: products.filter((p) => p.is_active).length,
      inactive: products.filter((p) => !p.is_active).length,
    }),
    [products],
  );

  const sortedProducts = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    const copy = [...filteredProducts];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'price':
          return (a.price_monthly - b.price_monthly) * direction;
        case 'category': {
          const aName = categoryNameById.get(a.category_id) ?? '';
          const bName = categoryNameById.get(b.category_id) ?? '';
          return aName.localeCompare(bName, 'fr') * direction;
        }
        case 'stock':
          return a.stock_status.localeCompare(b.stock_status, 'fr') * direction;
        case 'status':
          return (Number(b.is_active) - Number(a.is_active)) * direction;
        case 'name':
        default:
          return a.name.localeCompare(b.name, 'fr') * direction;
      }
    });
    return copy;
  }, [filteredProducts, sortKey, sortDirection, categoryNameById]);

  // Pagination locale : on slice APRÈS le tri + filtre. La liste est
  // entièrement chargée (admin voit tout) donc on évite un re-fetch ;
  // changer de page est une simple bascule d'état React.
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = useMemo(
    () => sortedProducts.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sortedProducts, safePage],
  );

  // Reset page 1 à chaque changement de tri / filtre / direction et après
  // un reload de produits (création/suppression). Évite de rester sur une
  // page qui n'existe plus.
  useEffect(() => {
    setPage(1);
  }, [sortKey, sortDirection, statusFilter, products.length]);

  const handleToggleActive = async (product: Product) => {
    setPendingId(product.pk_id);
    const err = await patchProduct(product.pk_id, { is_active: !product.is_active });
    setPendingId(null);
    if (err) {
      toast({
        title: product.is_active ? 'Désactivation impossible' : 'Réactivation impossible',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: product.is_active ? 'Produit désactivé' : 'Produit réactivé',
      description: `${product.name} ${product.is_active ? 'masqué du catalogue.' : 'visible du catalogue.'}`,
    });
    await reload();
  };

  // La suppression part UNIQUEMENT après confirmation explicite via le
  // ConfirmDialog (ANO-001/002). On garde la note "irréversible / commandes
  // figées / Stripe orphelin" dans la description du dialog.
  const performDelete = async (product: Product) => {
    setPendingId(product.pk_id);
    const err = await deleteProduct(product.pk_id);
    setPendingId(null);
    if (err) {
      toast({
        title: 'Suppression impossible',
        description: err.message,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Produit supprimé',
      description: `${product.name} retiré du catalogue.`,
    });
    if (expandedId === product.pk_id) setExpandedId(null);
    await reload();
  };

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const headerButton = (key: SortKey, label: string) => {
    const active = sortKey === key;
    const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {label}
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    );
  };

  return (
    <section id="products" aria-labelledby="products-heading" className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="products-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Gestion des produits
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Modifier le prix, le nom, la disponibilité ou supprimer un produit. Un changement de
            prix crée un nouveau tarif Stripe et archive l&apos;ancien ; les abonnements en cours
            gardent l&apos;ancien tarif jusqu&apos;à leur renouvellement.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            onClick={() => setCreating((open) => !open)}
            aria-expanded={creating}
            aria-controls="create-product-region"
          >
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            {creating ? 'Fermer le formulaire' : 'Créer un produit'}
          </Button>

          <div
            role="radiogroup"
            aria-label="Filtrer par statut"
            className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs"
          >
          {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((key) => {
            const selected = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStatusFilter(key)}
                className={
                  'rounded-sm px-3 py-1.5 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
                  (selected
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                {STATUS_FILTER_LABEL[key]}{' '}
                <span className={selected ? 'opacity-80' : 'text-muted-foreground'}>
                  ({counts[key]})
                </span>
              </button>
            );
          })}
          </div>
        </div>
      </header>

      {creating && (
        <div id="create-product-region">
          <CreateProductForm
            categories={categories}
            onCreated={reload}
            onClose={() => setCreating(false)}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Liste de tous les produits (y compris désactivés). Cliquez sur une colonne pour trier
            ou sur une ligne pour modifier.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-2 py-3" aria-hidden="true" />
              <th scope="col" aria-sort={ariaSort('name')} className="px-4 py-3">
                {headerButton('name', 'Nom')}
              </th>
              <th scope="col" aria-sort={ariaSort('category')} className="px-4 py-3">
                {headerButton('category', 'Catégorie')}
              </th>
              <th scope="col" aria-sort={ariaSort('price')} className="px-4 py-3">
                {headerButton('price', 'Prix mensuel')}
              </th>
              <th scope="col" aria-sort={ariaSort('stock')} className="px-4 py-3">
                {headerButton('stock', 'Stock')}
              </th>
              <th scope="col" aria-sort={ariaSort('status')} className="px-4 py-3">
                {headerButton('status', 'Statut')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {!hydrated && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Chargement…
                </td>
              </tr>
            )}
            {hydrated && sortedProducts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Aucun produit dans le catalogue.
                </td>
              </tr>
            )}
            {pagedProducts.map((product) => {
              const expanded = expandedId === product.pk_id;
              return (
                <Row
                  key={product.pk_id}
                  product={product}
                  categoryName={categoryNameById.get(product.category_id) ?? '—'}
                  categories={categories}
                  expanded={expanded}
                  pending={pendingId === product.pk_id}
                  onToggleExpand={() => setExpandedId(expanded ? null : product.pk_id)}
                  onToggleActive={() => void handleToggleActive(product)}
                  onDelete={() => setPendingDelete(product)}
                  onSaved={async () => {
                    setExpandedId(null);
                    await reload();
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Pagination du tableau des produits"
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Page {safePage} sur {totalPages} · {sortedProducts.length} produit
            {sortedProducts.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Supprimer « ${pendingDelete?.name ?? ''} » ?`}
        description={
          'Cette action est irréversible. Les commandes passées restent ' +
          'préservées avec un libellé figé ; les prix Stripe associés ' +
          'resteront orphelins côté Stripe (à nettoyer dans le dashboard).'
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
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

type RowProps = {
  product: Product;
  categoryName: string;
  categories: Category[];
  expanded: boolean;
  pending: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSaved: () => Promise<void>;
};

function Row({
  product,
  categoryName,
  categories,
  expanded,
  pending,
  onToggleExpand,
  onToggleActive,
  onDelete,
  onSaved,
}: RowProps) {
  return (
    <>
      <tr className={pending ? 'opacity-50' : ''}>
        <td className="w-8 px-2 py-3 text-muted-foreground">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-controls={`product-detail-${product.pk_id}`}
            aria-label={expanded ? `Replier ${product.name}` : `Déplier ${product.name}`}
            className="rounded p-1 hover:bg-secondary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {expanded ? (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </td>
        <th scope="row" className="px-4 py-3 font-medium text-foreground">
          {product.name}
        </th>
        <td className="px-4 py-3 text-muted-foreground">{categoryName}</td>
        <td className="px-4 py-3 text-foreground">{formatPrice(product.price_monthly)}</td>
        <td className="px-4 py-3">
          <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-xs text-foreground">
            {product.stock_status}
          </span>
        </td>
        <td className="px-4 py-3">
          {product.is_active ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">
              Actif
            </span>
          ) : (
            <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
              Désactivé
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleExpand}
              aria-label={`Modifier ${product.name}`}
              disabled={pending}
            >
              <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleActive}
              aria-label={
                product.is_active ? `Désactiver ${product.name}` : `Réactiver ${product.name}`
              }
              title={product.is_active ? 'Désactiver (soft delete)' : 'Réactiver'}
              disabled={pending}
            >
              <Power aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              aria-label={`Supprimer ${product.name}`}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={pending}
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr id={`product-detail-${product.pk_id}`} className="bg-secondary/20">
          <td colSpan={7} className="px-4 py-4">
            <EditForm product={product} categories={categories} onSaved={onSaved} />
          </td>
        </tr>
      )}
    </>
  );
}

type EditFormProps = {
  product: Product;
  categories: Category[];
  onSaved: () => Promise<void>;
};

function EditForm({ product, categories, onSaved }: EditFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description);
  const [availability, setAvailability] = useState<AvailabilityCode>(
    STOCK_TO_CODE[product.stock_status],
  );
  const [priority, setPriority] = useState<number>(product.priority ?? 0);
  const [isActive, setIsActive] = useState<boolean>(product.is_active);
  const [categoryId, setCategoryId] = useState<string>(product.category_id);
  const [submitting, setSubmitting] = useState(false);

  // ANO-004 — état du bloc Prix. Fetch côté useEffect, indépendant du
  // patch produit. La RLS sur public.prices laisse passer l'admin (lecture
  // déjà couverte par la home / catalogue) ; on lit toutes les lignes
  // liées à product_id, actives ou non, pour qu'un admin puisse aussi
  // ré-éditer un prix désactivé.
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);
  // drafts[priceId] = saisie utilisateur en EUROS string (ex. "12.34")
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [priceBusyId, setPriceBusyId] = useState<string | null>(null);
  // Cible courante du ConfirmDialog (changement à confirmer). null = fermé.
  const [pendingPriceChange, setPendingPriceChange] = useState<{
    price: ProductPrice;
    newCentimes: number;
  } | null>(null);

  const fetchPrices = useCallback(async () => {
    const { data, error } = await supabase
      .from('prices')
      .select('id, product_id, billing_interval, unit_type, unit_amount, currency, is_active, stripe_price_id')
      .eq('product_id', product.pk_id)
      .order('billing_interval', { ascending: true })
      .order('unit_type', { ascending: true });
    if (error) {
      setPricesError(error.message);
      setPrices([]);
    } else {
      setPricesError(null);
      const rows = (data as ProductPrice[]) ?? [];
      setPrices(rows);
      // Réinitialise les drafts depuis la valeur persistée — on ne garde
      // jamais un draft qui survit à un refetch (évite les états zombies
      // après un PATCH réussi).
      const nextDrafts: Record<string, string> = {};
      for (const row of rows) nextDrafts[row.id] = centimesToEurStr(row.unit_amount);
      setDrafts(nextDrafts);
    }
    setPricesLoading(false);
  }, [product.pk_id]);

  useEffect(() => {
    void fetchPrices();
  }, [fetchPrices]);

  // Étape 1 : ouvre le ConfirmDialog après validation locale du draft.
  // Aucune requête réseau ici — le PATCH ne part qu'à confirmation.
  const askPriceChange = (price: ProductPrice) => {
    const draft = drafts[price.id] ?? centimesToEurStr(price.unit_amount);
    const newCentimes = parseDraftEurToCentimes(draft);
    if (newCentimes === null) {
      toast({
        title: 'Montant invalide',
        description: 'Saisir un montant en euros strictement positif (ex. 12.34).',
        variant: 'destructive',
      });
      return;
    }
    if (newCentimes === price.unit_amount) {
      // Pas de Stripe call à programmer — la route renverrait
      // 200 replaced:false mais autant épargner l'aller-retour.
      toast({ title: 'Montant inchangé', description: 'Aucune modification à appliquer.' });
      return;
    }
    setPendingPriceChange({ price, newCentimes });
  };

  // Étape 2 : appel PATCH après confirmation. Gère tous les codes du
  // contrat de la route (cf. src/app/api/admin/prices/[id]/route.ts:82+).
  const performPriceChange = async (price: ProductPrice, newCentimes: number) => {
    setPriceBusyId(price.id);
    try {
      const response = await fetch(`/api/admin/prices/${price.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_amount: newCentimes }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as Record<string, unknown>;

      // Cas par cas, dans l'ordre du contrat de la route.
      if (response.status === 200) {
        if (payload.replaced === false) {
          // No-op : la route a court-circuité parce que le montant n'a pas
          // changé. Le check côté askPriceChange aurait dû l'éviter, mais
          // si un autre admin a écrit la même valeur entre temps on tombe
          // ici. Discret.
          return;
        }
        if (payload.deactivation_of_previous === 'failed') {
          toast({
            title: 'Nouveau prix actif, archivage partiel',
            description:
              "Le nouveau Stripe Price est en place mais l'ancien n'a pas pu être archivé. À vérifier dans le Dashboard Stripe.",
            // Variant default = jaune-ish dans le toast système.
          });
        } else {
          toast({
            title: 'Prix mis à jour',
            description:
              `Nouveau tarif ${formatEurDisplay(newCentimes, price.currency)} actif. ` +
              "Les abonnements en cours conservent l'ancien tarif jusqu'à renouvellement.",
          });
        }
        await fetchPrices();
        return;
      }

      // 409 : prix jamais seedé côté Stripe.
      if (response.status === 409) {
        toast({
          title: 'Prix non lié à Stripe',
          description:
            'Cette ligne n’a pas de stripe_price_id. Lancer `node tools/seed-stripe-prices.mjs` puis réessayer.',
          variant: 'destructive',
        });
        return;
      }

      // 502 : Stripe SDK a refusé (step 1 raté). Invariant intact.
      if (response.status === 502) {
        toast({
          title: 'Stripe indisponible',
          description:
            "L'appel Stripe a échoué. Aucune modification n'a été appliquée — réessayer dans quelques instants.",
          variant: 'destructive',
        });
        return;
      }

      // 500 + orphaned_stripe_price_id : step 2 raté → nouveau Price
      // Stripe créé mais DB pas mise à jour. ALERTE haute.
      if (
        response.status === 500 &&
        typeof payload.orphaned_stripe_price_id === 'string'
      ) {
        toast({
          title: 'Échec partiel critique',
          description:
            `Nouveau Stripe Price ${payload.orphaned_stripe_price_id} créé mais base non mise à jour. ` +
            'La DB pointe encore vers l’ancien tarif (invariant tenu). ' +
            'Archiver manuellement ce Price dans le Dashboard Stripe.',
          variant: 'destructive',
        });
        return;
      }

      // 400 / 401 / 403 / 404 / 500 autres : message générique.
      toast({
        title: 'Échec de la modification',
        description:
          (typeof payload.error === 'string' ? payload.error : null) ?? `HTTP ${response.status}`,
        variant: 'destructive',
      });
    } catch (err) {
      toast({
        title: 'Erreur réseau',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPriceBusyId(null);
    }
  };

  // category_id on Product is the SLUG (set by toProduct from row.category.slug).
  // The RPC needs the UUID, so we resolve it from the loaded `categories` list.
  const resolveCategoryUuid = (slug: string): string | undefined =>
    categories.find((c) => c.id === slug)?.id;
  // Bug catcher: getCategories returns Category with `id` = slug too (same
  // convention as Product). The actual UUID is NOT exposed in Category
  // today. So we cannot change category from this form without first
  // surfacing the UUID. For this lot we keep the select read-only — the
  // RPC supports p_category_id but the front cannot send a UUID safely.
  // TODO(admin): surface category UUID in lib/data/categories.ts and
  // re-enable category re-assignment here.

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast({ title: 'Nom requis', description: 'Le nom ne peut pas être vide.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      // Send only fields the user could have changed. JSONB i18n: front
      // is single-language for now; we patch the `fr` key in name +
      // description and let the RPC merge by replacing the whole jsonb.
      // A more granular per-locale patch is out of scope for this lot.
      name: { fr: name.trim() },
      description: { fr: description.trim() },
      availability,
      priority,
      is_active: isActive,
    };
    const err = await patchProduct(product.pk_id, body);
    setSubmitting(false);
    if (err) {
      toast({
        title: 'Sauvegarde impossible',
        description: err.message + (err.code ? ` (${err.code})` : ''),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Produit mis à jour',
      description: `${name.trim()} sauvegardé. Le catalogue public sera revalidé.`,
    });
    await onSaved();
  };

  // resolveCategoryUuid is unused for now (category select is read-only); we
  // reference it once here so TS/ESLint do not complain about the helper
  // staying around for the future re-enable described above.
  void resolveCategoryUuid;

  return (
    <>
    <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-1">
        <label htmlFor={`name-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nom (FR)
        </label>
        <input
          id={`name-${product.pk_id}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`category-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Catégorie (lecture seule pour l&apos;instant)
        </label>
        <select
          id={`category-${product.pk_id}`}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 lg:col-span-2">
        <label htmlFor={`description-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Description (FR)
        </label>
        <textarea
          id={`description-${product.pk_id}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor={`availability-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Disponibilité
        </label>
        <select
          id={`availability-${product.pk_id}`}
          value={availability}
          onChange={(e) => setAvailability(e.target.value as AvailabilityCode)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {(Object.keys(STOCK_LABEL) as AvailabilityCode[]).map((code) => (
            <option key={code} value={code}>
              {STOCK_LABEL[code]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`priority-${product.pk_id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Priorité (0–1000, plus grand = plus haut)
        </label>
        <input
          id={`priority-${product.pk_id}`}
          type="number"
          min={0}
          max={1000}
          value={priority}
          onChange={(e) => setPriority(Number.parseInt(e.target.value, 10) || 0)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id={`active-${product.pk_id}`}
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <label htmlFor={`active-${product.pk_id}`} className="text-sm text-foreground">
          Produit actif (visible du catalogue public)
        </label>
      </div>

      {/* ANO-004 — Section Prix. Une ligne = un row public.prices lié à
          ce produit. La modif passe par PATCH /api/admin/prices/[id]
          (orchestre Stripe Price create + archive). Chaque ligne se
          modifie indépendamment ; pas de bulk submit. */}
      <fieldset className="lg:col-span-2 space-y-2 rounded-md border border-border bg-card/40 p-4">
        <legend className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Tag aria-hidden="true" className="h-3.5 w-3.5" />
          Prix
        </legend>

        {pricesLoading ? (
          <p aria-busy="true" className="text-sm text-muted-foreground">
            Chargement des prix…
          </p>
        ) : pricesError ? (
          <p role="alert" className="text-sm text-destructive">
            Impossible de charger les prix : {pricesError}
          </p>
        ) : prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun prix lié à ce produit.
          </p>
        ) : (
          <ul className="space-y-2">
            {prices.map((price) => {
              const draft = drafts[price.id] ?? centimesToEurStr(price.unit_amount);
              const persisted = centimesToEurStr(price.unit_amount);
              const changed = draft.trim() !== persisted;
              const isBusy = priceBusyId === price.id;
              return (
                <li
                  key={price.id}
                  className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {INTERVAL_LABEL[price.billing_interval]} · {UNIT_LABEL[price.unit_type]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Actuel : {formatEurDisplay(price.unit_amount, price.currency)}
                      {!price.is_active && ' · (inactif)'}
                      {!price.stripe_price_id && ' · ⚠ pas de stripe_price_id'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`price-${price.id}`} className="sr-only">
                      Nouveau montant en euros pour {INTERVAL_LABEL[price.billing_interval]} {UNIT_LABEL[price.unit_type]}
                    </label>
                    <input
                      id={`price-${price.id}`}
                      type="text"
                      inputMode="decimal"
                      value={draft}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [price.id]: e.target.value }))
                      }
                      placeholder="0.00"
                      disabled={isBusy}
                      className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-right text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                    />
                    <span className="text-sm text-muted-foreground">€</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => askPriceChange(price)}
                      disabled={!changed || isBusy}
                      aria-busy={isBusy || undefined}
                    >
                      {isBusy ? 'Mise à jour…' : 'Modifier'}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="px-1 text-[11px] text-muted-foreground">
          Un changement de prix crée un nouveau tarif côté Stripe et archive l&apos;ancien.
          Les abonnements en cours gardent l&apos;ancien tarif jusqu&apos;à renouvellement.
        </p>
      </fieldset>

      <div className="lg:col-span-2 flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>

    <ConfirmDialog
      open={pendingPriceChange !== null}
      title={
        pendingPriceChange
          ? `Modifier le prix ${INTERVAL_LABEL[pendingPriceChange.price.billing_interval]} · ${UNIT_LABEL[pendingPriceChange.price.unit_type]} ?`
          : ''
      }
      description={
        pendingPriceChange
          ? `Ancien : ${formatEurDisplay(pendingPriceChange.price.unit_amount, pendingPriceChange.price.currency)} → Nouveau : ${formatEurDisplay(pendingPriceChange.newCentimes, pendingPriceChange.price.currency)}. ` +
            "Un nouveau Stripe Price sera créé et l'ancien archivé. Les abonnements en cours conservent l'ancien tarif jusqu'à leur prochain renouvellement."
          : ''
      }
      confirmLabel="Confirmer le changement"
      cancelLabel="Annuler"
      variant="default"
      onCancel={() => setPendingPriceChange(null)}
      onConfirm={() => {
        if (pendingPriceChange) {
          const { price, newCentimes } = pendingPriceChange;
          setPendingPriceChange(null);
          void performPriceChange(price, newCentimes);
        }
      }}
    />
    </>
  );
}
