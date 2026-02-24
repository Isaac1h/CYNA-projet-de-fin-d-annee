import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase singleton.
 *
 * The anon key is safe to ship to the client; Row Level Security on the
 * Postgres side is what actually gates access. The service-role key must
 * NEVER be read here — it lives in `process.env.SUPABASE_SERVICE_ROLE_KEY`
 * and stays server-only.
 *
 * NEXT_PUBLIC_* vars are inlined at build time. When they are absent
 * (local dev without an .env.local), `SUPABASE_ENABLED` is `false` and
 * `supabase` is replaced by a proxy that throws on any access. This keeps
 * the existing `AuthContext` `if (SUPABASE_ENABLED) … else { localStorage }`
 * branches working untouched while the auth lot is still ahead of us.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_ENABLED: boolean = Boolean(url && key);

const missingEnvError = (): Error =>
  new Error(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.',
  );

const guardedStub = new Proxy({} as SupabaseClient, {
  get() {
    throw missingEnvError();
  },
});

export const supabase: SupabaseClient = SUPABASE_ENABLED
  ? createBrowserClient(url as string, key as string)
  : guardedStub;
