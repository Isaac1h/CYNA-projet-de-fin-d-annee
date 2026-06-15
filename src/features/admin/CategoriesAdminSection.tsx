'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * Catégories — édition admin.
 *
 * Lecture via `categories_public_read` + `categories_admin_read` (admin
 * voit tout y compris inactives, public uniquement actives).
 *
 * Écriture : routes /api/admin/categories* → RPCs SECURITY DEFINER.
 *
 * Cas 23503 sur DELETE : la FK products.category_id RESTRICT bloque la
 * suppression si au moins un produit est lié. On catch 23503 dans le
 * handler côté UI et on propose "Désactiver" (= PATCH is_active=false).
 *
 * Cas 23505 sur CREATE / UPDATE : conflit de slug (citext UNIQUE). On
 * affiche un message clair "slug déjà utilisé".
 */

type Localised = Record<string, string>;

type Category = {
  id: string;
  slug: string;
  name: Localised | null;
  description: Localised | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

const SELECT = 'id, slug, name, description, image_url, display_order, is_active, created_at';

type FormState = {
  slug: string;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  image_url: string;
  display_order: number;
  is_active: boolean;
};

const emptyForm = (display_order = 0): FormState => ({
  slug: '',
  name_fr: '',
  name_en: '',
  description_fr: '',
  description_en: '',
  image_url: '',
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

// Mappe les codes Postgres en messages UX clairs.
//
// ANO-003(a) : 22023 couvre plusieurs cas de validation côté RPC
// (slug requis, slug non kebab-case, name vide, display_order hors plage,
// etc.). On inspecte le message renvoyé par la RPC pour distinguer le
// motif et NE PAS afficher "déjà utilisé" sur un slug mal formé.
function humanizeError(payload: { error?: string; code?: string }): string {
  switch (payload.code) {
    case '23505':
      return 'Ce slug est déjà utilisé par une autre catégorie.';
    case '23503':
      return 'Cette catégorie contient des produits ; elle ne peut pas être supprimée.';
    case '42501':
      return 'Action réservée aux administrateurs.';
    case '22023': {
      const msg = (payload.error ?? '').toLowerCase();
      if (msg.includes('slug must be kebab-case')) {
        return 'Format de slug invalide (minuscules, chiffres, tirets simples).';
      }
      if (msg.includes('slug is required')) {
        return 'Le slug est requis.';
      }
      if (msg.includes('name must')) {
        return 'Le nom est requis (au moins une langue : FR ou EN).';
      }
      if (msg.includes('description must')) {
        return 'La description doit être un objet JSON valide.';
      }
      if (msg.includes('display_order')) {
        return "L'ordre doit être un entier compris entre 0 et 1000.";
      }
      return `Donnée invalide : ${payload.error ?? 'vérifiez les champs.'}`;
    }
    case 'P0002':
      return 'Catégorie introuvable (déjà supprimée ?).';
    default:
      return payload.error ?? 'erreur inconnue';
  }
}

export default function CategoriesAdminSection() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [softDeleteOffer, setSoftDeleteOffer] = useState<string | null>(null);
  // ANO-001/002 : cible courante du dialog de confirmation de suppression.
  // null = dialog fermé. La suppression ne part qu'après confirmation.
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  const fetchItems = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('categories')
      .select(SELECT)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setItems((data as Category[]) ?? []);
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
      const response = await fetch(`/api/admin/categories/${id}/move`, {
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

  // La suppression part UNIQUEMENT après confirmation explicite via le
  // ConfirmDialog (ANO-001/002). Le comportement existant "23503 → propose
  // de désactiver" est conservé : il s'ajoute APRÈS la confirmation, pas
  // à la place.
  const performDelete = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    setSoftDeleteOffer(null);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (payload.code === '23503') {
          // FK RESTRICT : on propose le soft delete à la place.
          setSoftDeleteOffer(id);
          return;
        }
        throw new Error(humanizeError(payload));
      }
      await fetchItems();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (cat: Category) => {
    setBusyId(cat.id);
    setActionError(null);
    setSoftDeleteOffer(null);
    try {
      const response = await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active }),
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
      id="categories"
      aria-labelledby="categories-admin-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="categories-admin-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Catégories
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Catégories utilisées par la home et le catalogue. Une catégorie liée à des produits
            ne peut pas être supprimée — désactivez-la à la place.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setCreating((c) => !c);
            setEditingId(null);
          }}
        >
          <Plus aria-hidden="true" className="mr-1 h-4 w-4" />
          {creating ? 'Annuler' : 'Ajouter une catégorie'}
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
        <CategoryForm
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
        <div aria-busy="true" className="h-32 animate-pulse rounded-lg border border-border bg-card/40" />
      ) : error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de charger les catégories : {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Aucune catégorie. Cliquez sur « Ajouter une catégorie ».
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((cat, index) => {
            const isFirst = index === 0;
            const isLast = index === items.length - 1;
            const nameFr = fromLocalised(cat.name, 'fr') || fromLocalised(cat.name, 'en');
            const offerSoftDelete = softDeleteOffer === cat.id;

            return (
              <li key={cat.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt=""
                      aria-hidden="true"
                      className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground"
                    >
                      Aucune image
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {nameFr || <span className="italic text-muted-foreground">(sans nom)</span>}
                      </p>
                      <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {cat.slug}
                      </span>
                      {!cat.is_active && (
                        <span className="rounded-full border border-muted-foreground/40 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                          Désactivée
                        </span>
                      )}
                      <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-xs text-muted-foreground">
                        Ordre {cat.display_order}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(cat.id, 'up')}
                      disabled={isFirst || busyId === cat.id}
                      aria-label="Monter la catégorie"
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(cat.id, 'down')}
                      disabled={isLast || busyId === cat.id}
                      aria-label="Descendre la catégorie"
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleActive(cat)}
                      disabled={busyId === cat.id}
                    >
                      {cat.is_active ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(editingId === cat.id ? null : cat.id);
                        setCreating(false);
                      }}
                      disabled={busyId === cat.id}
                    >
                      <Pencil aria-hidden="true" className="mr-1 h-4 w-4" />
                      Éditer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(cat)}
                      disabled={busyId === cat.id}
                      aria-label="Supprimer la catégorie"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {offerSoftDelete && (
                  <div
                    role="alertdialog"
                    aria-labelledby={`soft-delete-${cat.id}-heading`}
                    className="mt-4 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-3 text-sm"
                  >
                    <p
                      id={`soft-delete-${cat.id}-heading`}
                      className="font-medium text-foreground"
                    >
                      Cette catégorie contient des produits
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Suppression bloquée par la contrainte d&apos;intégrité. Vous pouvez la
                      <span className="font-medium text-foreground"> désactiver</span> : elle
                      disparaît de la home et du catalogue mais ses produits gardent leur
                      référence. Réversible.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setSoftDeleteOffer(null);
                          void toggleActive(cat);
                        }}
                        disabled={busyId === cat.id}
                      >
                        Désactiver la catégorie
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSoftDeleteOffer(null)}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                {editingId === cat.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    <CategoryForm
                      mode="update"
                      categoryId={cat.id}
                      initial={{
                        slug: cat.slug,
                        name_fr: fromLocalised(cat.name, 'fr'),
                        name_en: fromLocalised(cat.name, 'en'),
                        description_fr: fromLocalised(cat.description, 'fr'),
                        description_en: fromLocalised(cat.description, 'en'),
                        image_url: cat.image_url ?? '',
                        display_order: cat.display_order,
                        is_active: cat.is_active,
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
        title={`Supprimer la catégorie « ${
          fromLocalised(pendingDelete?.name ?? null, 'fr') ||
          fromLocalised(pendingDelete?.name ?? null, 'en') ||
          pendingDelete?.slug ||
          'sans nom'
        } » ?`}
        description="Si cette catégorie contient des produits, la suppression sera bloquée et vous serez invité à la désactiver à la place."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="destructive"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            const id = pendingDelete.id;
            setPendingDelete(null);
            void performDelete(id);
          }
        }}
      />
    </section>
  );
}

