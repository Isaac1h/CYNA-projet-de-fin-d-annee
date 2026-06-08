'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  createAddress,
  deleteAddress as deleteAddressInDb,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from '@/lib/data/addresses';
import type { Address, AddressErrors } from './types';

type FieldName = keyof Omit<Address, 'id' | 'isDefault'>;

type FieldSpec = {
  name: FieldName;
  type: 'text' | 'tel';
  autoComplete: string;
  required: boolean;
  full: boolean;
};

const FIELDS: FieldSpec[] = [
  { name: 'label', type: 'text', autoComplete: 'off', required: true, full: true },
  { name: 'firstName', type: 'text', autoComplete: 'given-name', required: true, full: false },
  { name: 'lastName', type: 'text', autoComplete: 'family-name', required: true, full: false },
  { name: 'address1', type: 'text', autoComplete: 'address-line1', required: true, full: true },
  { name: 'address2', type: 'text', autoComplete: 'address-line2', required: false, full: true },
  { name: 'city', type: 'text', autoComplete: 'address-level2', required: true, full: false },
  { name: 'region', type: 'text', autoComplete: 'address-level1', required: true, full: false },
  { name: 'postalCode', type: 'text', autoComplete: 'postal-code', required: true, full: false },
  { name: 'country', type: 'text', autoComplete: 'country-name', required: true, full: false },
  { name: 'phone', type: 'tel', autoComplete: 'tel', required: true, full: true },
];

const POSTAL_REGEX = /^[A-Za-z0-9 \-]{3,10}$/;
const PHONE_REGEX = /^[+]?[\d\s()./-]{6,}$/;

/**
 * i18n LOT 1 — validation returns i18n message KEYS (relative to the
 * `account.addresses` namespace) rather than pre-formatted French strings.
 */
const validateAddress = (address: Address): AddressErrors => {
  const errors: AddressErrors = {};
  if (!address.label.trim()) errors.label = 'errors.labelRequired';
  if (!address.firstName.trim()) errors.firstName = 'errors.firstNameRequired';
  if (!address.lastName.trim()) errors.lastName = 'errors.lastNameRequired';
  if (!address.address1.trim()) errors.address1 = 'errors.address1Required';
  if (!address.city.trim()) errors.city = 'errors.cityRequired';
  if (!address.region.trim()) errors.region = 'errors.regionRequired';
  if (!address.postalCode.trim()) {
    errors.postalCode = 'errors.postalCodeRequired';
  } else if (!POSTAL_REGEX.test(address.postalCode.trim())) {
    errors.postalCode = 'errors.postalCodeInvalid';
  }
  if (!address.country.trim()) errors.country = 'errors.countryRequired';
  if (!address.phone.trim()) {
    errors.phone = 'errors.phoneRequired';
  } else if (!PHONE_REGEX.test(address.phone.trim())) {
    errors.phone = 'errors.phoneInvalid';
  }
  return errors;
};

const hasErrors = (errors: AddressErrors): boolean => Object.values(errors).some(Boolean);

/**
 * Local draft factory — addresses created in the DB get a server-side UUID,
 * so the draft only needs a placeholder id for the form-edit lifecycle.
 */
const emptyDraft = (): Address => ({
  id: '',
  label: '',
  firstName: '',
  lastName: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  isDefault: false,
});

