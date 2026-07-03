import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

/**
 * Middleware composé — i18n LOT 1 + admin gate F2 (AAL2).
 *
 * DEUX PRÉOCCUPATIONS DISTINCTES :
 *
 *   1. i18n (next-intl) : routing des URLs vers src/app/[locale]/* selon
 *      la locale (as-needed → FR sans préfixe, EN = /en/*). Cookie
 *      NEXT_LOCALE géré par next-intl pour préférence utilisateur.
 *
 *   2. Admin gate (F2) : bounces des requêtes non-admin / non-AAL2 AVANT
 *      que la page /admin soit rendue. Inchangé fonctionnellement — les
 *      redirects préservent maintenant la locale courante.
 *
 * NON-RÉGRESSION CRITIQUE :
 *   - /api/**  → EXCLUS DU MATCHER. Webhook Stripe, routes admin API,
 *     payment methods : aucune interférence, aucun préfixe locale.
 *   - /_next/* et fichiers statiques → exclus par extension pattern.
 *   - Le gate admin utilise EXACTEMENT la même logique F2 qu'avant :
 *     getUser → profile role → AAL2. Les redirects appliquent le préfixe
 *     locale via `withLocalePrefix()`.
 *
 * TRADE-OFF ASSUMÉ :
 *   Sur un pass-through admin (utilisateur AAL2 valide), les cookies de
 *   rotation Supabase capturés par le supabase-ssr callback ne sont PAS
 *   propagés sur la réponse d'intlMiddleware. Impact : au prochain
 *   request, @supabase/ssr rafraîchira les tokens si nécessaire — le
 *   session est auto-guérissante. Documenté en commentaire pour éviter
 *   la surprise. Sur les redirects (gate KO), les cookies sont bien
 *   forwardés via `forwardCookies()`.
 */

const intlMiddleware = createIntlMiddleware(routing);

// ── Locale detection (URL uniquement, matches `as-needed`) ─────────────
type SupportedLocale = (typeof routing.locales)[number];

function getLocaleFromPath(pathname: string): SupportedLocale {
  // as-needed : seul EN a un préfixe. FR = pas de préfixe.
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  return 'fr';
}

function withLocalePrefix(pathname: string, locale: SupportedLocale): string {
  if (locale === 'fr') return pathname;
  return `/${locale}${pathname}`;
}

function stripLocalePrefix(pathname: string): string {
  if (pathname === '/en') return '/';
  if (pathname.startsWith('/en/')) return pathname.slice(3);
  return pathname;
}

// ── Admin gate constantes (paths sans préfixe locale) ──────────────────
const ADMIN_PATH = '/admin';
const LOGIN_PATH = '/login';
const FORBIDDEN_REDIRECT = '/';
const STEP_UP_PATH = '/admin/verify';
const MFA_ENROLL_PATH = '/my-account';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const stripped = stripLocalePrefix(pathname);
  const isAdminPath =
    stripped === ADMIN_PATH || stripped.startsWith(`${ADMIN_PATH}/`);

  if (!isAdminPath) {
    // Chemin non-admin : intl gère seul (routing locale, cookie NEXT_LOCALE).
    return intlMiddleware(request);
  }

  // ── Gate admin — logique F2 (AAL2), inchangée fonctionnellement ──────
  const locale = getLocaleFromPath(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail-closed
    return redirectWithLocale(request, LOGIN_PATH, locale, {
      preserveOrigin: true,
    });
  }

  // Cookies rotation Supabase captées via setAll. Forwardées sur les
  // redirects (échecs de gate), perdues sur pass-through (accepté).
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return forwardCookies(
      redirectWithLocale(request, LOGIN_PATH, locale, { preserveOrigin: true }),
      response,
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin' || profile.is_active !== true) {
    return forwardCookies(
      redirectWithLocale(request, FORBIDDEN_REDIRECT, locale),
      response,
    );
  }

  // /admin/verify : page step-up. Pass sans check AAL2 (sinon loop).
  if (stripped === STEP_UP_PATH) {
    return intlMiddleware(request);
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.currentLevel === 'aal2') {
    // Admin AAL2 OK — passe à intl pour le routing locale.
    return intlMiddleware(request);
  }

  if (aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
    return forwardCookies(
      redirectWithLocale(request, STEP_UP_PATH, locale, {
        preserveOrigin: true,
      }),
      response,
    );
  }

  // Pas de facteur enrôlé — redirect vers /my-account?reason=mfa_required
  const enrollUrl = request.nextUrl.clone();
  enrollUrl.pathname = withLocalePrefix(MFA_ENROLL_PATH, locale);
  enrollUrl.search = '';
  enrollUrl.hash = '';
  enrollUrl.searchParams.set('reason', 'mfa_required');
  return forwardCookies(NextResponse.redirect(enrollUrl, 307), response);
}

function redirectWithLocale(
  request: NextRequest,
  targetPath: string,
  locale: SupportedLocale,
  opts: { preserveOrigin?: boolean } = {},
): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = withLocalePrefix(targetPath, locale);
  url.search = '';
  if (opts.preserveOrigin) {
    url.searchParams.set('from', request.nextUrl.pathname);
  }
  return NextResponse.redirect(url, 307);
}

function forwardCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

// Matcher : exclut /api, /_next, /_vercel, fichiers statiques.
// Résultat : middleware N'INTERCEPTE PAS les routes API — le webhook
// Stripe, les routes admin API, les payment methods restent au chemin
// exact sans préfixe locale.
export const config = {
  matcher: [
    '/((?!api|_next|_vercel|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
};
