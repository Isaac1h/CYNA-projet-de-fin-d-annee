'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Pagination from '@/components/Pagination';

const PAGE_SIZE = 10;

/**
 * Admin orders table.
 *
 * Reads through the shared anon-key client. The user's session JWT is sent
 * on every request, and the existing `orders_owner_select` /
 * `order_items_owner_select` RLS policies use
 *   `auth.uid() = user_id OR public.is_admin()`
 * which means an admin sees every row while a non-admin sees only their
 * own. No service_role is involved here, so a UI bug or a flipped role
 * cannot leak someone else's orders.
 */

type DbOrderItem = {
  id: string;
  product_name_snapshot: string;
  billing_interval: 'monthly' | 'annual';
  unit_type: 'flat' | 'per_user' | 'per_device';
  unit_amount: number;
  quantity: number;
  line_total: number;
  currency: string;
};

type DbOrder = {
  id: string;
  order_number: string;
  status: 'pending' | 'paid' | 'cancelled' | 'refunded';
  email: string;
  total_amount: number;
  currency: string;
  billing_first_name: string;
  billing_last_name: string;
  billing_line1: string;
  billing_line2: string | null;
  billing_city: string;
  billing_region: string | null;
  billing_postal_code: string;
  billing_country: string;
  billing_phone: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string;
  order_items: DbOrderItem[];
};

const ORDER_COLUMNS =
  'id, order_number, status, email, total_amount, currency, ' +
  'billing_first_name, billing_last_name, billing_line1, billing_line2, ' +
  'billing_city, billing_region, billing_postal_code, billing_country, ' +
  'billing_phone, stripe_checkout_session_id, created_at, ' +
  'order_items(id, product_name_snapshot, billing_interval, unit_type, ' +
  'unit_amount, quantity, line_total, currency)';

const STATUS_LABEL: Record<DbOrder['status'], string> = {
  pending: 'En attente',
  paid: 'Payée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
};

const STATUS_CLASS: Record<DbOrder['status'], string> = {
  pending: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  paid: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  cancelled: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  refunded: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300',
};

const DURATION_LABEL: Record<DbOrderItem['billing_interval'], string> = {
  monthly: 'Mensuel',
  annual: 'Annuel',
};

const UNIT_LABEL: Record<DbOrderItem['unit_type'], string> = {
  flat: 'Forfait',
  per_user: 'Par utilisateur',
  per_device: 'Par appareil',
};

const formatPrice = (cents: number, currency: string): string => {
  const value = cents / 100;
  const code = (currency || 'eur').toUpperCase();
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

export default function OrdersAdminSection() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Pagination locale après le tri serveur (order by created_at desc).
  // Pas de tri/filtre client ici, donc rien à reset à part la longueur
  // de la liste après un reload éventuel.
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedOrders = useMemo(
    () => orders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [orders, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [orders.length]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from('orders')
        .select(ORDER_COLUMNS)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }
      setOrders((data as unknown as DbOrder[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="orders" aria-labelledby="orders-heading" className="space-y-4">
      <header>
        <h2 id="orders-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          Gestion des commandes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lecture seule. Mises à jour de statut à venir.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Liste des commandes, triées de la plus récente à la plus ancienne. Cliquez une ligne pour voir le détail.
          </caption>
          <thead className="bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-8 px-2 py-3" aria-hidden="true" />
              <th scope="col" className="px-4 py-3">Numéro</th>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Client</th>
              <th scope="col" className="px-4 py-3">Statut</th>
              <th scope="col" className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground" aria-live="polite">
                  Chargement…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-destructive" role="alert">
                  Impossible de charger les commandes : {error}
                </td>
              </tr>
            )}
            {!loading && !error && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Aucune commande pour le moment.
                </td>
              </tr>
            )}
            {!loading && !error && pagedOrders.map((order) => {
              const expanded = expandedId === order.id;
              const toggle = () => setExpandedId(expanded ? null : order.id);
              return (
                <Row key={order.id} order={order} expanded={expanded} onToggle={toggle} />
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && !error && totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
            ariaLabel="Pagination du tableau des commandes"
          />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Page {safePage} sur {totalPages} · {orders.length} commande
            {orders.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </section>
  );
}

type RowProps = {
  order: DbOrder;
  expanded: boolean;
  onToggle: () => void;
};

function Row({ order, expanded, onToggle }: RowProps) {
  const billingLine2 = order.billing_line2 ? `, ${order.billing_line2}` : '';
  const billingRegion = order.billing_region ? `, ${order.billing_region}` : '';
  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={`order-detail-${order.id}`}
        className="cursor-pointer hover:bg-secondary/30 focus:outline-none focus-visible:bg-secondary/40"
      >
        <td className="w-8 px-2 py-3 text-muted-foreground">
          {expanded ? (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          )}
        </td>
        <th scope="row" className="px-4 py-3 font-mono font-medium text-foreground">
          {order.order_number}
        </th>
        <td className="px-4 py-3 text-muted-foreground">{formatDate(order.created_at)}</td>
        <td className="px-4 py-3 text-muted-foreground">{order.email}</td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_CLASS[order.status]}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-primary">
          {formatPrice(order.total_amount, order.currency)}
        </td>
      </tr>
      {expanded && (
        <tr id={`order-detail-${order.id}`} className="bg-secondary/20">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Articles
                </h3>
                <ul className="space-y-2">
                  {order.order_items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-1 rounded-md border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.product_name_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {DURATION_LABEL[item.billing_interval]} · {UNIT_LABEL[item.unit_type]} ·{' '}
                          {formatPrice(item.unit_amount, item.currency)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatPrice(item.line_total, item.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Facturation
                </h3>
                <address className="not-italic rounded-md border border-border bg-card p-3 text-sm text-foreground">
                  <p className="font-medium">
                    {order.billing_first_name} {order.billing_last_name}
                  </p>
                  <p className="text-muted-foreground">
                    {order.billing_line1}
                    {billingLine2}
                  </p>
                  <p className="text-muted-foreground">
                    {order.billing_postal_code} {order.billing_city}
                    {billingRegion}
                  </p>
                  <p className="text-muted-foreground">{order.billing_country}</p>
                  {order.billing_phone && (
                    <p className="mt-1 text-muted-foreground">{order.billing_phone}</p>
                  )}
                </address>
                {order.stripe_checkout_session_id && (
                  <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                    Stripe session : {order.stripe_checkout_session_id}
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
