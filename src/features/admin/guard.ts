import type { CurrentUser } from '@/context/AuthContext';

/**
 * Client-side helper: tells the UI whether the current user holds the
 * `admin` role on their `public.profiles` row.
 *
 * Reality check — this is UX only.
 *
 * What actually protects the back-office is the database:
 *   - the SECURITY DEFINER `is_admin()` function on Supabase,
 *   - RLS policies on every admin-touched table (products, orders,
 *     audit log…) that gate reads/writes behind `is_admin()`.
 *
 * Even if an attacker flips `currentUser.role` in the dev console and
 * renders the admin UI, every read/write still goes through Postgres
 * and is rejected at the row level. The admin UI is not a secret —
 * its data is.
 *
 * Still missing (next lots):
 *   - a Next.js middleware that 401s `/admin/*` for non-admin JWTs
 *     before the route is ever rendered,
 *   - mandatory MFA / 2FA for the admin role,
 *   - shorter session lifetime for admin tokens,
 *   - an `admin_audit_log` populated server-side.
 */
export const isAdmin = (user: CurrentUser | null | undefined): boolean =>
  user?.role === 'admin';
