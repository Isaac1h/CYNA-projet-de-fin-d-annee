import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const metadata: Metadata = {
  title: 'Conditions générales d’utilisation et de vente — Cyna',
  description:
    'Conditions générales d’utilisation et de vente des services Cyna : compte, commande, abonnements, paiement, rétractation, responsabilité.',
};

/**
 * i18n LOT 1 — voir mentions-legales/page.tsx pour la stratégie
 * (H1 + label "Dernière mise à jour" traduits, corps FR conservé,
 * bannière EN pour signaler la limitation).
 */
export default async function CguPage() {
  const t = await getTranslations('legal');
  const tPage = await getTranslations('legal.cgu');
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

        <section aria-labelledby="objet" className="mb-8">
          <h2 id="objet" className="mb-3 text-xl font-semibold text-foreground">
            Article 1 — Objet
          </h2>
          <p className="text-muted-foreground">
            Les présentes conditions encadrent l’utilisation du site cyna.fr et la souscription
            aux services de cybersécurité (SOC, EDR, XDR, renseignement sur les menaces)
            proposés par [À COMPLÉTER : raison sociale]. En utilisant le site ou en passant
            commande, l’utilisateur reconnaît avoir pris connaissance des présentes conditions
            et les accepter sans réserve.
          </p>
        </section>

        <section aria-labelledby="compte" className="mb-8">
          <h2 id="compte" className="mb-3 text-xl font-semibold text-foreground">
            Article 2 — Compte utilisateur
          </h2>
          <p className="text-muted-foreground">
            L’accès aux fonctionnalités d’achat et de gestion d’abonnement nécessite la
            création d’un compte. L’utilisateur s’engage à fournir des informations exactes et
            à maintenir la confidentialité de ses identifiants. Tout accès au compte est
            réputé effectué par son titulaire. La suppression du compte peut être demandée à
            tout moment via l’espace «&nbsp;Mon compte&nbsp;» ou par courriel.
          </p>
        </section>

        <section aria-labelledby="commandes" className="mb-8">
          <h2 id="commandes" className="mb-3 text-xl font-semibold text-foreground">
            Article 3 — Commandes et abonnements
          </h2>
          <p className="text-muted-foreground">
            Les services sont proposés à l’unité ou sous forme d’abonnement (mensuel ou
            annuel). La commande devient définitive à réception du paiement. L’abonnement se
            renouvelle automatiquement par tacite reconduction&nbsp;; il peut être résilié à
            tout moment depuis l’espace personnel, la résiliation prenant effet à l’échéance
            de la période en cours.
          </p>
        </section>

        <section aria-labelledby="paiement" className="mb-8">
          <h2 id="paiement" className="mb-3 text-xl font-semibold text-foreground">
            Article 4 — Prix et paiement
          </h2>
          <p className="text-muted-foreground">
            Les prix affichés sont en euros, toutes taxes comprises pour la clientèle
            soumise à la TVA française. Le paiement est traité exclusivement par Stripe&nbsp;:
            aucune donnée de carte bancaire n’est stockée sur nos serveurs. Les
            justificatifs de paiement sont disponibles dans l’espace personnel.
          </p>
        </section>

        <section aria-labelledby="retractation" className="mb-8">
          <h2 id="retractation" className="mb-3 text-xl font-semibold text-foreground">
            Article 5 — Droit de rétractation
          </h2>
          <p className="text-muted-foreground">
            Conformément aux articles L.221-18 et suivants du Code de la consommation, le
            client consommateur dispose d’un délai de quatorze (14) jours à compter de la
            conclusion du contrat pour exercer son droit de rétractation, sans avoir à
            justifier de motifs. Lorsque l’exécution du service commence, à la demande
            expresse du client, avant la fin du délai de rétractation, le client renonce
            expressément à ce droit pour la fraction du service déjà exécutée.
          </p>
        </section>

        <section aria-labelledby="responsabilite" className="mb-8">
          <h2 id="responsabilite" className="mb-3 text-xl font-semibold text-foreground">
            Article 6 — Responsabilité
          </h2>
          <p className="text-muted-foreground">
            Cyna s’engage à fournir le service avec diligence professionnelle. Le service est
            fourni «&nbsp;tel quel&nbsp;»&nbsp;; aucune garantie de résultat absolu de
            cybersécurité n’est offerte. La responsabilité de Cyna ne saurait être engagée en
            cas de force majeure, d’indisponibilité d’un sous-traitant, ou de mauvaise
            utilisation des services par le client. Les niveaux de service contractuels (SLA)
            applicables sont précisés dans les conditions particulières propres à chaque
            offre.
          </p>
        </section>

        <section aria-labelledby="pi" className="mb-8">
          <h2 id="pi" className="mb-3 text-xl font-semibold text-foreground">
            Article 7 — Propriété intellectuelle
          </h2>
          <p className="text-muted-foreground">
            La souscription à un service confère un droit d’usage personnel, non exclusif et
            non transférable. Toute marque, logo et contenu présent sur le site reste la
            propriété exclusive de Cyna ou de ses partenaires.
          </p>
        </section>

        <section aria-labelledby="donnees" className="mb-8">
          <h2 id="donnees" className="mb-3 text-xl font-semibold text-foreground">
            Article 8 — Données personnelles
          </h2>
          <p className="text-muted-foreground">
            Le traitement des données personnelles dans le cadre du compte, des commandes et
            des cookies est détaillé dans la{' '}
            <Link
              href="/confidentialite"
              className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>

        <section aria-labelledby="droit" className="mb-8">
          <h2 id="droit" className="mb-3 text-xl font-semibold text-foreground">
            Article 9 — Droit applicable et juridiction compétente
          </h2>
          <p className="text-muted-foreground">
            Les présentes conditions sont régies par le droit français. À défaut de résolution
            amiable, tout litige sera porté devant les tribunaux compétents de [À COMPLÉTER :
            ressort judiciaire — par défaut, lieu du siège social], sous réserve des
            dispositions impératives applicables aux consommateurs.
          </p>
        </section>
      </article>
    </div>
  );
}
