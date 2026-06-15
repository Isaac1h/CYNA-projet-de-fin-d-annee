'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  Package,
  Repeat,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import SalesBarChart, { type SalesLabelFormatter } from './SalesBarChart';
import CategoryBasketChart from './CategoryBasketChart';
import CategoryPieChart from './CategoryPieChart';
import {
  formatEurosFromCents,
  loadCategoryAverageBaskets,
  loadCategoryShares,
  loadDailySales,
  loadDashboardKpis,
  type CategoryAverageBasket,
  type CategoryShare,
  type DailySales,
  type DashboardKpis,
} from './adminStats';
import {
  getCategories,
  getProducts,
  getRupturedProducts,
  type Category,
  type Product,
  type RupturedProduct,
} from '@/lib/data';

// Fenêtres autorisées par le toggle (CDC XVI : 7 jours par défaut,
// extensible à 5 semaines). Les 4 RPC admin_* acceptent p_days jusqu'à
// 365, donc on reste côté front : aucune migration nécessaire.
//
// `bars` = nombre de barres à afficher dans le bar chart "ventes" :
//   - 7d → 7 barres quotidiennes (1 par jour, RPC sortie directement)
//   - 5w → 5 barres HEBDOMADAIRES (CDC XVI texte : "afficher les ventes
//          par semaine sur les 5 dernières semaines"). La RPC renvoie
//          35 lignes quotidiennes triées ASC, on les bucketise par 7 ici.
type WindowChoice = {
  key: '7d' | '5w';
  days: number;
  label: string;
  longLabel: string;
  bars: 'daily' | 'weekly';
};

const WINDOWS: ReadonlyArray<WindowChoice> = [
  { key: '7d', days: 7,  label: '7 jours',    longLabel: '7 derniers jours',    bars: 'daily'  },
  { key: '5w', days: 35, label: '5 semaines', longLabel: '5 dernières semaines', bars: 'weekly' },
];

/**
 * Bucketise un tableau de ventes quotidiennes ASC en N tranches
 * consécutives de `bucketSize` jours, en sommant amount_cents. La date
 * retournée pour chaque bucket = date du PREMIER jour de la tranche
 * (utile pour formatter "S-N · DD/MM" côté label).
 *
 * Tolérant aux séries plus courtes qu'attendues : si la RPC renvoie
 * moins de 35 lignes (cas pathologique), on ignore les buckets vides
 * plutôt que d'écrire un NaN. La RPC garantit la complétude (generate_series
 * + zero-fill, cf. migration 20260619210000) donc le cas normal = 5 buckets
 * pleins de 7 jours.
 */
function bucketDailyToWeekly(
  daily: DailySales[],
  bucketSize: number,
  bucketCount: number,
): DailySales[] {
  const buckets: DailySales[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const slice = daily.slice(i * bucketSize, (i + 1) * bucketSize);
    if (slice.length === 0) continue;
    const sum = slice.reduce((acc, entry) => acc + entry.amount_cents, 0);
    buckets.push({ date: slice[0].date, amount_cents: sum });
  }
  return buckets;
}

/**
 * Libellé d'une barre hebdomadaire. La position dans la série suffit
 * (pas besoin de calculer la différence en semaines avec aujourd'hui :
 * la RPC produit toujours `total` buckets terminant à la semaine en
 * cours, donc `total - 1 - index` est exactement "il y a N semaines").
 *   index = 0     → S-4
 *   index = 1     → S-3
 *   ...
 *   index = 4     → S (semaine en cours)
 * On suffixe par la date de début du bucket en format JJ/MM pour situer.
 */
