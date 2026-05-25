'use client';

import { useTranslations } from 'next-intl';
import type { Order } from './types';
import OrderCard from './OrderCard';
import { groupOrdersByYear } from './filtering';

type Props = { orders: Order[] };

export default function OrdersGroupedList({ orders }: Props) {
  const t = useTranslations('orders');
  const groups = groupOrdersByYear(orders);

  return (
    <div className="space-y-10">
      {groups.map(({ year, orders: yearOrders }) => (
        <section key={year} aria-labelledby={`orders-year-${year}`}>
          <h2
            id={`orders-year-${year}`}
            className="mb-4 border-b border-border pb-2 text-lg font-semibold text-foreground"
          >
            {year}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t('yearGroupCount', { count: yearOrders.length })}
            </span>
          </h2>
          <ul role="list" className="space-y-3">
            {yearOrders.map((order) => (
              <li key={order.orderNumber}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
