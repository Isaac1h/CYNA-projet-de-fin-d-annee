'use client';

import { type CategoryAverageBasket, formatEurosFromCents } from './adminStats';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 160;
const PADDING_X = 8;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 30;

const SERIES: Array<{
  key: 'monthly_cents' | 'annual_cents' | 'per_user_cents';
  label: string;
  /** Tailwind utility translated to fill colour. */
  className: string;
}> = [
  { key: 'monthly_cents', label: 'Mensuel', className: 'fill-primary' },
  { key: 'annual_cents', label: 'Annuel', className: 'fill-primary/60' },
  { key: 'per_user_cents', label: 'Par utilisateur', className: 'fill-primary/30' },
];

type Props = { data: CategoryAverageBasket[] };

export default function CategoryBasketChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Aucune vente sur la période.
      </p>
    );
  }

  const innerHeight = VIEWBOX_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const innerWidth = VIEWBOX_WIDTH - PADDING_X * 2;
  const groupSlot = innerWidth / data.length;
  const seriesCount = SERIES.length;
  const barWidth = (groupSlot * 0.7) / seriesCount;
  const max = Math.max(
    ...data.flatMap((entry) => [
      entry.monthly_cents ?? 0,
      entry.annual_cents ?? 0,
      entry.per_user_cents ?? 0,
    ]),
    1,
  );

  const description = data
    .map(
      (entry) =>
        `${entry.category_name} : mensuel ${formatEurosFromCents(entry.monthly_cents)}, ` +
        `annuel ${formatEurosFromCents(entry.annual_cents)}, ` +
        `par utilisateur ${formatEurosFromCents(entry.per_user_cents)}`,
    )
    .join('. ');

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="basket-chart-title"
        aria-describedby="basket-chart-desc"
        className="h-48 w-full"
      >
        <title id="basket-chart-title">
          Panier moyen par catégorie et par durée d&apos;abonnement
        </title>
        <desc id="basket-chart-desc">{description}</desc>

        <line
          x1={PADDING_X}
          x2={VIEWBOX_WIDTH - PADDING_X}
          y1={VIEWBOX_HEIGHT - PADDING_BOTTOM}
          y2={VIEWBOX_HEIGHT - PADDING_BOTTOM}
          className="stroke-border"
          strokeWidth="1"
        />

        {data.map((entry, index) => {
          const groupX = PADDING_X + groupSlot * index;
          return (
            <g key={entry.category_id}>
              {SERIES.map((series, seriesIndex) => {
                const value = entry[series.key] ?? 0;
                const height = value === 0 ? 0 : Math.max(1, (value / max) * innerHeight);
                const x =
                  groupX + (groupSlot - barWidth * seriesCount) / 2 + barWidth * seriesIndex;
                const y = VIEWBOX_HEIGHT - PADDING_BOTTOM - height;
                return (
                  <rect
                    key={series.key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx="1"
                    className={series.className}
                    role="presentation"
                  />
                );
              })}
              <text
                x={groupX + groupSlot / 2}
                y={VIEWBOX_HEIGHT - PADDING_BOTTOM + 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: '8px' }}
              >
                {entry.category_name}
              </text>
            </g>
          );
        })}
      </svg>

      <ul aria-hidden="true" className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${series.className}`} aria-hidden="true" />
            {series.label}
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>Panier moyen par catégorie et par durée</caption>
        <thead>
          <tr>
            <th scope="col">Catégorie</th>
            <th scope="col">Mensuel</th>
            <th scope="col">Annuel</th>
            <th scope="col">Par utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry) => (
            <tr key={entry.category_id}>
              <th scope="row">{entry.category_name}</th>
              <td>{formatEurosFromCents(entry.monthly_cents)}</td>
              <td>{formatEurosFromCents(entry.annual_cents)}</td>
              <td>{formatEurosFromCents(entry.per_user_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