type FormProps =
  | {
      mode: 'create';
      initial: FormState;
      onCancel: () => void;
      onSaved: () => Promise<void>;
    }
  | {
      mode: 'update';
      categoryId: string;
      initial: FormState;
      onCancel: () => void;
      onSaved: () => Promise<void>;
    };

function CategoryForm(props: FormProps) {
  const { mode, initial, onCancel, onSaved } = props;
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ANO-003(b) : on réinitialise le message d'erreur dès que l'utilisateur
  // modifie un champ — sinon le bandeau rouge persiste après correction
  // alors même que la saisie n'est plus celle qui a déclenché l'erreur.
  // Toutes les modifs du form passent par cette mutation centralisée.
  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (submitError) setSubmitError(null);
  };

  const canSubmit = useMemo(
    () =>
      form.slug.trim().length > 0 &&
      (form.name_fr.trim().length > 0 || form.name_en.trim().length > 0),
    [form],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      slug: form.slug.trim(),
      name: toLocalised(form.name_fr, form.name_en),
      description: toLocalised(form.description_fr, form.description_en),
      image_url: form.image_url.trim() || null,
      display_order: form.display_order,
      is_active: form.is_active,
    };

    try {
      const url =
        mode === 'create'
          ? '/api/admin/categories'
          : `/api/admin/categories/${props.categoryId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(humanizeError(errorPayload));
      }
      await onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label="Formulaire catégorie">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Slug (kebab-case)" required>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => updateField('slug', e.target.value)}
            className={`${inputClass} font-mono`}
            placeholder="soc, edr, xdr…"
            required
          />
        </Field>
        <Field label="Ordre (0-1000)">
          <input
            type="number"
            min={0}
            max={1000}
            value={form.display_order}
            onChange={(e) => updateField('display_order', Number(e.target.value) || 0)}
            className={inputClass}
          />
        </Field>
        <Field label="Nom (FR)" required>
          <input
            type="text"
            value={form.name_fr}
            onChange={(e) => updateField('name_fr', e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Nom (EN)">
          <input
            type="text"
            value={form.name_en}
            onChange={(e) => updateField('name_en', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Description (FR)" className="sm:col-span-2">
          <textarea
            rows={2}
            value={form.description_fr}
            onChange={(e) => updateField('description_fr', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Description (EN)" className="sm:col-span-2">
          <textarea
            rows={2}
            value={form.description_en}
            onChange={(e) => updateField('description_en', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="URL de l'image" className="sm:col-span-2">
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => updateField('image_url', e.target.value)}
            className={inputClass}
            placeholder="https://… (optionnel)"
          />
        </Field>
        <label className="flex items-end gap-2 text-sm text-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => updateField('is_active', e.target.checked)}
            className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary"
          />
          Active (visible sur la home et le catalogue)
        </label>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit || submitting} aria-busy={submitting || undefined}>
          {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer la catégorie' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          <X aria-hidden="true" className="mr-1 h-4 w-4" />
          Annuler
        </Button>
      </div>
    </form>
  );
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className ?? ''}`}>
      <span className="mb-1 block font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
