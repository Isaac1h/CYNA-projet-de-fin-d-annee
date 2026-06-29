import { validateEmail } from '@/lib/auth';
import type { ContactMessage } from './types';

// Bornes alignées sur les CHECK SQL de public.contact_messages et sur la
// route POST /api/contact — toute divergence ferait passer un message
// côté client qui se ferait rejeter par le serveur.
const MIN_NAME = 1;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MIN_SUBJECT = 3;
const MAX_SUBJECT = 200;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 5000;

/**
 * i18n LOT 1 — validation returns { key, values? } tuples where `key` is
 * an i18n path relative to the `contact.form` namespace. The consuming
 * component (ContactForm) resolves them via `t(key, values)` so the
 * numeric bounds propagate to messages without duplicating them here.
 */
export type ContactErrorMeta = { key: string; values?: Record<string, string | number> };
export type ContactErrorsI18n = Partial<Record<keyof ContactMessage, ContactErrorMeta>>;

export const validateContact = (form: ContactMessage): ContactErrorsI18n => {
  const errors: ContactErrorsI18n = {};
  const name = form.name.trim();
  if (!name) {
    errors.name = { key: 'errors.nameRequired' };
  } else if (name.length < MIN_NAME) {
    errors.name = { key: 'errors.nameTooShort', values: { min: MIN_NAME } };
  } else if (name.length > MAX_NAME) {
    errors.name = { key: 'errors.nameTooLong', values: { max: MAX_NAME } };
  }
  const email = form.email.trim();
  if (!email) {
    errors.email = { key: 'errors.emailRequired' };
  } else if (!validateEmail(email)) {
    errors.email = { key: 'errors.emailInvalid' };
  } else if (email.length > MAX_EMAIL) {
    errors.email = { key: 'errors.emailTooLong', values: { max: MAX_EMAIL } };
  }
  const subject = form.subject.trim();
  if (!subject) {
    errors.subject = { key: 'errors.subjectRequired' };
  } else if (subject.length < MIN_SUBJECT) {
    errors.subject = { key: 'errors.subjectTooShort', values: { min: MIN_SUBJECT } };
  } else if (subject.length > MAX_SUBJECT) {
    errors.subject = { key: 'errors.subjectTooLong', values: { max: MAX_SUBJECT } };
  }
  const message = form.message.trim();
  if (!message) {
    errors.message = { key: 'errors.messageRequired' };
  } else if (message.length < MIN_MESSAGE) {
    errors.message = { key: 'errors.messageTooShort', values: { min: MIN_MESSAGE } };
  } else if (message.length > MAX_MESSAGE) {
    errors.message = { key: 'errors.messageTooLong', values: { max: MAX_MESSAGE } };
  }
  return errors;
};

export const hasContactErrors = (errors: ContactErrorsI18n): boolean =>
  Object.values(errors).some(Boolean);
