'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * Dialog de confirmation réutilisable (suppressions admin, actions
 * irréversibles).
 *
 * Repose sur Radix UI AlertDialog (`@radix-ui/react-alert-dialog`) qui
 * fournit déjà :
 *   - `role="alertdialog"` + `aria-labelledby` + `aria-describedby` (via
 *     les composants Title/Description)
 *   - Focus trap pendant que la modale est ouverte
 *   - Échap = annuler (Cancel.onSelect)
 *   - Restauration du focus à l'élément déclencheur à la fermeture
 *   - Click hors-dialog = annuler (overlay)
 *
 * Conçu pour être piloté par un parent contrôlé : on passe `open` +
 * `onCancel` + `onConfirm`. Le parent ouvre en posant l'item ciblé dans
 * un state, ferme en le remettant à null.
 */

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'destructive',
  onCancel,
  onConfirm,
}: Props): JSX.Element {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        // Radix appelle onOpenChange(false) sur Échap, click overlay,
        // Cancel — un seul chemin de fermeture, on délègue au parent.
        if (!next) onCancel();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border border-border bg-card p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <div className="flex items-start gap-3">
            {variant === 'destructive' && (
              <span
                aria-hidden="true"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
              >
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </span>
            )}
            <div className="flex-1 space-y-1.5">
              <AlertDialog.Title className="text-base font-semibold text-foreground">
                {title}
              </AlertDialog.Title>
              {description && (
                <AlertDialog.Description className="text-sm text-muted-foreground">
                  {description}
                </AlertDialog.Description>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  buttonVariants({
                    variant: variant === 'destructive' ? 'destructive' : 'default',
                    size: 'default',
                  }),
                )}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
