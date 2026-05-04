import type { BillingAddress, BillingErrors } from './types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Generic loose phone match: digits, spaces, parentheses, dash, dots, and an
// optional leading `+`. Strict E.164 will be enforced server-side when the
// real order flow lands.
const PHONE_REGEX = /^[+]?[\d\s()./-]{6,}$/;
// Loose postal code match: 3 to 10 alphanumeric chars + spaces / dashes.
const POSTAL_REGEX = /^[A-Za-z0-9 \-]{3,10}$/;

export const isEmailValid = (value: string): boolean => EMAIL_REGEX.test(value.trim());

/**
 * i18n LOT 1 : validation returns i18n message KEYS (relative to the
 * `checkout` namespace) rather than pre-formatted French strings. Callers
 * (Step2Billing) resolve them via `useTranslations('checkout')`.
 */
export const validateBilling = (form: BillingAddress): BillingErrors => {
  const errors: BillingErrors = {};

  if (!form.firstName.trim()) errors.firstName = 'billing.errors.firstNameRequired';
  if (!form.lastName.trim()) errors.lastName = 'billing.errors.lastNameRequired';
  if (!form.email.trim()) {
    errors.email = 'billing.errors.emailRequired';
  } else if (!isEmailValid(form.email)) {
    errors.email = 'billing.errors.emailInvalid';
  }
  if (!form.address1.trim()) errors.address1 = 'billing.errors.address1Required';
  if (!form.city.trim()) errors.city = 'billing.errors.cityRequired';
  if (!form.region.trim()) errors.region = 'billing.errors.regionRequired';
  if (!form.postalCode.trim()) {
    errors.postalCode = 'billing.errors.postalCodeRequired';
  } else if (!POSTAL_REGEX.test(form.postalCode.trim())) {
    errors.postalCode = 'billing.errors.postalCodeInvalid';
  }
  if (!form.country.trim()) errors.country = 'billing.errors.countryRequired';
  if (!form.phone.trim()) {
    errors.phone = 'billing.errors.phoneRequired';
  } else if (!PHONE_REGEX.test(form.phone.trim())) {
    errors.phone = 'billing.errors.phoneInvalid';
  }

  return errors;
};

export const hasErrors = (errors: BillingErrors): boolean =>
  Object.values(errors).some((message) => Boolean(message));

export const emptyBilling = (overrides: Partial<BillingAddress> = {}): BillingAddress => ({
  firstName: '',
  lastName: '',
  email: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  phone: '',
  ...overrides,
});