const formatWeekLabel: SalesLabelFormatter = (iso, index, total) => {
  const weeksAgo = total - 1 - index;
  const tag = weeksAgo === 0 ? 'S' : `S-${weeksAgo}`;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${tag} ${dd}/${mm}`;
};

type DashboardData = {
  kpis: DashboardKpis;
  sales: DailySales[];
  shares: CategoryShare[];
  baskets: CategoryAverageBasket[];
  productsCount: number;
  categoriesCount: number;
  ruptured: RupturedProduct[];
};

type State =
  | { stage: 'loading' }
  | { stage: 'error'; message: string }
  | { stage: 'ready'; data: DashboardData };

export default function DashboardSection() {
  const [windowKey, setWindowKey] = useState<WindowChoice['key']>('7d');
  const window = WINDOWS.find((w) => w.key === windowKey) ?? WINDOWS[0];
  const [state, setState] = useState<State>({ stage: 'loading' });

  useEffect(() => {
    let cancelled = false;
    // Bascule de fenêtre : on remet en loading le temps que les 4 RPC
    // reviennent, sinon l'UI montrerait fugacement les anciennes valeurs
    // sous le nouveau libellé "5 semaines".
    setState({ stage: 'loading' });
    void (async () => {
      try {
        const [kpis, sales, shares, baskets, products, categories, ruptured] = await Promise.all([
          loadDashboardKpis(window.days),
          loadDailySales(window.days),
          loadCategoryShares(window.days),
          loadCategoryAverageBaskets(window.days),
          getProducts() as Promise<Product[]>,
          getCategories() as Promise<Category[]>,
          getRupturedProducts(),
        ]);
        if (cancelled) return;
        setState({
          stage: 'ready',
          data: {
            kpis,
            sales,
            shares,
            baskets,
            productsCount: products.length,
            categoriesCount: categories.length,
            ruptured,
          },
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setState({ stage: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [window.days]);

  return (
    <section id="dashboard" aria-labelledby="dashboard-heading" className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="dashboard-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Tableau de bord ventes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Agrégats sur les {window.longLabel}, calculés côté Supabase à partir des
            commandes payées.
          </p>
        </div>

        {/* Toggle de fenêtre — segmented control accessible. aria-pressed
            sur chaque bouton + role="group" sur le conteneur, plutôt que
            radio/tabs, parce qu'il n'y a pas de contenu groupé séparé :
            l'état d'un seul widget contrôle le dashboard entier. */}
        <div
          role="group"
          aria-label="Fenêtre d'analyse"
          className="inline-flex shrink-0 rounded-md border border-input bg-card p-0.5"
        >
          {WINDOWS.map((w) => {
            const active = w.key === window.key;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setWindowKey(w.key)}
                aria-pressed={active}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </header>

      {state.stage === 'loading' && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="rounded-lg border border-border bg-card/40 p-6 text-sm text-muted-foreground"
        >
          Chargement des statistiques…
        </div>
      )}

      {state.stage === 'error' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="font-medium">Impossible de charger le tableau de bord.</p>
          <p className="mt-1 break-all">{state.message}</p>
          <p className="mt-2 text-muted-foreground">
            Si vous êtes connecté avec un compte non administrateur, les RPC d&apos;agrégation
            refusent par conception (code Postgres 42501).
          </p>
        </div>
      )}

      {state.stage === 'ready' && <ReadyView data={state.data} window={window} />}
    </section>
  );
}

function ReadyView({ data, window }: { data: DashboardData; window: WindowChoice }) {
  const { kpis, sales, shares, baskets, productsCount, categoriesCount, ruptured } = data;
  // En mode hebdomadaire, on regroupe les 35 lignes quotidiennes en 5
  // buckets de 7 jours (CDC XVI). En mode quotidien, on passe les 7
  // lignes telles quelles. Le formatter d'étiquette suit le même switch.
  const isWeekly = window.bars === 'weekly';
  const chartData = isWeekly ? bucketDailyToWeekly(sales, 7, 5) : sales;
  const chartLabelFormatter = isWeekly ? formatWeekLabel : undefined;
  const chartCaption = isWeekly
    ? 'Ventes des 5 dernières semaines, regroupées par semaine'
    : 'Ventes des 7 derniers jours';
  return (
    <>
      {/* Ticket 45 — bandeau alerte rupture stock. Rendu conditionnel :
          disparaît quand 0 produit en rupture. Liste les produits en
          rupture (actifs uniquement) avec lien vers #products pour
          scroll vers la section édition. */}
      {ruptured.length > 0 && <RuptureAlertBanner items={ruptured} />}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi
          icon={<TrendingUp aria-hidden="true" className="h-4 w-4 text-primary" />}
          label={`Revenu ${window.label}`}
        >
          {formatEurosFromCents(kpis.revenue_cents)}
        </Kpi>
        <Kpi icon={<Users aria-hidden="true" className="h-4 w-4 text-primary" />} label="Panier moyen">
          {formatEurosFromCents(kpis.average_basket_cents)}
        </Kpi>
        <Kpi icon={<CreditCard aria-hidden="true" className="h-4 w-4 text-primary" />} label="Commandes payées">
          {kpis.paid_orders_count.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<Repeat aria-hidden="true" className="h-4 w-4 text-primary" />} label="Abonnements actifs">
          {kpis.active_subscriptions_count.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<Package aria-hidden="true" className="h-4 w-4 text-primary" />} label="Produits actifs">
          {productsCount.toLocaleString('fr-FR')}
        </Kpi>
        <Kpi icon={<ShieldCheck aria-hidden="true" className="h-4 w-4 text-primary" />} label="Catégories">
          {categoriesCount.toLocaleString('fr-FR')}
        </Kpi>
        <RuptureKpi count={ruptured.length} />
      </dl>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-3 text-base font-semibold text-foreground">
            {isWeekly ? 'Ventes par semaine' : 'Ventes par jour'}
          </h3>
          <SalesBarChart
            data={chartData}
            formatLabel={chartLabelFormatter}
            srCaption={chartCaption}
          />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-foreground">Part par catégorie</h3>
          <CategoryPieChart data={shares} />
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-3">
          <h3 className="mb-3 text-base font-semibold text-foreground">Panier moyen par catégorie</h3>
          <CategoryBasketChart data={baskets} />
        </div>
      </div>
    </>
  );
}

function Kpi({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-xl font-bold text-foreground sm:text-2xl">{children}</dd>
    </div>
  );
}

/**
 * Ticket 45 — KPI dédiée aux ruptures de stock.
 * Vert quand 0 (état sain), rouge quand > 0 (action requise). Toujours
 * affichée pour donner un signal de statut permanent.
 */
function RuptureKpi({ count }: { count: number }) {
  const isAlert = count > 0;
  return (
    <div
      className={`rounded-lg border p-4 ${
        isAlert
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-emerald-500/40 bg-emerald-500/5'
      }`}
    >
      <dt
        className={`flex items-center gap-2 text-xs ${
          isAlert ? 'text-destructive' : 'text-emerald-700'
        }`}
      >
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        Produits en rupture
      </dt>
      <dd
        className={`mt-1 text-xl font-bold sm:text-2xl ${
          isAlert ? 'text-destructive' : 'text-emerald-700'
        }`}
      >
        {count.toLocaleString('fr-FR')}
      </dd>
    </div>
  );
}

/**
 * Ticket 45 — bandeau détaillé listant les produits en rupture. Rendu
 * uniquement si items.length > 0 (contrôle côté parent). Chaque ligne
 * renvoie vers #products pour scroll vers la section édition. Un onglet
 * dédié aurait été redondant — l'action naturelle est de modifier le
 * produit dans ProductsAdminSection existant.
 */
function RuptureAlertBanner({ items }: { items: RupturedProduct[] }) {
  const formatSince = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diffMs / 3_600_000);
    if (hours < 1) return "il y a moins d'une heure";
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  };

  return (
    <div
      role="alert"
      aria-labelledby="rupture-banner-heading"
      className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
        />
        <div className="flex-1">
          <h3
            id="rupture-banner-heading"
            className="text-sm font-semibold text-destructive"
          >
            {items.length} produit{items.length > 1 ? 's' : ''} en rupture de stock
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-destructive/20 bg-background/60 px-3 py-2"
              >
                <span className="text-foreground">
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    (dernière MAJ {formatSince(item.updated_at)})
                  </span>
                </span>
                <Link
                  href="#products"
                  className="text-xs font-medium text-destructive underline underline-offset-2 hover:text-destructive/80"
                >
                  Modifier →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
