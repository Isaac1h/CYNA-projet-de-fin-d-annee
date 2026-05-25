import type { Order, OrderFilters } from './types';

const matchesYear = (order: Order, year: string): boolean =>
  year === 'all' || String(order.year) === year;

const matchesStatus = (order: Order, status: OrderFilters['status']): boolean =>
  status === 'all' || order.status === status;

const matchesService = (order: Order, service: string): boolean => {
  if (service === 'all') return true;
  const needle = service.toLowerCase();
  return order.items.some((item) => item.name.toLowerCase().includes(needle));
};

const matchesSearch = (order: Order, search: string): boolean => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  // Order number + product names + both FR and CA date formats — the CA
  // form gives ISO-ish YYYY-MM-DD tokens without depending on Intl locale.
  const hay = [
    order.orderNumber,
    new Date(order.createdAt).toLocaleDateString('fr-FR'),
    new Date(order.createdAt).toLocaleDateString('en-CA'),
    ...order.items.map((item) => item.name),
  ]
    .join(' ')
    .toLowerCase();
  return needle.split(/\s+/).every((token) => hay.includes(token));
};

export const filterOrders = (orders: Order[], filters: OrderFilters): Order[] =>
  orders.filter(
    (order) =>
      matchesYear(order, filters.year) &&
      matchesStatus(order, filters.status) &&
      matchesService(order, filters.service) &&
      matchesSearch(order, filters.search),
  );

export type OrdersByYear = {
  year: number;
  orders: Order[];
};

/** Groups orders by year (descending), each group ordered newest first. */
export const groupOrdersByYear = (orders: Order[]): OrdersByYear[] => {
  const buckets = new Map<number, Order[]>();
  for (const order of orders) {
    const bucket = buckets.get(order.year);
    if (bucket) bucket.push(order);
    else buckets.set(order.year, [order]);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, entries]) => ({
      year,
      orders: entries.sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      ),
    }));
};

/** Returns the list of years present in the orders, descending. */
export const availableYears = (orders: Order[]): number[] =>
  Array.from(new Set(orders.map((order) => order.year))).sort((a, b) => b - a);
