/**
 * Address book domain types for /my-account.
 *
 * Shape mirrors checkout's BillingAddress on purpose so an address picked
 * here can be reused at checkout-time. The fields are duplicated rather
 * than shared today because the checkout feature module ships in a
 * separate PR — consolidation will happen after both PRs land.
 */

export type Address = {
  id: string;
  /** Short user-visible label, e.g. "Bureau Paris", "Domicile". */
  label: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  /** Default shipping/billing pick. Exactly one per user, enforced in DB. */
  isDefault: boolean;
};

/** Form-level error map — excludes the non-input `isDefault` flag. */
export type AddressErrors = Partial<Record<Exclude<keyof Address, 'isDefault'>, string>>;
