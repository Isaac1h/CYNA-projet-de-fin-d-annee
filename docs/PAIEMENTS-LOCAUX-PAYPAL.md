# Paiements locaux & PayPal — guide d'activation

**Tickets 57 / 30** — méthodes de paiement européennes locales (iDEAL, Bancontact, SEPA, etc.) et PayPal.

## TL;DR

Le code Cyna **ne hardcode pas** `payment_method_types` sur la session Checkout. Stripe utilise
automatiquement les méthodes activées dans **Dashboard > Settings > Payment methods** et les
filtre en fonction de la devise (`eur`), du pays et du montant. **Activer une méthode = 1 case à
cocher côté Dashboard, aucun redéploiement.**

Le seul changement code livré pour ce lot est `billing_address_collection: 'auto'` sur la session
Checkout (indispensable pour SEPA/iDEAL/Bancontact qui exigent une adresse de facturation ; la
carte reste inchangée).

## 1. Prérequis Dashboard Stripe

Se connecter sur https://dashboard.stripe.com (bascule test/live via le toggle en haut à droite —
**tester en mode test avant d'activer en live**).

Aller sur **Settings > Payment methods** (ou `dashboard.stripe.com/settings/payment_methods`).

Vous verrez une liste de méthodes regroupées par catégorie : cartes, wallets (Apple Pay, Google
Pay, PayPal, …), débits bancaires (SEPA), redirections bancaires (iDEAL, Bancontact, EPS, giropay,
Przelewy24…), buy now / pay later (Klarna, Afterpay…), etc.

Chaque méthode a un toggle **Turn on / Turn off** et affiche ses contraintes (devises, pays, mode
de règlement).

## 2. Méthodes par méthode

### 💳 Carte bancaire (déjà active par défaut)

- Devises : toutes
- Pays : tous
- Rien à faire, c'est ce qui marche déjà avec `4242 4242 4242 4242`.

### 🇳🇱 iDEAL (Pays-Bas)

- **Devise obligatoire** : `EUR`
- **Pays client** : `NL` (l'utilisateur choisira sa banque néerlandaise)
- **Type de paiement** : redirection bancaire, encaissement immédiat
- **Actions** : Turn on iDEAL dans Settings > Payment methods
- **Test mode** : Stripe fournit une simulation banque. Le client sera redirigé vers un
  formulaire test, choisira "Succeed" ou "Fail" et retombera sur `/checkout/success`.

### 🇧🇪 Bancontact (Belgique)

- **Devise obligatoire** : `EUR`
- **Pays client** : `BE`
- **Type** : redirection bancaire (avec possibilité de créer un mandat pour paiements récurrents
  via SEPA)
- **Actions** : Turn on Bancontact
- **Test mode** : simulation identique à iDEAL

### 🇪🇺 SEPA Direct Debit (prélèvement SEPA)

- **Devise obligatoire** : `EUR`
- **Pays client** : zone SEPA (UE + AELE + UK)
- **Type** : prélèvement automatique, **encaissement différé de 3 à 5 jours ouvrés**
- **Contrainte importante** : le mode `subscription` de Checkout nécessite que la méthode
  supporte les paiements récurrents. **SEPA convient** (le mandat couvre les futures échéances).
- **Actions** : Turn on **SEPA Direct Debit** (SDD). Cyna encaisse via IBAN, Stripe génère le
  mandat.
- **Test mode** : IBAN de test `DE89370400440532013000` — le paiement passe au bout de ~3 min
  dans les webhooks de test.
- **Attention prod** : le premier prélèvement peut être refusé (compte insuffisant). Stripe émet
  alors `invoice.payment_failed`, à surveiller côté monitoring.

### 🇩🇪 giropay, 🇦🇹 EPS, 🇵🇱 Przelewy24

- **Devise obligatoire** : `EUR` (sauf Przelewy24 qui accepte aussi `PLN`)
- **Pays client** : `DE` / `AT` / `PL` respectivement
- **Type** : redirection bancaire, paiement unique (non-récurrent)
- **⚠ Contrainte majeure** : ces méthodes sont **NON-RÉCURRENTES**. Or les produits Cyna sont
  vendus en abonnement (`mode: 'subscription'`). Stripe **filtrera automatiquement** ces méthodes
  et ne les proposera pas au Checkout Cyna. Ne pas s'alarmer si vous les activez et qu'elles
  n'apparaissent pas — c'est le comportement attendu.
- **Cas d'usage** : uniquement si Cyna proposera un jour du one-shot (`mode: 'payment'`) — hors
  scope actuel.

### 🅿️ PayPal (wallet)

- **Devises** : `EUR`, `USD`, `GBP`, `CAD`, `AUD`, `CHF`, `PLN`, `CZK`, `DKK`, `HKD`, `SEK`,
  `NOK`, `NZD`, `SGD`, `THB` — la liste complète est visible dans le Dashboard au moment de
  l'activation.
- **Pays client** : tous les pays supportés par PayPal
- **Prérequis exclusif** : **un compte marchand PayPal Business connecté à Stripe**. Sans ça, le
  toggle "PayPal" affichera une invite "Connect your PayPal account" et la méthode ne sera pas
  utilisable.
- **Actions** :
  1. Créer un compte PayPal Business sur https://paypal.com/business
  2. Dans le Dashboard Stripe : Settings > Payment methods > PayPal > **Connect PayPal**
  3. Suivre le flux OAuth PayPal → Stripe stocke le lien
  4. Toggle "On" une fois connecté
- **Type** : wallet, encaissement immédiat, **supporte les paiements récurrents** — donc marche
  avec `mode: 'subscription'` de Cyna.
- **Test mode** : Stripe fournit un environnement PayPal sandbox. Créer un compte acheteur test
  sur https://developer.paypal.com pour simuler des paiements.

## 3. Mode test vs mode live — piège à connaître

**En mode test Stripe** :
- Toutes les méthodes activées **s'affichent** au Checkout hébergé, y compris celles qui
  requièrent une configuration prod (PayPal sandbox, comptes marchand test).
- Pour les redirections bancaires (iDEAL/Bancontact/…), Stripe fournit des pages simulées
  neutres — utile pour vérifier le retour sur `/checkout/success` et le déclenchement du webhook.
- Pour PayPal : la connexion sandbox doit être faite explicitement, sinon la case sera grisée.

**En mode live** :
- Chaque méthode requiert d'être **activée dans le Dashboard live** (le toggle de test ne se
  propage pas). Toujours revérifier après passage en prod.
