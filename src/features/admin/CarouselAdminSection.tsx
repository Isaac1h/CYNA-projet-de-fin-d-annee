'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import ConfirmDialog from '@/components/ConfirmDialog';

/**
 * Carrousel d'accueil — édition admin.
 *
 * Lecture via les policies `carousel_slides_public_read` (WHERE is_active)
 * + `carousel_slides_admin_read` (is_admin()) : un admin voit toutes les
 * slides (actives ET inactives) ; le public n'en voit qu'une partie.
 *
 * Écriture : exclusivement via les routes /api/admin/carousel-slides*,
 * qui appellent les RPCs SECURITY DEFINER `admin_*_carousel_slide`. Aucun
 * INSERT/UPDATE/DELETE direct depuis le client.
 *
 * revalidatePath('/') est déclenché côté route après chaque mutation
 * pour invalider l'ISR de la home.
 */

type Localised = Record<string, string>;

type Slide = {
  id: string;
  title: Localised | null;
  subtitle: Localised | null;
  image_url: string;
  cta_text: Localised | null;
  cta_link: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

const SELECT = 'id, title, subtitle, image_url, cta_text, cta_link, display_order, is_active, created_at';

type FormState = {
  title_fr: string;
  title_en: string;
  subtitle_fr: string;
  subtitle_en: string;
  image_url: string;
  cta_text_fr: string;
  cta_text_en: string;
  cta_link: string;
  display_order: number;
  is_active: boolean;
};

const emptyForm = (display_order = 0): FormState => ({
  title_fr: '',
  title_en: '',
  subtitle_fr: '',
  subtitle_en: '',
  image_url: '',
  cta_text_fr: '',
  cta_text_en: '',
  cta_link: '',
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

export default function CarouselAdminSection() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Cible courante du dialog de confirmation de suppression. null = fermé.
  const [pendingDelete, setPendingDelete] = useState<Slide | null>(null);

  const fetchSlides = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('carousel_slides')
      .select(SELECT)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setError(null);
    setSlides((data as Slide[]) ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchSlides();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSlides]);

  const move = async (id: string, direction: 'up' | 'down') => {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/carousel-slides/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'erreur inconnue');
      }
      await fetchSlides();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  // La suppression part UNIQUEMENT après confirmation explicite via le
  // ConfirmDialog (cf. ANO-001/002). Pas d'appel direct depuis le bouton.
  const performDelete = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/carousel-slides/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'erreur inconnue');
      }
      await fetchSlides();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (slide: Slide) => {
    setBusyId(slide.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/carousel-slides/${slide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !slide.is_active }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'erreur inconnue');
      }
      await fetchSlides();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      id="carousel"
      aria-labelledby="carousel-admin-heading"
      className="space-y-4"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="carousel-admin-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            Carrousel d&apos;accueil
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les slides affichées sur la page d&apos;accueil. L&apos;ordre est défini par les
            boutons monter/descendre.
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
          {creating ? 'Annuler' : 'Ajouter une slide'}
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
        <SlideForm
          mode="create"
          initial={emptyForm(slides.length * 10)}
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await fetchSlides();
          }}
        />
      )}

      {loading ? (
        <div aria-busy="true" className="h-32 animate-pulse rounded-lg border border-border bg-card/40" />
      ) : error ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Impossible de charger les slides : {error}
        </div>
      ) : slides.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Aucune slide. Cliquez sur « Ajouter une slide ».
        </div>
      ) : (
        <ul className="space-y-3">
          {slides.map((slide, index) => {
            const isFirst = index === 0;
            const isLast = index === slides.length - 1;
            const titleFr = fromLocalised(slide.title, 'fr') || fromLocalised(slide.title, 'en');

            return (
              <li
                key={slide.id}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <img
                    src={slide.image_url}
                    alt=""
                    aria-hidden="true"
                    className="h-20 w-32 flex-shrink-0 rounded-md object-cover"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {titleFr || <span className="italic text-muted-foreground">(sans titre)</span>}
                      </p>
                      {!slide.is_active && (
                        <span className="rounded-full border border-muted-foreground/40 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                          Désactivée
                        </span>
                      )}
                      <span className="rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-xs text-muted-foreground">
                        Ordre {slide.display_order}
                      </span>
                    </div>
                    {slide.cta_link && (
                      <p className="break-all text-xs text-muted-foreground">→ {slide.cta_link}</p>
                    )}
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(slide.id, 'up')}
                      disabled={isFirst || busyId === slide.id}
                      aria-label="Monter la slide"
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void move(slide.id, 'down')}
                      disabled={isLast || busyId === slide.id}
                      aria-label="Descendre la slide"
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleActive(slide)}
                      disabled={busyId === slide.id}
                    >
                      {slide.is_active ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(editingId === slide.id ? null : slide.id);
                        setCreating(false);
                      }}
                      disabled={busyId === slide.id}
                    >
                      <Pencil aria-hidden="true" className="mr-1 h-4 w-4" />
                      Éditer
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDelete(slide)}
                      disabled={busyId === slide.id}
                      aria-label="Supprimer la slide"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingId === slide.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    <SlideForm
                      mode="update"
                      slideId={slide.id}
                      initial={{
                        title_fr: fromLocalised(slide.title, 'fr'),
                        title_en: fromLocalised(slide.title, 'en'),
                        subtitle_fr: fromLocalised(slide.subtitle, 'fr'),
                        subtitle_en: fromLocalised(slide.subtitle, 'en'),
                        image_url: slide.image_url,
                        cta_text_fr: fromLocalised(slide.cta_text, 'fr'),
                        cta_text_en: fromLocalised(slide.cta_text, 'en'),
                        cta_link: slide.cta_link ?? '',
                        display_order: slide.display_order,
                        is_active: slide.is_active,
                      }}
                      onCancel={() => setEditingId(null)}
                      onSaved={async () => {
                        setEditingId(null);
                        await fetchSlides();
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
        title={`Supprimer la slide « ${
          fromLocalised(pendingDelete?.title ?? null, 'fr') ||
          fromLocalised(pendingDelete?.title ?? null, 'en') ||
          'sans titre'
        } » ?`}
        description="Cette action est irréversible. La slide disparaîtra immédiatement de la page d'accueil."
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
      slideId: string;
      initial: FormState;
      onCancel: () => void;
      onSaved: () => Promise<void>;
    };

function SlideForm(props: FormProps) {
  const { mode, initial, onCancel, onSaved } = props;
  const [form, setForm] = useState<FormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      form.image_url.trim().length > 0 &&
      (form.title_fr.trim().length > 0 || form.title_en.trim().length > 0),
    [form],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);
    setSubmitting(true);

    const payload = {
      title: toLocalised(form.title_fr, form.title_en),
      subtitle: toLocalised(form.subtitle_fr, form.subtitle_en),
      image_url: form.image_url.trim(),
      cta_text: toLocalised(form.cta_text_fr, form.cta_text_en),
      cta_link: form.cta_link.trim() || null,
      display_order: form.display_order,
      is_active: form.is_active,
    };

    try {
      const url =
        mode === 'create'
          ? '/api/admin/carousel-slides'
          : `/api/admin/carousel-slides/${props.slideId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorPayload.error ?? 'erreur inconnue');
      }
      await onSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" aria-label="Formulaire slide carrousel">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre (FR)" required>
          <input
            type="text"
            value={form.title_fr}
            onChange={(e) => setForm((f) => ({ ...f, title_fr: e.target.value }))}
            className={inputClass}
            required
          />
        </Field>
        <Field label="Titre (EN)">
          <input
            type="text"
            value={form.title_en}
            onChange={(e) => setForm((f) => ({ ...f, title_en: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Sous-titre (FR)">
          <input
            type="text"
            value={form.subtitle_fr}
            onChange={(e) => setForm((f) => ({ ...f, subtitle_fr: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="Sous-titre (EN)">
          <input
            type="text"
            value={form.subtitle_en}
            onChange={(e) => setForm((f) => ({ ...f, subtitle_en: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="URL de l'image" required className="sm:col-span-2">
          <input
            type="url"
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            className={inputClass}
            placeholder="https://…"
            required
          />
        </Field>
        <Field label="CTA texte (FR)">
          <input
            type="text"
            value={form.cta_text_fr}
            onChange={(e) => setForm((f) => ({ ...f, cta_text_fr: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="CTA texte (EN)">
          <input
            type="text"
            value={form.cta_text_en}
            onChange={(e) => setForm((f) => ({ ...f, cta_text_en: e.target.value }))}
            className={inputClass}
          />
        </Field>
        <Field label="CTA lien" className="sm:col-span-2">
          <input
            type="text"
            value={form.cta_link}
            onChange={(e) => setForm((f) => ({ ...f, cta_link: e.target.value }))}
            className={inputClass}
            placeholder="/catalogue ou https://…"
          />
        </Field>
        <Field label="Ordre (0-1000)">
          <input
            type="number"
            min={0}
            max={1000}
            value={form.display_order}
            onChange={(e) =>
              setForm((f) => ({ ...f, display_order: Number(e.target.value) || 0 }))
            }
            className={inputClass}
          />
        </Field>
        <label className="flex items-end gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-2 focus:ring-primary"
          />
          Active (visible sur la home)
        </label>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit || submitting} aria-busy={submitting || undefined}>
          {submitting ? 'Enregistrement…' : mode === 'create' ? 'Créer la slide' : 'Enregistrer'}
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
