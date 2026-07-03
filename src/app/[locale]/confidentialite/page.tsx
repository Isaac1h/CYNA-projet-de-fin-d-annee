import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Cyna',
  description:
    'Politique de confidentialité Cyna : données collectées, finalités, bases légales, durées de conservation, sous-traitants et exercice de vos droits RGPD.',
};

/**
 * i18n LOT 1 — voir mentions-legales/page.tsx pour la stratégie
 * (H1 + label "Dernière mise à jour" traduits, corps FR conservé,
 * bannière EN pour signaler la limitation).
 */
export default async function ConfidentialitePage() {
  const t = await getTranslations('legal');
  const tPage = await getTranslations('legal.privacy');
  const locale = await getLocale();

  return (
    <div className="bg-background py-10 sm:py-16">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{tPage('heading')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('lastUpdated', { date: tPage('lastUpdatedDate') })}
          </p>
          <p className="mt-4 text-muted-foreground">
            La présente politique décrit comment nous collectons et traitons les données
            personnelles dans le cadre de l’utilisation du site cyna.fr et des services
            associés, en application du Règlement (UE) 2016/679 (RGPD) et de la loi
            «&nbsp;Informatique et Libertés&nbsp;».
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

        <section aria-labelledby="responsable" className="mb-8">
          <h2 id="responsable" className="mb-3 text-xl font-semibold text-foreground">
            1. Responsable de traitement
          </h2>
          <p className="text-muted-foreground">
            Le responsable de traitement est [À COMPLÉTER : raison sociale], dont le siège
            social est situé à [À COMPLÉTER : adresse postale]. Pour toute question, vous
            pouvez contacter notre référent à l’adresse [À COMPLÉTER : dpo@cyna.fr ou contact
            désigné].
          </p>
        </section>

        <section aria-labelledby="donnees-collectees" className="mb-8">
          <h2 id="donnees-collectees" className="mb-3 text-xl font-semibold text-foreground">
            2. Données collectées
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Compte&nbsp;:</strong> adresse e-mail, nom et
              prénom, mot de passe (chiffré côté serveur par Supabase Auth).
            </li>
            <li>
              <strong className="text-foreground">Commandes et abonnements&nbsp;:</strong>{' '}
              historique des achats, période d’abonnement, statut de paiement (sans données
              de carte bancaire).
            </li>
            <li>
              <strong className="text-foreground">Données techniques&nbsp;:</strong> adresse
              IP, type de navigateur, journaux d’accès et de sécurité.
            </li>
            <li>
              <strong className="text-foreground">Cookies&nbsp;:</strong> un identifiant
              local mémorise votre choix de consentement. Voir la section 7 ci-dessous.
            </li>
          </ul>
        </section>

        <section aria-labelledby="finalites" className="mb-8">
          <h2 id="finalites" className="mb-3 text-xl font-semibold text-foreground">
            3. Finalités et bases légales
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              Gestion du compte et accès aux services — exécution du contrat (article 6.1.b
              RGPD).
            </li>
            <li>
              Traitement des commandes, facturation, abonnements — exécution du contrat et
              obligation légale (article 6.1.b et 6.1.c RGPD).
            </li>
            <li>
              Sécurité du service, prévention des fraudes et journalisation — intérêt
              légitime (article 6.1.f RGPD).
            </li>
            <li>
              Réponse aux demandes via le formulaire de contact — exécution de mesures
              précontractuelles ou intérêt légitime selon le cas.
            </li>
          </ul>
        </section>

        <section aria-labelledby="conservation" className="mb-8">
          <h2 id="conservation" className="mb-3 text-xl font-semibold text-foreground">
            4. Durées de conservation
          </h2>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              Données de compte&nbsp;: jusqu’à la suppression du compte, puis purge sous
              30&nbsp;jours.
            </li>
            <li>
              Données de facturation&nbsp;: 10&nbsp;ans à compter de la clôture de
              l’exercice, conformément aux obligations comptables.
            </li>
            <li>
              Journaux techniques et de sécurité&nbsp;: 12&nbsp;mois maximum.
            </li>
            <li>
              Choix de consentement cookies&nbsp;: 13&nbsp;mois maximum, ou jusqu’à
              effacement par l’utilisateur.
            </li>
          </ul>
        </section>

        <section aria-labelledby="sous-traitants" className="mb-8">
          <h2 id="sous-traitants" className="mb-3 text-xl font-semibold text-foreground">
            5. Destinataires et sous-traitants
          </h2>
          <p className="text-muted-foreground">
            Vos données sont accessibles aux équipes habilitées de Cyna ainsi qu’aux
            sous-traitants suivants, encadrés contractuellement&nbsp;:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">Supabase</strong> — hébergement de la base
              de données et authentification, dans la région [À COMPLÉTER : région exacte du
              projet, Union européenne].
            </li>
            <li>
              <strong className="text-foreground">Stripe</strong> — traitement des paiements
              par carte bancaire. Stripe est le seul acteur exposé aux données de carte.
            </li>
            <li>
              <strong className="text-foreground">Plausible Analytics</strong> — mesure
              d’audience anonyme et sans cookie, activée uniquement après votre consentement
              explicite via la bannière. Les données transmises se limitent à des indicateurs
              agrégés (URL de la page vue, référent, type d’appareil, pays déduit de l’IP sans
              stockage de l’IP brute). Aucun identifiant personnel ni cookie n’est déposé.
              Plausible est basé dans l’Union européenne (Allemagne).
            </li>
            <li>
              <strong className="text-foreground">[À COMPLÉTER : hébergeur du frontend, ex.
              Vercel]</strong> — exécution du site web.
            </li>
          </ul>
        </section>

        <section aria-labelledby="transferts" className="mb-8">
          <h2 id="transferts" className="mb-3 text-xl font-semibold text-foreground">
            6. Transferts hors Union européenne
          </h2>
          <p className="text-muted-foreground">
            Certains sous-traitants peuvent traiter des données depuis des pays hors Union
            européenne (par exemple les États-Unis pour Stripe ou Vercel). Ces transferts
            sont encadrés par les clauses contractuelles types adoptées par la Commission
            européenne et, le cas échéant, par les certifications applicables (Data Privacy
            Framework).
          </p>
        </section>

        <section aria-labelledby="cookies" className="mb-8">
          <h2 id="cookies" className="mb-3 text-xl font-semibold text-foreground">
            7. Cookies et traceurs
          </h2>
          <p className="text-muted-foreground">
            Le site utilise un identifiant local (stockage navigateur) strictement nécessaire
            pour mémoriser votre choix de consentement, ainsi que les cookies de session
            techniques nécessaires à l’authentification.
          </p>
          <p className="mt-3 text-muted-foreground">
            <strong className="text-foreground">Mesure d’audience — Plausible.</strong> Avec
            votre consentement explicite (bouton «&nbsp;Tout accepter&nbsp;» de la
            bannière), nous chargeons un script d’analyse d’audience fourni par Plausible.
            Ce script <strong className="text-foreground">ne dépose aucun cookie</strong> et
            n’enregistre aucun identifiant persistant. Il transmet à Plausible, hébergé dans
            l’Union européenne, uniquement l’URL de la page consultée, le référent, le pays
            déduit de l’IP (l’IP brute n’est pas stockée), le type d’appareil et le
            navigateur. Ces données servent exclusivement à produire des statistiques
            agrégées d’audience. Refuser laisse le site totalement non tracké — aucun script
            Plausible n’est chargé. Vous pouvez changer d’avis à tout moment en effaçant les
            données du site, ce qui fera réapparaître la bannière.
          </p>
        </section>

        <section aria-labelledby="droits" className="mb-8">
          <h2 id="droits" className="mb-3 text-xl font-semibold text-foreground">
            8. Vos droits
          </h2>
          <p className="text-muted-foreground">
            Conformément au RGPD, vous disposez des droits suivants sur vos données&nbsp;:
          </p>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>Droit d’accès et droit à une copie des données.</li>
            <li>Droit de rectification des données inexactes ou incomplètes.</li>
            <li>Droit à l’effacement («&nbsp;droit à l’oubli&nbsp;»).</li>
            <li>Droit à la portabilité de vos données dans un format structuré.</li>
            <li>Droit d’opposition au traitement fondé sur l’intérêt légitime.</li>
            <li>Droit à la limitation du traitement.</li>
            <li>Droit de définir des directives relatives au sort de vos données après votre décès.</li>
          </ul>
        </section>

        <section aria-labelledby="exercice" className="mb-8">
          <h2 id="exercice" className="mb-3 text-xl font-semibold text-foreground">
            9. Comment exercer vos droits
          </h2>
          <p className="text-muted-foreground">
            Vous pouvez exercer vos droits en écrivant à [À COMPLÉTER : dpo@cyna.fr], en
            joignant un justificatif d’identité en cas de doute légitime. Nous nous engageons
            à répondre dans un délai d’un mois, prolongeable de deux mois pour les demandes
            complexes. La suppression du compte est également accessible depuis l’espace{' '}
            <Link
              href="/my-account"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              «&nbsp;Mon compte&nbsp;»
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="cnil" className="mb-8">
          <h2 id="cnil" className="mb-3 text-xl font-semibold text-foreground">
            10. Réclamation auprès de la CNIL
          </h2>
          <p className="text-muted-foreground">
            Si, après nous avoir contactés, vous estimez que vos droits ne sont pas
            respectés, vous pouvez introduire une réclamation auprès de la Commission
            nationale de l’informatique et des libertés (CNIL) — 3 place de Fontenoy, TSA
            80715, 75334 Paris Cedex 07 — ou en ligne sur{' '}
            <a
              href="https://www.cnil.fr"
              rel="noopener noreferrer"
              target="_blank"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              cnil.fr
            </a>
            .
          </p>
        </section>
      </article>
    </div>
  );
}
