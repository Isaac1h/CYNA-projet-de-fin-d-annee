import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client for RSC, Route Handlers and Server Actions.
 *
 * Always uses the anon key — RLS does the real gating. Create a new client
 * per request (the SSR helper recommends against sharing one across
 * requests). The cookie adapter follows the current `getAll` / `setAll`
 * shape (the deprecated `get`/`set`/`remove` will be removed in a future
 * major).
 *
 * `cookies()` from `next/headers` throws when called outside a request
 * scope, e.g. during `generateStaticParams` at build time. We degrade to
 * a cookie-less anon client in that case so the data layer can still
 * pre-render product/category routes.
 */
export function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local before running the server.',
    );
  }

  let cookieStore: ReturnType<typeof cookies> | null = null;
  try {
    cookieStore = cookies();
  } catch {
    cookieStore = null;
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore?.getAll() ?? [];
      },
      setAll(cookiesToSet) {
        if (!cookieStore) return;
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot mutate cookies. Session refreshes
          // happen in middleware (added with the auth lot). Safe to
          // ignore for read-only public queries.
        }
      },
    },
  });
}
