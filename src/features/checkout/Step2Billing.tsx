'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { BillingAddress, BillingErrors } from './types';
import { hasErrors, validateBilling } from './validation';

type Props = {
  initial: BillingAddress;
  onBack: () => void;
  onContinue: (data: BillingAddress) => void;
};

type FieldName = keyof BillingAddress;

type Field = {
  name: FieldName;
  type: 'text' | 'email' | 'tel';
  autoComplete: string;
  required: boolean;
  className: string; // grid-span helpers
};

const FIELDS: Field[] = [
  { name: 'firstName', type: 'text', autoComplete: 'given-name', required: true, className: '' },
  { name: 'lastName', type: 'text', autoComplete: 'family-name', required: true, className: '' },
  { name: 'email', type: 'email', autoComplete: 'email', required: true, className: 'sm:col-span-2' },
  { name: 'address1', type: 'text', autoComplete: 'address-line1', required: true, className: 'sm:col-span-2' },
  { name: 'address2', type: 'text', autoComplete: 'address-line2', required: false, className: 'sm:col-span-2' },
  { name: 'city', type: 'text', autoComplete: 'address-level2', required: true, className: '' },
  { name: 'region', type: 'text', autoComplete: 'address-level1', required: true, className: '' },
  { name: 'postalCode', type: 'text', autoComplete: 'postal-code', required: true, className: '' },
  { name: 'country', type: 'text', autoComplete: 'country-name', required: true, className: '' },
  { name: 'phone', type: 'tel', autoComplete: 'tel', required: true, className: 'sm:col-span-2' },
];

export default function Step2Billing({ initial, onBack, onContinue }: Props) {
  const t = useTranslations('checkout');
  const [form, setForm] = useState<BillingAddress>(initial);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors: BillingErrors = useMemo(() => validateBilling(form), [form]);
  const summaryErrors = useMemo(
    () => Object.entries(errors).filter(([, message]) => Boolean(message)) as [FieldName, string][],
    [errors],
  );

  const handleChange = (name: FieldName) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }));
  };

  const handleBlur = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setTouched(
      FIELDS.reduce(
        (acc, field) => {
          acc[field.name] = true;
          return acc;
        },
        {} as Partial<Record<FieldName, boolean>>,
      ),
    );
    if (!hasErrors(errors)) {
      onContinue(form);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6" aria-labelledby="step-2-heading">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 id="step-2-heading" className="mb-1 text-lg font-semibold text-foreground">
          {t('billing.heading')}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">{t('billing.subheading')}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => {
            const errorId = `${field.name}-error`;
            const errorKey = errors[field.name];
            const showError = (touched[field.name] || submitted) && Boolean(errorKey);
            return (
              <div key={field.name} className={field.className}>
                <label htmlFor={field.name} className="mb-1 block text-sm font-medium text-foreground">
                  {t(`billing.fields.${field.name}`)}
                  {field.required && (
                    <span aria-hidden="true" className="ml-0.5 text-destructive">
                      *
                    </span>
                  )}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  required={field.required}
                  value={form[field.name]}
                  onChange={handleChange(field.name)}
                  onBlur={handleBlur(field.name)}
                  aria-invalid={showError || undefined}
                  aria-describedby={showError ? errorId : undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
      </div>

      {submitted && summaryErrors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="mb-2 font-semibold">{t('billing.errorSummary')}</p>
          <ul className="list-inside list-disc space-y-1">
            {summaryErrors.map(([name, messageKey]) => (
              <li key={name}>{t(messageKey)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="sm:flex-1">
          {t('billing.back')}
        </Button>
        <Button type="submit" size="lg" className="sm:flex-1">
          {t('billing.continue')}
        </Button>
      </div>
    </form>
  );
}
