/**
 * Order history domain types.
 *
 * The Cyna front persists orders to `localStorage['orders']` while Supabase
 * is not wired in. Shapes have evolved between iterations of the Checkout
 * tunnel, so the storage layer below normalises whatever it finds into the
 * `Order` shape declared here.
 *
 * When Supabase lands, the source becomes an `orders` table accessed
 * through a typed query and the local normalisation can be deleted — the
 * shape of `Order` stays stable for the rest of the UI.
 */

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export type OrderItemDuration = 'monthly' | 'annual' | 'per_user';

export type OrderItem = {
  name: string;
  quantity: number;
  /** Defaults to monthly when missing. */
  subscriptionDuration: OrderItemDuration;
  unitPrice: number;
};

export type Order = {
  /** UUID Supabase. Required for any route call that targets an order (invoice
   * download, etc.). Le orderNumber reste l'identifiant affiché à l'utilisateur. */
  id: string;
  orderNumber: string;
  /** ISO date string. */
  createdAt: string;
  /** Derived from createdAt at normalisation time. */
  year: number;
  /** Indicative total. The real charge is recomputed server-side at Stripe time. */
  total: number;
  email: string;
  status: OrderStatus;
  items: OrderItem[];
  /** Already masked at the storage layer — never the raw PAN. */
  paymentMethodMasked: string;
};

export type OrderFilters = {
  /** Year as string ("all" or "2026" etc.). */
  year: string;
  /** Service category (e.g. "SOC") or "all". */
  service: string;
  /** Order status or "all". */
  status: OrderStatus | 'all';
  /** Free text matched against order number, item names and date. */
  search: string;
};
