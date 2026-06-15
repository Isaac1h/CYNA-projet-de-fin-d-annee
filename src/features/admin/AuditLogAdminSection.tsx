'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

/**
 * Journal d'audit admin — Ticket 44.
 *
 * READ-ONLY. Aucune mutation depuis cette section. La lecture est gatée
 * par la policy `admin_audit_log_admin_read` (is_admin()) — un non-admin
 * verrait 0 lignes même sans cette UI.
 *
 * Pas de route API GET dédiée : on tape directement supabase-js car la
 * policy fait le job. Cohérent avec CategoriesAdminSection /
 * HomeContentAdminSection qui lisent aussi via supabase-js.
 *
 * Pagination LIMIT 50 OFFSET n*50. Filtres serveur-side (entity_type,
 * action, actor_email contient).
 */

type AuditAction = 'create' | 'update' | 'delete' | 'reorder';
type AuditEntity =
  | 'product'
  | 'price'
  | 'category'
  | 'carousel_slide'
  | 'home_block';

type Row = {
  id: string;
  actor_user_id: string | null;
  actor_email: string;
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id: string;
  summary: string;
  diff: unknown;
  created_at: string;
};

const PAGE_SIZE = 50;

const ENTITY_LABEL: Record<AuditEntity, string> = {
  product: 'Produit',
  price: 'Prix',
  category: 'Catégorie',
  carousel_slide: 'Slide',
  home_block: 'Bloc home',
};

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'Création',
  update: 'Mise à jour',
  delete: 'Suppression',
  reorder: 'Réordonnancement',
};

const ACTION_BADGE: Record<AuditAction, string> = {
  create: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  update: 'border-blue-500/40 bg-blue-500/10 text-blue-600',
  delete: 'border-red-500/40 bg-red-500/10 text-red-600',
  reorder: 'border-purple-500/40 bg-purple-500/10 text-purple-600',
};

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AuditLogAdminSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [entityFilter, setEntityFilter] = useState<AuditEntity | ''>('');
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [emailFilter, setEmailFilter] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('admin_audit_log')
      .select(
        'id, actor_user_id, actor_email, action, entity_type, entity_id, summary, diff, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    if (entityFilter) query = query.eq('entity_type', entityFilter);
    if (actionFilter) query = query.eq('action', actionFilter);
    if (emailFilter.trim()) query = query.ilike('actor_email', `%${emailFilter.trim()}%`);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error: queryError, count } = await query.range(from, to);

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setTotal(null);
    } else {
      setError(null);
      setRows((data as Row[]) ?? []);
      setTotal(count ?? null);
    }
    setLoading(false);
  }, [entityFilter, actionFilter, emailFilter, page]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  // Reset page à 0 quand un filtre change (autrement on peut se retrouver
  // sur une page vide si la requête filtrée retourne moins de rows).
  useEffect(() => {
    setPage(0);
  }, [entityFilter, actionFilter, emailFilter]);

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : null;
  const from = page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total ?? Infinity);

  return (
    <section
      id="audit-log"
      aria-labelledby="audit-log-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-2">
        <h2
          id="audit-log-heading"
          className="text-xl font-bold text-foreground sm:text-2xl"
        >
          Journal d&apos;audit
        </h2>
        <p className="text-sm text-muted-foreground">
          Historique des modifications produits, prix, catégories, carrousel et blocs de
          la home. Lecture seule — les lignes sont écrites automatiquement à chaque
          mutation admin (best-effort, ne peut pas bloquer la mutation métier).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Type d&apos;entité</span>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as AuditEntity | '')}
            className={inputClass}
          >
            <option value="">Toutes</option>
            <option value="product">Produit</option>
            <option value="price">Prix</option>
            <option value="category">Catégorie</option>
            <option value="carousel_slide">Slide carrousel</option>
            <option value="home_block">Bloc home</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Action</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
            className={inputClass}
          >
            <option value="">Toutes</option>
            <option value="create">Création</option>
            <option value="update">Mise à jour</option>
            <option value="delete">Suppression</option>
            <option value="reorder">Réordonnancement</option>
          </select>
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Email admin (contient)</span>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="admin@…"
              className={`${inputClass} pl-8`}
            />
          </div>
        </label>
      </div>

      {loading ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="h-40 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          Impossible de charger le journal : {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Aucune entrée pour ces filtres.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2">Date</th>
                <th scope="col" className="px-4 py-2">Admin</th>
                <th scope="col" className="px-4 py-2">Action</th>
                <th scope="col" className="px-4 py-2">Entité</th>
                <th scope="col" className="px-4 py-2">Résumé</th>
                <th scope="col" className="px-4 py-2 text-right">Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-border hover:bg-secondary/20"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.actor_email || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ACTION_BADGE[row.action]}`}
                    >
                      {ACTION_LABEL[row.action]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-xs">
                      {ENTITY_LABEL[row.entity_type]}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {row.entity_id.length > 12
                        ? `${row.entity_id.slice(0, 8)}…`
                        : row.entity_id}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.summary}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelected(row)}
                      aria-label="Voir le détail JSON"
                    >
                      <FileText aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total !== null && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            {from}–{to} sur {total}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              aria-label="Page précédente"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              Précédent
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={
                loading ||
                (totalPages !== null && page >= totalPages - 1)
              }
              aria-label="Page suivante"
            >
              Suivant
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 id="audit-detail-title" className="text-base font-semibold text-foreground">
                Détail de l&apos;entrée
              </h3>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelected(null)}
                aria-label="Fermer"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Date</span>
                <span className="col-span-2">{formatDateTime(selected.created_at)}</span>
                <span className="text-muted-foreground">Admin</span>
                <span className="col-span-2">{selected.actor_email || '—'}</span>
                <span className="text-muted-foreground">Action</span>
                <span className="col-span-2">{ACTION_LABEL[selected.action]}</span>
                <span className="text-muted-foreground">Entité</span>
                <span className="col-span-2">
                  {ENTITY_LABEL[selected.entity_type]}{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    {selected.entity_id}
                  </span>
                </span>
                <span className="text-muted-foreground">Résumé</span>
                <span className="col-span-2">{selected.summary}</span>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Diff (payload envoyé par l&apos;admin)
                </p>
                <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background/60 p-3 text-xs">
                  {selected.diff === null || selected.diff === undefined
                    ? '— (pas de diff pour cette action)'
                    : JSON.stringify(selected.diff, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
