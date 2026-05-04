import { supabase } from '@/lib/supabase';
import type { Order, OrderItemDuration, OrderStatus } from '@/features/orders/types';

/**
 * Orders data layer.
 *
 * Reads go through `public.orders` with RLS (`auth.uid() = user_id OR
 * is_admin()`) — so the userId argument here is a query hint, not an
 * authorisation check.
 *
 * Writes go EXCLUSIVELY through the `place_order()` RPC (SECURITY DEFINER,
 * defined in migration 20260618130000). The RPC forces `user_id = auth.uid()`,
 * generates `order_number` server-side, recomputes `line_total` and the
 * order total from the items array, and writes the header and the lines
 * atomically. The client cannot bypass these recomputes because no INSERT
 * policy is granted to `authenticated` on either table.
 *
 * Status mapping (DB → UI): the DB enum exposes
 * `pending|paid|cancelled|refunded` but the UI shape kept the legacy
 * tri-state `pending|completed|cancelled`. We translate `paid → completed`
 * and `refunded → cancelled` here so OrderCard renders the right badge
 * colour without a UI rewrite. The next iteration will surface `refunded`
 * explicitly once the Stripe lot exposes credit notes.
 */

type DbStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';
type DbBillingInterval = 'monthly' | 'annual';
type DbPriceUnit = 'flat' | 'per_user' | 'per_device';

type ItemRow = {
  product_name_snapshot: string;
  billing_interval: DbBillingInterval;
  unit_type: DbPriceUnit;
  unit_amount: number;
  quantity: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: DbStatus;
  email: string;
  total_amount: number;
  currency: string;
  created_at: string;
  order_items: ItemRow[];
};

const ORDER_SELECT = `
  id, order_number, status, email, total_amount, currency, created_at,
  order_items (
    product_name_snapshot, billing_interval, unit_type, unit_amount, quantity
  )
`;

const STATUS_MAP: Record<DbStatus, OrderStatus> = {
  pending: 'pending',
  paid: 'completed',
  cancelled: 'cancelled',
  refunded: 'cancelled',
};

const toSubscriptionDuration = (
  interval: DbBillingInterval,
  unitType: DbPriceUnit,
): OrderItemDuration => {
  if (unitType === 'per_user') return 'per_user';
  if (interval === 'annual') return 'annual';
  return 'monthly';
};

const toOrder = (row: OrderRow): Order => {
  const created = new Date(row.created_at);
  const year = Number.isNaN(created.getTime())
    ? new Date().getFullYear()
    : created.getFullYear();
  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    year,
    total: row.total_amount / 100,
    email: row.email,
    status: STATUS_MAP[row.status] ?? 'pending',
    items: row.order_items.map((item) => ({
      name: item.product_name_snapshot,
      quantity: item.quantity,
      subscriptionDuration: toSubscriptionDuration(item.billing_interval, item.unit_type),
      unitPrice: item.unit_amount / 100,
    })),
    paymentMethodMasked: 'Carte bancaire — gérée par Stripe',
  };
};

export async function listOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error(`Supabase listOrders failed: ${error.message}`);
  }
  return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
}

export type PlaceOrderInput = {
  status: DbStatus;
  email: string;
  currency?: string;
  billing: {
    label?: string;
    first_name: string;
    last_name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postal_code: string;
    country: string;
    phone?: string;
  };
  items: Array<{
    /** Product slug as exposed by lib/data/products (= the public id). */
    productSlug?: string;
    name: string;
    subscriptionDuration: OrderItemDuration;
    unitPriceEur: number;
    quantity: number;
  }>;
};

const fromSubscriptionDuration = (
  d: OrderItemDuration,
): { billing_interval: DbBillingInterval; unit_type: DbPriceUnit } => {
  if (d === 'per_user') return { billing_interval: 'monthly', unit_type: 'per_user' };
  if (d === 'annual') return { billing_interval: 'annual', unit_type: 'flat' };
  return { billing_interval: 'monthly', unit_type: 'flat' };
};

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ id: string; orderNumber: string }> {
  // Resolve product slugs → UUIDs (FK target on order_items.product_id).
  // The RPC accepts a null product_id when the cart item has no slug.
  const slugs = input.items
    .map((i) => i.productSlug)
    .filter((s): s is string => Boolean(s));
  let slugToId: Record<string, string> = {};
  if (slugs.length > 0) {
    const { data: products, error: productsErr } = await supabase
      .from('products')
      .select('id, slug')
      .in('slug', slugs);
    if (productsErr) {
      throw new Error(`Supabase placeOrder (slug lookup) failed: ${productsErr.message}`);
    }
    slugToId = Object.fromEntries(
      (products ?? []).map((p) => [(p as { slug: string }).slug, (p as { id: string }).id]),
    );
  }

  const rpcItems = input.items.map((item) => {
    const { billing_interval, unit_type } = fromSubscriptionDuration(item.subscriptionDuration);
    return {
      product_id: item.productSlug ? (slugToId[item.productSlug] ?? null) : null,
      name: item.name,
      billing_interval,
      unit_type,
      unit_amount: Math.round(item.unitPriceEur * 100),
      quantity: item.quantity,
    };
  });

  const { data, error } = await supabase.rpc('place_order', {
    p_status: input.status,
    p_email: input.email,
    p_currency: input.currency ?? 'eur',
    p_billing: input.billing,
    p_items: rpcItems,
  });
  if (error) {
    throw new Error(`Supabase placeOrder failed: ${error.message}`);
  }
  // place_order is RETURNS TABLE — supabase-js exposes that as an array.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; order_number: string }
    | undefined;
  if (!row) {
    throw new Error('Supabase placeOrder returned an empty result.');
  }
  return { id: row.id, orderNumber: row.order_number };
}
