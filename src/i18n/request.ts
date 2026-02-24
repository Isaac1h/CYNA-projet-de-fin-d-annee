import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Chargement des messages RSC par requête. Appelé automatiquement par
 * next-intl à chaque render server-side / server component.
 *
 * Si la locale demandée n'est pas dans la liste supportée, on retombe
 * sur le default (fr) plutôt que de crasher — comportement plus doux
 * pour les URLs bricolées.
 */

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
