import { supabase } from '@/lib/supabase';
import type { Address } from '@/features/account/types';

/**
 * Address book data layer.
 *
 * RLS on `public.addresses` does the real gating — the user can only
 * read/write rows where `auth.uid() = user_id`. The `user_id` argument we
 * take here is therefore a defensive hint for query shape, not an
 * authorisation check: if the caller lies, RLS rejects.
 *
 * Setting an address as the default is one UPDATE: the
 * `addresses_enforce_default` trigger flips every other row of the same
 * user to `is_default = false` in the same transaction, so the partial
 * unique index `addresses_one_default_per_user` can never be violated.
 */

type AddressRow = {
  id: string;
  user_id: string;
  label: string;
  first_name: string;
  last_name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const ADDRESS_COLUMNS =
  'id, user_id, label, first_name, last_name, line1, line2, city, region, postal_code, country, phone, is_default, created_at, updated_at';

const toAddress = (row: AddressRow): Address => ({
  id: row.id,
  label: row.label,
  firstName: row.first_name,
  lastName: row.last_name,
  address1: row.line1,
  address2: row.line2 ?? '',
  city: row.city,
  region: row.region,
  postalCode: row.postal_code,
  country: row.country,
  phone: row.phone,
  isDefault: row.is_default,
});

type AddressInput = Omit<Address, 'id' | 'isDefault'>;

const toRow = (a: AddressInput) => ({
  label: a.label,
  first_name: a.firstName,
  last_name: a.lastName,
  line1: a.address1,
  line2: a.address2 || null,
  city: a.city,
  region: a.region,
  postal_code: a.postalCode,
  country: a.country,
  phone: a.phone,
});

export async function listAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Supabase listAddresses failed: ${error.message}`);
  return (data as AddressRow[] | null ?? []).map(toAddress);
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...toRow(input), user_id: userId })
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) throw new Error(`Supabase createAddress failed: ${error.message}`);
  return toAddress(data as AddressRow);
}

export async function updateAddress(
  userId: string,
  id: string,
  input: AddressInput,
): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .update(toRow(input))
    .eq('id', id)
    .eq('user_id', userId)
    .select(ADDRESS_COLUMNS)
    .single();
  if (error) throw new Error(`Supabase updateAddress failed: ${error.message}`);
  return toAddress(data as AddressRow);
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase deleteAddress failed: ${error.message}`);
}

export async function setDefaultAddress(userId: string, id: string): Promise<void> {
  // The BEFORE trigger flips every other row of the same user to
  // is_default=false in the same transaction, so we just write `true` here.
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw new Error(`Supabase setDefaultAddress failed: ${error.message}`);
}
