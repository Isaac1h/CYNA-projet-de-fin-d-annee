'use client';

import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Stripe.js (browser) accessor — lazy + cached.
 *
 * Pattern parallèle à src/lib/stripe-server.ts mais côté client :
 * `loadStripe` télécharge le SDK Stripe au premier appel, on cache la
 * promesse pour ne pas re-télécharger entre montages d'Elements.
 *
 * Sécurité : NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY est PUBLIQUE par design
 * (elle ne donne accès qu'aux opérations browser non-privilégiées —
 * tokenisation de carte, confirmation 3DS). Le secret key reste server-only
 * dans stripe-server.ts.
 *
 * Throw si la clé n'est pas posée — capturé par les Elements consumer
 * qui affichent un état d'erreur clair sans casser le reste de la page.
 */

let cached: Promise<Stripe | null> | null = null;

export function getStripeJs(): Promise<Stripe | null> {
  if (cached) return cached;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    cached = Promise.reject(
      new Error(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. ' +
          "Add it to .env.local and restart `next dev`.",
      ),
    );
    return cached;
  }
  cached = loadStripe(key);
  return cached;
}
