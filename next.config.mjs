import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

// i18n LOT 1 — pointe next-intl vers src/i18n/request.ts pour le
// chargement des messages RSC.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Content Security Policy.
 *
 * Permissive on purpose: Next 14 inlines small bootstrap <script>/<style>
 * tags (RSC payloads, hydration markers, styled-jsx) that we cannot hash
 * without wiring per-request nonces. Hence `'unsafe-inline'` on script-src
 * and style-src. Dev also needs `'unsafe-eval'` for React Refresh / HMR.
 *
 * TODO(security): drop `'unsafe-inline'`/`'unsafe-eval'` by generating a
 * per-request nonce in middleware, exposing it via `headers()` to the
 * root layout, and emitting `script-src 'self' 'nonce-XYZ' 'strict-dynamic'`.
 * That is the hardened target; the current policy is the no-break baseline.
 */
const csp = [
  "default-src 'self'",
  // Stripe later: append https://js.stripe.com when Checkout/Elements lands.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Catalogue uses Unsplash; data:/blob: cover SVG masks, blurred placeholders
  // and the future Supabase Storage bucket for product images.
  "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
  "font-src 'self' data:",
  // Supabase REST + Auth over HTTPS, realtime over WSS.
  // Stripe later: append https://api.stripe.com.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  // Anti-clickjacking; redundant with X-Frame-Options but covers modern browsers.
  "frame-ancestors 'none'",
  // Stripe Checkout later: replace with "frame-src https://js.stripe.com https://hooks.stripe.com".
  "frame-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
