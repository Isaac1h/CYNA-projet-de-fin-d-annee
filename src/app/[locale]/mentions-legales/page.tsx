import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Mentions légales — Cyna',
  description:
    'Mentions légales du site Cyna : identité de l’éditeur, directeur de publication, hébergeur et coordonnées de contact.',
};

/**
 * i18n LOT 1 — Bloc C.
 *
 * Le corps du texte (édité par l'équipe légale, contient encore des
 * `[À COMPLÉTER]` non shippables) reste en français. Seuls le titre H1
 * et le libellé "Dernière mise à jour" sont traduits. Une bannière en
 * EN prévient les visiteurs non-francophones que le contenu juridique
 * n'est disponible qu'en français pour le moment — l'écriture d'un
 * corpus EN validé par la même équipe légale se fera dans un lot dédié.
 */
export default async function MentionsLegalesPage() {
  const t = await getTranslations('legal');
  const tPage = await getTranslations('legal.mentions');
  const locale = await getLocale();

  return (
    <div className="bg-background py-10 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{tPage('heading')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('lastUpdated', { date: tPage('lastUpdatedDate') })}
          </p>
          {locale !== 'fr' && (
            <p
              role="note"
              className="mt-4 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-800 dark:text-yellow-200"
            >
              {t('onlyFrenchNotice')}
            </p>
          )}
        </header>

        <section aria-labelledby="editeur" className="mb-10">
          <h2 id="editeur" className="mb-3 text-xl font-semibold text-foreground">
            Éditeur du site
          </h2>
          <p className="text-muted-foreground">
            Le site <strong className="text-foreground">cyna.fr</strong> est édité par&nbsp;:
          </p>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            <li>Raison sociale : [À COMPLÉTER : forme juridique + dénomination sociale]</li>
            <li>Siège social : [À COMPLÉTER : adresse postale complète]</li>
            <li>Capital social : [À COMPLÉTER]</li>
            <li>RCS / SIRET : [À COMPLÉTER]</li>
            <li>Numéro de TVA intracommunautaire : [À COMPLÉTER]</li>
            <li>Téléphone : [À COMPLÉTER]</li>
            <li>Courriel : [À COMPLÉTER : contact@cyna.fr]</li>
          </ul>
        </section>

        <section aria-labelledby="directeur" className="mb-10">
          <h2 id="directeur" className="mb-3 text-xl font-semibold text-foreground">
            Directeur de la publication
          </h2>
          <p className="text-muted-foreground">
            [À COMPLÉTER : nom et qualité du directeur ou de la directrice de la publication].
          </p>
        </section>

        <section aria-labelledby="hebergeur" className="mb-10">
          <h2 id="hebergeur" className="mb-3 text-xl font-semibold text-foreground">
            Hébergeur
          </h2>
          <p className="text-muted-foreground">Le site est hébergé par&nbsp;:</p>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            <li>
              Frontend (application web) : [À COMPLÉTER : nom de l’hébergeur — par exemple Vercel
              Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis].
            </li>
            <li>
              Base de données et authentification : [À COMPLÉTER : Supabase, région exacte
              (Union européenne)].
            </li>
          </ul>
        </section>

        <section aria-labelledby="propriete" className="mb-10">
          <h2 id="propriete" className="mb-3 text-xl font-semibold text-foreground">
            Propriété intellectuelle
          </h2>
          <p className="text-muted-foreground">
            L’ensemble des contenus présents sur le site (textes, logos, images, éléments
            graphiques, code source) est protégé par le droit d’auteur et le droit des marques.
            Toute reproduction, représentation ou exploitation, totale ou partielle, sans
            autorisation écrite préalable, est interdite.
          </p>
        </section>

        <section aria-labelledby="contact" className="mb-10">
          <h2 id="contact" className="mb-3 text-xl font-semibold text-foreground">
            Contact
          </h2>
          <p className="text-muted-foreground">
            Pour toute question relative au site ou à ces mentions, vous pouvez nous écrire à
            l’adresse [À COMPLÉTER : contact@cyna.fr] ou utiliser le{' '}
            <a
              href="/tools"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              formulaire de contact
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