export default function AddressBookSection() {
  const t = useTranslations('account.addresses');
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [hydrated, setHydrated] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [draft, setDraft] = useState<Address | null>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  // ANO-005 : cible courante du ConfirmDialog. La suppression ne part
  // qu'après confirmation explicite (cohérence avec les suppressions du
  // backoffice — même composant accessible Radix + focus trap + ESC).
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listAddresses(currentUser.id);
        if (cancelled) return;
        setAddresses(rows);
      } catch (err) {
        if (cancelled) return;
        toast({
          title: t('loadErrorTitle'),
          description: err instanceof Error ? err.message : t('unknownError'),
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, toast, t]);

  const errors = useMemo<AddressErrors>(
    () => (draft ? validateAddress(draft) : {}),
    [draft],
  );

  const handleStartCreate = () => {
    setDraft(emptyDraft());
    setTouched({});
    setSubmitted(false);
  };

  const handleStartEdit = (address: Address) => {
    setDraft({ ...address });
    setTouched({});
    setSubmitted(false);
  };

  const handleCancel = () => {
    setDraft(null);
    setTouched({});
    setSubmitted(false);
  };

  const handleField = (name: FieldName, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleBlur = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser || !draft) return;
    setSubmitted(true);
    if (hasErrors(errors)) return;
    setBusy(true);
    try {
      const payload = {
        label: draft.label,
        firstName: draft.firstName,
        lastName: draft.lastName,
        address1: draft.address1,
        address2: draft.address2,
        city: draft.city,
        region: draft.region,
        postalCode: draft.postalCode,
        country: draft.country,
        phone: draft.phone,
      };
      const saved = draft.id
        ? await updateAddress(currentUser.id, draft.id, payload)
        : await createAddress(currentUser.id, payload);
      const next = draft.id
        ? addresses.map((a) => (a.id === saved.id ? saved : a))
        : [...addresses, saved];
      setAddresses(next);
      setDraft(null);
      setTouched({});
      toast({
        title: t('saveSuccessTitle'),
        description: t('saveSuccessDesc', { label: saved.label }),
      });
    } catch (err) {
      toast({
        title: t('saveFailedTitle'),
        description: err instanceof Error ? err.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  // ANO-005 : la suppression part UNIQUEMENT après confirmation. Le
  // bouton 🗑️ ouvre le dialog ; la fonction ci-dessous est appelée
  // depuis le `onConfirm` du ConfirmDialog.
  const performDelete = async (address: Address) => {
    if (!currentUser) return;
    setBusy(true);
    try {
      await deleteAddressInDb(currentUser.id, address.id);
      setAddresses((prev) => prev.filter((a) => a.id !== address.id));
      toast({ title: t('deleteSuccessTitle'), description: address.label });
    } catch (err) {
      toast({
        title: t('deleteFailedTitle'),
        description: err instanceof Error ? err.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (!currentUser || address.isDefault) return;
    setBusy(true);
    try {
      await setDefaultAddress(currentUser.id, address.id);
      // The DB trigger flipped the other rows; mirror locally without a refetch.
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === address.id })),
      );
      toast({
        title: t('setDefaultSuccessTitle'),
        description: t('setDefaultSuccessDesc', { label: address.label }),
      });
    } catch (err) {
      toast({
        title: t('setDefaultFailedTitle'),
        description: err instanceof Error ? err.message : t('unknownError'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const summaryErrors = submitted
    ? (Object.entries(errors).filter(([, message]) => Boolean(message)) as [FieldName, string][])
    : [];

  return (
    <section id="addresses" aria-labelledby="addresses-heading" className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="addresses-heading" className="text-xl font-bold text-foreground sm:text-2xl">
            {t('heading')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
        </div>
        {!draft && (
          <Button type="button" onClick={handleStartCreate} aria-controls="address-form" disabled={busy}>
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            {t('add')}
          </Button>
        )}
      </header>

      {!hydrated ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="h-32 animate-pulse rounded-lg border border-border bg-card/40"
        />
      ) : addresses.length === 0 && !draft ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
          <MapPin aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-muted-foreground">{t('emptyState')}</p>
        </div>
      ) : (
        <ul role="list" className="space-y-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  {address.label}
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star aria-hidden="true" className="h-3 w-3" />
                      {t('defaultBadge')}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {address.firstName} {address.lastName}
                  <br />
                  {address.address1}
                  {address.address2 ? `, ${address.address2}` : ''}
                  <br />
                  {address.postalCode} {address.city} — {address.region}
                  <br />
                  {address.country} · {address.phone}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 self-end sm:self-start">
                {!address.isDefault && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSetDefault(address)}
                    aria-label={t('setDefaultAria', { label: address.label })}
                    disabled={busy}
                  >
                    <Star aria-hidden="true" className="mr-1 h-4 w-4" />
                    {t('setDefault')}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartEdit(address)}
                  aria-label={t('editAria', { label: address.label })}
                  disabled={busy}
                >
                  <Pencil aria-hidden="true" className="mr-1 h-4 w-4" />
                  {t('edit')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingDelete(address)}
                  aria-label={t('deleteAria', { label: address.label })}
                  disabled={busy}
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 aria-hidden="true" className="mr-1 h-4 w-4" />
                  {t('delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <form
          id="address-form"
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          aria-label={t('formAria')}
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            {draft.id ? t('editTitle') : t('newTitle')}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const errorId = `address-${field.name}-error`;
              const errorKey = errors[field.name];
              const showError = (touched[field.name] || submitted) && Boolean(errorKey);
              return (
                <div key={field.name} className={field.full ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`address-${field.name}`} className="mb-1 block text-sm font-medium text-foreground">
                    {t(`fields.${field.name}`)}
                    {field.required && (
                      <span aria-hidden="true" className="ml-0.5 text-destructive">
                        *
                      </span>
                    )}
                  </label>
                  <input
                    id={`address-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    required={field.required}
                    value={draft[field.name]}
                    onChange={(event) => handleField(field.name, event.target.value)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {showError && errorKey && (
                    <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
                      {t(errorKey)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {summaryErrors.length > 0 && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <p className="mb-2 font-semibold">{t('errorSummary')}</p>
              <ul className="list-inside list-disc space-y-1">
                {summaryErrors.map(([name, messageKey]) => (
                  <li key={name}>{t(messageKey)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={handleCancel} className="sm:flex-1" disabled={busy}>
              {t('cancel')}
            </Button>
            <Button type="submit" className="sm:flex-1" disabled={busy}>
              {busy ? t('saving') : t('save')}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('confirmDeleteTitle', { label: pendingDelete?.label ?? '' })}
        description={t('confirmDeleteBody')}
        confirmLabel={t('confirmDeleteConfirm')}
        cancelLabel={t('confirmDeleteCancel')}
        variant="destructive"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            const target = pendingDelete;
            setPendingDelete(null);
            void performDelete(target);
          }
        }}
      />
    </section>
  );
}
