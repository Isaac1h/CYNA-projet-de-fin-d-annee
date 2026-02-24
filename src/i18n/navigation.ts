import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Navigation helpers typés locale — à utiliser à la place de
 * `next/link` et `next/navigation` dans les composants qui affichent
 * du contenu localisé.
 *
 * - Link             : préserve automatiquement la locale courante
 * - useRouter        : router.replace(pathname, { locale: 'en' }) pour swap
 * - usePathname      : retourne le pathname SANS le préfixe locale
 *                      (donc '/checkout' même si l'URL est '/en/checkout')
 * - redirect         : équivalent server-side avec locale
 *
 * IMPORTANT : les composants qui touchent /api ou qui doivent conserver
 * un pathname avec préfixe locale doivent continuer d'utiliser
 * next/navigation directement. Ce module n'est pas obligatoire partout.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
