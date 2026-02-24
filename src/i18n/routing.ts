import { defineRouting } from 'next-intl/routing';

/**
 * i18n LOT 1 — configuration de routage.
 *
 *   locales        : FR + EN (LTR seulement). RTL (ar/he) prévu lot 2.
 *   defaultLocale  : 'fr' — préserve les URLs existantes (/, /checkout, ...)
 *   localePrefix   : 'as-needed' — le locale par défaut n'a PAS de préfixe
 *                    d'URL, la langue EN est explicite via /en/*. Non-régression
 *                    stricte pour tous les liens FR déjà indexés / testés.
 *
 * Ajouter une langue plus tard = ajouter à `locales` + créer messages/xx.json
 * + éventuellement ajuster `dir` dans le layout si RTL.
 */

export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
