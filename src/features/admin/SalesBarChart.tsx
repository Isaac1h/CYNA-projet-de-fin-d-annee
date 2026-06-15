'use client';

import { type DailySales, formatEurosFromCents } from './adminStats';

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 140;
const PADDING_Y = 18;
const PADDING_X = 6;

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: '2-digit' }).format(date);
};

/**
 * Formatter d'étiquette d'axe X.
 *
 * Signature (iso, index, total) plutôt que (iso) seule pour permettre
 * un libellé positionnel — typiquement le mode "5 semaines" qui veut
 * "S-4 · S-3 · S-2 · S-1 · S" en fonction de la place dans la série,
 * pas seulement de la date. Pour le mode quotidien on ignore index/total
 * et on tombe sur le format par défaut (jour de semaine abrégé).
 */
export type SalesLabelFormatter = (iso: string, index: number, total: number) => string;
const defaultFormatter: SalesLabelFormatter = (iso) => formatDay(iso);

type Props = {
  data: DailySales[];
  /** Étiquette personnalisée par bar (X-axis + cellule sr-only). */
  formatLabel?: SalesLabelFormatter;
  /** Légende visible au-dessus de la table sr-only — utilisé par les
   *  lecteurs d'écran pour annoncer la nature des entrées. */
  srCaption?: string;
};

export default function SalesBarChart({ data, formatLabel, srCaption }: Props) {
  const labelFor = formatLabel ?? defaultFormatter;
  if (data.length === 0) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Aucune donnée à afficher.
      </p>
    );
  }

  const max = Math.max(...data.map((entry) => entry.amount_cents), 1);
  const innerHeight = VIEWBOX_HEIGHT - PADDING_Y * 2;
  const barCount = data.length;
  const slot = (VIEWBOX_WIDTH - PADDING_X * 2) / barCount;
  const barWidth = slot * 0.6;
  // Label thinning : à 7 bars on affiche toutes les étiquettes ; au-delà
  // (mode "5 semaines" = 35 jours) on n'en montre qu'environ 7 pour ne
  // pas saturer l'axe X. Le tableau sr-only ci-dessous reste exhaustif
  // pour les lecteurs d'écran.
  const labelStride = Math.max(1, Math.ceil(barCount / 7));

  const description = data
    .map((entry, index) => `${labelFor(entry.date, index, data.length)} : ${formatEurosFromCents(entry.amount_cents)}`)
    .join('. ');

  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        role="img"
        aria-labelledby="sales-bar-title"
        aria-describedby="sales-bar-desc"
        className="h-44 w-full text-foreground"
      >
        <title id="sales-bar-title">Ventes des derniers jours</title>
        <desc id="sales-bar-desc">{description}</desc>

        <line
          x1={PADDING_X}
          x2={VIEWBOX_WIDTH - PADDING_X}
          y1={VIEWBOX_HEIGHT - PADDING_Y}
          y2={VIEWBOX_HEIGHT - PADDING_Y}
          className="stroke-border"
          strokeWidth="1"
        />

        {data.map((entry, index) => {
          const height = Math.max(2, (entry.amount_cents / max) * innerHeight);
          const x = PADDING_X + slot * index + (slot - barWidth) / 2;
          const y = VIEWBOX_HEIGHT - PADDING_Y - height;
          return (
            <g key={entry.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="2"
                className="fill-primary"
                role="presentation"
              />
              {index % labelStride === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={VIEWBOX_HEIGHT - PADDING_Y + 12}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  style={{ fontSize: '8px' }}
                >
                  {labelFor(entry.date, index, data.length)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Accessible textual alternative — visible to assistive tech only.
          Le tableau reste exhaustif (une ligne par bar affichée), avec
          les MÊMES libellés que l'axe X pour rester cohérent en mode
          quotidien comme en mode hebdomadaire. */}
      <table className="sr-only">
        <caption>{srCaption ?? 'Ventes des derniers jours'}</caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th scope="col">Montant</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={entry.date}>
              <th scope="row">{labelFor(entry.date, index, data.length)}</th>
              <td>{formatEurosFromCents(entry.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