- Pour PayPal : il faut avoir **effectivement connecté un vrai compte marchand PayPal Business**.
- Pour SEPA : les mandats sont légalement contraignants, la première échéance peut prendre
  quelques jours à s'exécuter.

## 4. Effet côté code Cyna après activation Dashboard

Aucun redéploiement nécessaire. La session Checkout est créée sans `payment_method_types`, donc
Stripe applique :

1. Le sous-ensemble des méthodes activées dans le Dashboard
2. Compatibles avec la devise de la session (`eur` par défaut chez nous)
3. Compatibles avec le pays du client
4. Compatibles avec le mode `subscription` (élimine automatiquement les non-récurrentes comme
   giropay/EPS/Przelewy24)
5. Compatibles avec le montant total

Le client verra donc dans son Checkout hébergé Stripe : carte, iDEAL (s'il est en `NL`),
Bancontact (s'il est en `BE`), SEPA, PayPal — dans l'ordre que Stripe estime le plus pertinent
selon sa géolocalisation IP et son historique.

## 5. Suivi côté webhook Cyna

Rien à changer non plus. Le webhook `checkout.session.completed` traite déjà :
- Toutes les méthodes de paiement (le status est lu depuis `session.payment_status`, pas depuis
  la méthode)
- Le montant réellement facturé (`session.amount_total`, déjà utilisé depuis le ticket 55)
- Le pinning `stripe_invoice_id` (facture PDF hosted téléchargeable depuis `/my-account`)

**Cas particulier SEPA** : le `payment_status` peut être `unpaid` initialement (mandat créé mais
encaissement pas encore effectué). Le webhook mappe alors `orders.status = 'pending'`. Un
webhook ultérieur `invoice.payment_succeeded` fera passer à `'paid'`. Comportement déjà en place,
aucune modif nécessaire.

## 6. Adresse de facturation — pourquoi `billing_address_collection: 'auto'`

SEPA, iDEAL, Bancontact et certaines méthodes locales **exigent** une adresse de facturation pour
la conformité fiscale ou pour émettre le mandat (SEPA). Sans cette option, Stripe refuserait la
transaction pour ces méthodes.

`'auto'` demande à Stripe de collecter l'adresse **uniquement quand c'est requis** par la
méthode choisie. Impact zéro sur la carte (l'adresse reste optionnelle et n'apparaît pas dans le
formulaire card-only). Impact positif sur les méthodes locales : le champ apparaît
automatiquement quand le client les sélectionne.

Alternative `'required'` : Stripe demanderait l'adresse **systématiquement**, y compris pour
carte. Non retenu — mauvaise UX sur le flux 4242 qui marche sans.

## 7. Checklist d'activation avant démo jury

- [ ] Se connecter à https://dashboard.stripe.com en **mode test**
- [ ] Turn on **iDEAL** — vérifier via checkout depuis un compte client Cyna
- [ ] Turn on **Bancontact** — idem
- [ ] Turn on **SEPA Direct Debit** — tester avec IBAN `DE89370400440532013000`
- [ ] Turn on **PayPal** après création du compte sandbox PayPal Business
- [ ] Depuis un checkout Cyna : vérifier que les méthodes apparaissent (leur nombre variera
      selon le pays inféré par IP)
- [ ] Vérifier qu'un abandon (`cancel_url`) et qu'un succès (`success_url`) retombent bien sur
      les bonnes pages
- [ ] Vérifier que `orders` en base contient bien la ligne (méthodes locales → `status='paid'`
      immédiat, sauf SEPA qui peut passer par `'pending'` transitoire)

## 8. Ressources externes

- Doc Stripe méthodes de paiement : https://stripe.com/docs/payments/payment-methods/overview
- Test cards & IBANs de test : https://stripe.com/docs/testing
- Guide PayPal Stripe : https://stripe.com/docs/payments/paypal
- SEPA Direct Debit spec : https://stripe.com/docs/payments/sepa-debit
- Filtrage automatique par mode : https://stripe.com/docs/payments/checkout/payment-methods
