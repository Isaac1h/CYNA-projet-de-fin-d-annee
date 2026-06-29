/**
 * FAQ scriptée pour l'assistant chat du site.
 *
 * Pas d'IA, pas d'appel LLM, pas de clé API : ce sont des paires
 * question / réponse statiques, matchées côté client par
 * `src/lib/faq-matcher.ts` sur la base d'une intersection de mots-clés.
 *
 * Éditer / ajouter une entrée :
 *   - garder un `id` stable (kebab-case) — il sert de référence dans
 *     SUGGESTED_IDS et comme key React.
 *   - `keywords` : tokens en minuscules sans accents (le matcher
 *     normalise déjà l'input utilisateur). Pas de doublons.
 *   - `answer` : 1–3 phrases max. Si une réponse devient longue,
 *     pointer plutôt vers la page concernée du site.
 */

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export const FAQ: FaqEntry[] = [
  {
    id: 'soc',
    question: "Qu'est-ce qu'un SOC ?",
    answer:
      "Un SOC (Security Operations Center) surveille vos systèmes 24/7 : détection d'incidents, qualification, réponse. Cyna opère un SOC managé et propose des plateformes SOC pour les équipes internes.",
    keywords: ['soc', 'security', 'operations', 'center', 'surveillance', 'monitoring', 'incident', 'detection', '247', '24/7'],
  },
  {
    id: 'edr',
    question: "À quoi sert un EDR ?",
    answer:
      "L'EDR (Endpoint Detection & Response) protège vos postes et serveurs : détection comportementale, isolation à distance, remédiation automatique. Idéal contre les ransomwares et menaces fileless.",
    keywords: ['edr', 'endpoint', 'detection', 'response', 'poste', 'serveur', 'ransomware', 'antivirus', 'malware'],
  },
  {
    id: 'xdr',
    question: "Quelle est la différence entre EDR et XDR ?",
    answer:
      "Le XDR (Extended Detection & Response) corrèle les signaux de plusieurs surfaces — endpoints, réseau, cloud, identité — alors que l'EDR se concentre sur l'endpoint. Le XDR donne une vue d'attaque unifiée.",
    keywords: ['xdr', 'extended', 'difference', 'comparison', 'compare', 'reseau', 'network', 'cloud', 'identity', 'identite', 'correlation'],
  },
  {
    id: 'threat-intel',
    question: "Qu'est-ce que le renseignement sur les menaces ?",
    answer:
      "Le threat intelligence collecte et analyse des indicateurs de compromission (IoC), TTPs d'attaquants et campagnes en cours pour anticiper les menaces qui ciblent votre secteur.",
    keywords: ['threat', 'intelligence', 'renseignement', 'menace', 'menaces', 'ioc', 'ttp', 'cti', 'veille'],
  },
  {
    id: 'subscribe',
    question: "Comment souscrire un abonnement ?",
    answer:
      "Choisissez un produit dans le catalogue, sélectionnez une formule (mensuelle, annuelle ou par utilisateur), ajoutez au panier puis passez en paiement sécurisé. La création de compte se fait au moment du checkout.",
    keywords: ['abonnement', 'subscription', 'souscrire', 'abonner', 'achat', 'acheter', 'commander', 'commande', 'subscribe', 'panier', 'cart', 'checkout'],
  },
  {
    id: 'pricing',
    question: "Quelles sont les options de tarification ?",
    answer:
      "Chaque produit propose trois formules : mensuelle (flexibilité), annuelle (réduction) et par utilisateur (pour les équipes). Les tarifs détaillés sont sur chaque fiche produit.",
    keywords: ['prix', 'tarif', 'tarification', 'pricing', 'cout', 'cost', 'mensuel', 'annuel', 'utilisateur', 'formule', 'forfait', 'plan'],
  },
  {
    id: 'payment-security',
    question: "Le paiement est-il sécurisé ?",
    answer:
      "Oui. Les paiements sont traités par Stripe (Checkout / Elements) : aucune donnée de carte ne transite par nos serveurs. Nous sommes en scope PCI-DSS SAQ A et utilisons l'authentification 3-D Secure si votre banque la demande.",
    keywords: ['paiement', 'payment', 'securite', 'security', 'secure', 'stripe', 'carte', 'card', 'pci', '3ds', '3-d', 'cb'],
  },
  {
    id: 'account-2fa',
    question: "Comment activer la 2FA sur mon compte ?",
    answer:
      "Dans Mon compte > Sécurité, activez l'authentification à deux facteurs (TOTP via une application comme Authy ou Google Authenticator). La 2FA est obligatoire pour les comptes admin.",
    keywords: ['2fa', 'mfa', 'totp', 'authenticator', 'authentication', 'authentification', 'double', 'facteur', 'compte', 'account', 'securite', 'security'],
  },
  {
    id: 'cancel',
    question: "Comment annuler mon abonnement ?",
    answer:
      "Depuis Mon compte > Abonnements, sélectionnez l'abonnement concerné et cliquez sur Annuler. L'accès reste actif jusqu'à la fin de la période en cours. Aucune reconduction tacite ensuite.",
    keywords: ['annuler', 'cancel', 'resilier', 'resiliation', 'arret', 'arreter', 'stop', 'desabonner', 'abonnement', 'subscription'],
  },
  {
    id: 'invoices',
    question: "Où trouver mes factures ?",
    answer:
      "Toutes vos factures sont dans la rubrique Commandes de votre espace personnel, téléchargeables au format PDF. Une copie est aussi envoyée par e-mail à chaque paiement.",
    keywords: ['facture', 'factures', 'invoice', 'invoices', 'pdf', 'commande', 'commandes', 'order', 'orders', 'recu', 'receipt'],
  },
  {
    id: 'demo',
    question: "Puis-je demander une démo ?",
    answer:
      "Oui. Contactez l'équipe via le formulaire Contact & support : nous planifions une démo personnalisée de 30 minutes adaptée à votre périmètre.",
    keywords: ['demo', 'demonstration', 'essai', 'trial', 'test', 'tester', 'rendez', 'vous', 'rdv', 'planifier'],
  },
  {
    id: 'gdpr',
    question: "Que devient mes données personnelles (RGPD) ?",
    answer:
      "Nous appliquons le RGPD : consentement explicite, droit d'accès, de rectification et à l'oubli, export sur demande. Les données sont hébergées en UE. Détails sur la page Politique de confidentialité.",
    keywords: ['rgpd', 'gdpr', 'donnees', 'data', 'personnel', 'personnelles', 'confidentialite', 'privacy', 'oubli', 'export', 'hebergement', 'ue', 'eu'],
  },
];

/**
 * Sous-ensemble proposé en boutons cliquables à l'ouverture du widget.
 * Choisi pour couvrir les sujets clés du site (produits + commercial + compte).
 */
export const SUGGESTED_IDS: string[] = [
  'soc',
  'edr',
  'xdr',
  'subscribe',
  'pricing',
  'payment-security',
  'account-2fa',
  'cancel',
];
