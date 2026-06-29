'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContactMessage } from './types';
import { hasContactErrors, validateContact, type ContactErrorsI18n } from './validation';

const emptyForm = (): ContactMessage => ({ name: '', email: '', subject: '', message: '' });

type FieldName = keyof ContactMessage;

type Field = {
  name: FieldName;
  type: 'email' | 'text' | 'textarea';
  autoComplete: string;
};

const FIELDS: Field[] = [
  { name: 'name', type: 'text', autoComplete: 'name' },
  { name: 'email', type: 'email', autoComplete: 'email' },
  { name: 'subject', type: 'text', autoComplete: 'off' },
  { name: 'message', type: 'textarea', autoComplete: 'off' },
];

export default function ContactForm() {
  const t = useTranslations('contact.form');
  const [form, setForm] = useState<ContactMessage>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors: ContactErrorsI18n = useMemo(() => validateContact(form), [form]);

  const handleChange =
    (name: FieldName) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [name]: event.target.value }));
    };

  const handleBlur = (name: FieldName) => () => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    setSubmitError(null);
    if (hasContactErrors(errors)) return;
    setSending(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });

      if (!response.ok) {
        setSubmitError(t('genericSubmitError'));
        return;
      }

      setForm(emptyForm());
      setTouched({});
      setSubmitted(false);
      setConfirmation(true);
    } catch {
      setSubmitError(t('genericSubmitError'));
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-labelledby="contact-heading"
      className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <header className="mb-6">
        <h2 id="contact-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
      </header>

      {confirmation ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div>
            <p>{t('confirmation')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setConfirmation(false)}
            >
              {t('sendAnother')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label={t('formAria')}
          className="space-y-5"
        >
          {submitError && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {submitError}
            </div>
          )}
          {FIELDS.map((field) => {
            const errorId = `contact-${field.name}-error`;
            const errorMeta = errors[field.name];
            const showError = (touched[field.name] || submitted) && Boolean(errorMeta);
            const inputClass =
              'w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary';

            return (
              <div key={field.name}>
                <label htmlFor={`contact-${field.name}`} className="mb-1 block text-sm font-medium text-foreground">
                  {t(`fields.${field.name}`)}
                  <span aria-hidden="true" className="ml-0.5 text-destructive">
                    *
                  </span>
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={`contact-${field.name}`}
                    name={field.name}
                    rows={6}
                    required
                    value={form[field.name]}
                    onChange={handleChange(field.name)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder={t(`placeholders.${field.name}`)}
                    className={`${inputClass} resize-vertical`}
                  />
                ) : (
                  <input
                    id={`contact-${field.name}`}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    required
                    value={form[field.name]}
                    onChange={handleChange(field.name)}
                    onBlur={handleBlur(field.name)}
                    aria-invalid={showError || undefined}
                    aria-describedby={showError ? errorId : undefined}
                    placeholder={t(`placeholders.${field.name}`)}
                    className={inputClass}
                  />
                )}
                {showError && errorMeta && (
                  <p id={errorId} role="alert" className="mt-1 text-sm text-destructive">
                    {t(errorMeta.key, errorMeta.values)}
                  </p>
                )}
              </div>
            );
          })}

          <Button type="submit" size="lg" disabled={sending} aria-busy={sending || undefined} className="w-full">
            <Send aria-hidden="true" className="mr-2 h-4 w-4" />
            {sending ? t('sending') : t('submit')}
          </Button>

          <p className="text-xs text-muted-foreground">{t('gdprNotice')}</p>
        </form>
      )}
    </section>
  );
}
