'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * Blocs de texte dynamiques de la home — Ticket 4.
 *
 * Lecture RLS-protégée : `homepage_content_admin_read` (is_admin())
 * expose y compris les blocs désactivés en BO ; `homepage_content_
 * public_read` (is_active) sur la home publique.
 *
 * Écriture : routes /api/admin/home-content* → RPCs admin_*_home_block.
 * Pas de FK entrante → DELETE hard sans piège 23503 (contrairement à
 * categories). ConfirmDialog partagé pour la confirmation.
 */

type Localised = Record<string, string>;

type Block = {
  id: string;
  slug: string;
  title: Localised | null;
  body: Localised | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

const SELECT = 'id, slug, title, body, display_order, is_active, created_at';

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const textareaClass =
  'flex min-h-[6rem] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

type FormState = {
  slug: string;
  title_fr: string;
  title_en: string;
  body_fr: string;
  body_en: string;
  display_order: number;
  is_active: boolean;
};

const emptyForm = (display_order = 0): FormState => ({
  slug: '',
  title_fr: '',
  title_en: '',
  body_fr: '',
  body_en: '',
  display_order,
  is_active: true,
});

function toLocalised(fr: string, en: string): Localised | null {
  const out: Localised = {};
  if (fr.trim()) out.fr = fr.trim();
  if (en.trim()) out.en = en.trim();
  return Object.keys(out).length ? out : null;
}

function fromLocalised(rec: Localised | null, key: 'fr' | 'en'): string {
  return rec?.[key] ?? '';
}

// Mappe les codes Postgres remontés par la RPC en messages UX clairs.
// Aligné sur CategoriesAdminSection — on partage la sémantique code/msg.
function humanizeError(payload: { error?: string; code?: string }): string {
  switch (payload.code) {
    case '23505':
      return 'Ce slug est déjà utilisé par un autre bloc.';
    case '42501':
      return 'Action réservée aux administrateurs.';
    case '22023': {
      const msg = (payload.error ?? '').toLowerCase();
      if (msg.includes('slug must be kebab-case')) {
        return 'Format de slug invalide (minuscules, chiffres, tirets simples).';
      }
      if (msg.includes('slug is required')) return 'Le slug est requis.';
      if (msg.includes('title must')) {
        return 'Le titre est requis (au moins FR ou EN non vide).';
      }
      if (msg.includes('body must')) {
        return 'Le corps de texte est requis (au moins FR ou EN non vide).';
      }
      if (msg.includes('display_order')) {
        return "L'ordre doit être un entier entre 0 et 1000.";
      }
      return `Donnée invalide : ${payload.error ?? 'vérifiez les champs.'}`;
    }
    case 'P0002':
      return 'Bloc introuvable (déjà supprimé ?).';
    default:
      return payload.error ?? 'erreur inconnue';
  }
}

export default function HomeContentAdminSection() {
  const [items, setItems] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Block | null>(null);

  const fetchItems = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('homepage_content')
      .select(SELECT)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setItems((data as Block[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchItems();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  const move = async (id: string, direction: 'up' | 'down') => {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/home-content/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(humanizeError(payload));
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const performDelete = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/home-content/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(humanizeError(payload));
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (block: Block) => {
    setBusyId(block.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/home-content/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !block.is_active }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(humanizeError(payload));
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      id="home-content"
      aria-labelledby="home-content-admin-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="home-content-admin-heading"
            className="text-xl font-bold text-foreground sm:text-2xl"
          >
            Contenu de la home
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Blocs de texte affichés sur la page d&apos;accueil (titre + paragraphe). Ordre géré
            par les flèches. Un bloc désactivé reste visible ici mais disparaît de la home.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setCreating((c) => !c);
            setEditingId(null);
            setActionError(null);
          }}
        >
          <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
          {creating ? 'Annuler' : 'Ajouter un bloc'}
        </Button>
      </header>

      {actionError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      )}

      {creating && (
        <BlockForm
          mode="create"
          initial={emptyForm(items.length * 10)}
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await fetchItems();
          }}
        />
      )}

      {loading ? (
        <div
          aria-busy="true"
          className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          Impossible de charger les blocs : {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Aucun bloc. Cliquez sur « Ajouter un bloc ».
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((block, index) => {
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const titleShown =
              fromLocalised(block.title, 'fr') || fromLocalised(block.title, 'en');
            const bodyPreview =
              fromLocalised(block.body, 'fr') || fromLocalised(block.body, 'en');
            const isEditing = editingId === block.id;

            return (
              <li
                key={block.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {titleShown || (
                          <span className="italic text-muted-foreground">(sans titre)</span>
                        )}
                      </p>
                      <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {block.slug}
                      </span>
                      {!block.is_active && (
                        <span className="rounded-full border border-muted-foreground/40 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                          Désactivé
                        </span>
                      )}
                      <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-xs text-muted-foreground">
                        Ordre {block.display_order}
                      </span>
                    </div>
                    {bodyPreview && (
                      <p className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-line">
                        {bodyPreview}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(block.id, 'up')}
                      disabled={busyId === block.id || isFirst}
                      aria-label={`Monter le bloc ${block.slug}`}
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(block.id, 'down')}
                      disabled={busyId === block.id || isLast}
                      aria-label={`Descendre le bloc ${block.slug}`}
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(isEditing ? null : block.id);
                        setCreating(false);
                        setActionError(null);
                      }}
                    >
                      <Pencil aria-hidden="true" className="mr-1 h-4 w-4" />
                      {isEditing ? 'Fermer' : 'Modifier'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleActive(block)}
                      disabled={busyId === block.id}
                    >
                      {block.is_active ? 'Désactiver' : 'Réactiver'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingDelete(block)}
                      disabled={busyId === block.id}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      aria-label={`Supprimer le bloc ${block.slug}`}
                    >
                      <Trash2 aria-hidden="true" className="mr-1 h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 border-t border-border pt-4">
                    <BlockForm
                      mode="edit"
                      targetId={block.id}
                      initial={{
                        slug: block.slug,
                        title_fr: fromLocalised(block.title, 'fr'),
                        title_en: fromLocalised(block.title, 'en'),
                        body_fr: fromLocalised(block.body, 'fr'),
                        body_en: fromLocalised(block.body, 'en'),
                        display_order: block.display_order,
                        is_active: block.is_active,
                      }}
                      onCancel={() => setEditingId(null)}
                      onSaved={async () => {
                        setEditingId(null);
                        await fetchItems();
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Supprimer le bloc « ${pendingDelete.slug} » ?` : ''}
        description="Le bloc sera définitivement supprimé de la home. Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="destructive"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            const target = pendingDelete;
            setPendingDelete(null);
            void performDelete(target.id);
          }
        }}
      />
    </section>
  );
}

// ── Formulaire (partagé create / edit) ─────────────────────────────

function BlockForm({
  mode,
  initial,
  targetId,
  onCancel,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial: FormState;
  targetId?: string;
  onCancel: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [state, setState] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErr(null);

    const title = toLocalised(state.title_fr, state.title_en);
    const body = toLocalised(state.body_fr, state.body_en);
    if (!title || !body) {
      setErr('Titre ET corps de texte requis (au moins FR ou EN pour chacun).');
      setSubmitting(false);
      return;
    }

    try {
      const url =
        mode === 'create'
          ? '/api/admin/home-content'
          : `/api/admin/home-content/${targetId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const payload =
        mode === 'create'
          ? {
              slug: state.slug.trim().toLowerCase(),
              title,
              body,
              display_order: state.display_order,
              is_active: state.is_active,
            }
          : {
              slug: state.slug.trim().toLowerCase() || null,
              title,
              body,
              display_order: state.display_order,
              is_active: state.is_active,
            };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payloadJson = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(humanizeError(payloadJson));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-card/40 p-4"
      aria-label={mode === 'create' ? 'Nouveau bloc' : 'Modifier le bloc'}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Slug</span>
          <input
            type="text"
            value={state.slug}
            onChange={(e) => setState({ ...state, slug: e.target.value })}
            placeholder="notre-mission"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={`${inputClass} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Ordre d&apos;affichage</span>
          <input
            type="number"
            value={state.display_order}
            onChange={(e) =>
              setState({ ...state, display_order: Number(e.target.value) })
            }
            min={0}
            max={1000}
            required
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Titre (FR)</span>
          <input
            type="text"
            value={state.title_fr}
            onChange={(e) => setState({ ...state, title_fr: e.target.value })}
            placeholder="Notre mission"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Title (EN)</span>
          <input
            type="text"
            value={state.title_en}
            onChange={(e) => setState({ ...state, title_en: e.target.value })}
            placeholder="Our mission"
            className={inputClass}
          />
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Corps de texte (FR)</span>
          <textarea
            value={state.body_fr}
            onChange={(e) => setState({ ...state, body_fr: e.target.value })}
            placeholder="Chez Cyna nous protégeons…"
            className={textareaClass}
          />
          <span className="text-xs text-muted-foreground">
            Les retours à la ligne sont préservés à l&apos;affichage.
          </span>
        </label>

        <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Body (EN)</span>
          <textarea
            value={state.body_en}
            onChange={(e) => setState({ ...state, body_en: e.target.value })}
            placeholder="At Cyna we protect…"
            className={textareaClass}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={state.is_active}
            onChange={(e) => setState({ ...state, is_active: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Actif (affiché sur la home)
        </label>
      </div>

      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting || undefined}
        >
          {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer le bloc' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
