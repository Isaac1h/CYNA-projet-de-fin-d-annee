import 'server-only';
import Stripe from 'stripe';

/**
 * Server-only Stripe SDK accessor.
 *
 * `import 'server-only'` makes Next.js refuse to bundle this module on the
 * client — STRIPE_SECRET_KEY must never reach the browser. Anything that
 * imports this file is automatically server-scoped.
 *
 * Lazy + cached: the build pipeline shouldn't crash because the env is
 * missing at static-analysis time. Failures land on the first real request.
 *
 * The API version is pinned. Stripe ships breaking changes per version; we
 * upgrade explicitly and update this string when we want them.
 */

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to .env.local before calling Stripe from a route handler.',
    );
  }
  cached = new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia',
    typescript: true,
  });
  return cached;
}
