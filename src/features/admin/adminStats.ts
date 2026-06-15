import { supabase } from '@/lib/supabase';

/**
 * Loaders for the admin dashboard aggregates.
 *
 * Each loader is a thin wrapper around a `public.admin_*` RPC (see
 * migration `20260619210000_admin_dashboard_rpcs.sql`). The RPCs are
 * SECURITY DEFINER and re-check `public.is_admin()` themselves — a
 * non-admin call raises Postgres errcode 42501 (`forbidden: admin
 * only`). We surface that as a thrown `Error` so the dashboard can
 * render an "Accès refusé" message without leaking row contents.
 *
 * All monetary fields are integer cents. Formatting to euros is the
 * concern of the chart components, not this module.
 */

export type DailySales = {
  date: string; // YYYY-MM-DD
  amount_cents: number;
};

export type CategoryShare = {
  category_id: string;
  category_name: string;
  amount_cents: number;
  /** Fraction 0..1. */
  share: number;
};

export type CategoryAverageBasket = {
  category_id: string;
  category_name: string;
  /** May be NULL when the bucket has no paid items in the window. */
  monthly_cents: number | null;
  annual_cents: number | null;
  per_user_cents: number | null;
};

export type DashboardKpis = {
  revenue_cents: number;
  paid_orders_count: number;
  active_subscriptions_count: number;
  /** NULL when paid_orders_count = 0. */
  average_basket_cents: number | null;
};

type DailySalesRow = {
  day: string;
  amount_cents: number | string;
};

type CategoryShareRow = {
  category_id: string;
  category_name: string;
  amount_cents: number | string;
  share: number | string;
};

type CategoryAverageBasketRow = {
  category_id: string;
  category_name: string;
  monthly_cents: number | null;
  annual_cents: number | null;
  per_user_cents: number | null;
};

type DashboardKpisRow = {
  revenue_cents: number | string;
  paid_orders_count: number | string;
  active_subscriptions_count: number | string;
  average_basket_cents: number | string | null;
};

// Postgres `bigint` and `numeric` come back as strings from PostgREST to
// preserve precision. We re-coerce to JS number — safe here because all
// our aggregates fit in `Number.MAX_SAFE_INTEGER` (a 9-trillion-euro
// revenue would still fit).
const toNumber = (raw: number | string | null | undefined): number => {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toNullableNumber = (raw: number | string | null | undefined): number | null => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function loadDailySales(days = 7): Promise<DailySales[]> {
  const { data, error } = await supabase.rpc('admin_daily_sales', { p_days: days });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DailySalesRow[];
  return rows.map((row) => ({
    date: row.day,
    amount_cents: toNumber(row.amount_cents),
  }));
}

export async function loadCategoryShares(days = 7): Promise<CategoryShare[]> {
  const { data, error } = await supabase.rpc('admin_category_shares', { p_days: days });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CategoryShareRow[];
  return rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    amount_cents: toNumber(row.amount_cents),
    share: toNumber(row.share),
  }));
}

export async function loadCategoryAverageBaskets(days = 7): Promise<CategoryAverageBasket[]> {
  const { data, error } = await supabase.rpc('admin_category_average_baskets', { p_days: days });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as CategoryAverageBasketRow[];
  return rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    monthly_cents: toNullableNumber(row.monthly_cents),
    annual_cents: toNullableNumber(row.annual_cents),
    per_user_cents: toNullableNumber(row.per_user_cents),
  }));
}

export async function loadDashboardKpis(days = 7): Promise<DashboardKpis> {
  const { data, error } = await supabase.rpc('admin_dashboard_kpis', { p_days: days });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as DashboardKpisRow[];
  const row = rows[0];
  if (!row) {
    // Empty result on a single-row function means the RPC returned no
    // rows at all — should never happen because the function unconditionally
    // returns a CTE row, but stay defensive rather than crashing the UI.
    return {
      revenue_cents: 0,
      paid_orders_count: 0,
      active_subscriptions_count: 0,
      average_basket_cents: null,
    };
  }
  return {
    revenue_cents: toNumber(row.revenue_cents),
    paid_orders_count: toNumber(row.paid_orders_count),
    active_subscriptions_count: toNumber(row.active_subscriptions_count),
    average_basket_cents: toNullableNumber(row.average_basket_cents),
  };
}

const EURO = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** Single canonical formatter used by every dashboard component. */
export function formatEurosFromCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return EURO.format(cents / 100);
}
