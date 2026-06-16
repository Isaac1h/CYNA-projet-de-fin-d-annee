/**
 * Open-redirect guard for `?from=` style query strings.
 *
 * Only same-origin absolute paths are accepted. Protocol-relative URLs
 * (`//evil.com`) and full URLs (`http://evil.com`) fall back to the home
 * page.
 *
 * FIXME-SECURITY: this is a client-side guard so a tampered URL cannot push
 * us anywhere external. Once Supabase middleware lands, the server will
 * re-validate the redirect target before issuing the session cookie.
 */
export const safeRedirectTarget = (raw: string | null): string => {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
};
