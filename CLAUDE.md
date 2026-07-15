# CLAUDE.md — Projet CYNA

## Projet
- E-commerce SaaS cybersécurité (SOC / EDR / XDR). Équipe 4, projet école B3.
- Ce repo = web uniquement. App mobile React Native dans un dépôt séparé.

## Stack
- Next.js 14 (App Router, RSC + Server Actions) + TypeScript strict + Tailwind + shadcn/ui (style "new-york", baseColor neutral, icônes lucide).
- Supabase : Auth (TOTP/AAL2), Postgres + RLS sur toutes les tables, RPCs SECURITY DEFINER `search_path=''`.
- Stripe : Checkout (mode subscription) + webhook signé + invoices hosted. Stripe CLI utilisée en dev pour forward les events.
- **i18n : next-intl** v4, préfixe `as-needed`, FR par défaut sans préfixe, EN sur `/en/*`. Détails § i18n.
- Source : `src/app/[locale]/` (routes utilisateur RSC), `src/app/api/` (routes API, HORS `[locale]`), `src/features/` (modules par domaine), `src/lib/data/` (couche Supabase typée, lecture jsonb locale-aware via `pickLocalised`), `src/lib/{supabase,stripe-server,...}.ts` (clients), `src/i18n/{routing,request,navigation}.ts` (config next-intl), `messages/{fr,en}.json` (traductions UI statiques).
- `src/legacy/` = code Vite/JS d'origine, plus importé nulle part. À supprimer une fois la confiance acquise.

## Rendu
- Next.js App Router, rendu SSR/SSG hybride ; catalogue et pages produit en RSC ; navigation client-side ; ISR `revalidatePath('/')` après mutations admin.
- Toutes les routes utilisateur vivent sous `src/app/[locale]/*` (segment dynamique). `generateStaticParams` pré-génère `fr` et `en` au build. Les routes API restent sous `src/app/api/*` **hors** de `[locale]` — aucun préfixe locale sur `/api/*`.

## Commandes
```bash
npm install
npm run dev        # next dev, port 3000
npm run build      # next build (le placeholder generate-llms.js encore appelé tolère son absence)
npm run lint       # next lint
npx tsc --noEmit   # typecheck (pas de script dédié dans package.json)
```
Pas de script `test` (à ajouter le jour où un harnais sera décidé — pour l'instant la vérif passe par lint + tsc + tests manuels + execute_sql via le MCP Supabase).

## Conventions de code
- TypeScript strict obligatoire pour tout nouveau fichier (`.ts` / `.tsx`, `strict: true`, pas de `any` implicite).
- Migration des `.jsx` existants vers `.tsx` au fil des modifications significatives, pas en big bang.
- SOLID. Aucune logique métier dans `src/components/ui/` (réservé au design system).
- Nommage :
  - `PascalCase` pour les composants React (`ProductCard.tsx`).
  - `camelCase` pour variables, fonctions et hooks. Hooks préfixés `use` (`useCart`).
  - `kebab-case` pour fichiers non-composants et fichiers shadcn (`use-toast.ts`, `dropdown-menu.tsx`).
  - `SCREAMING_SNAKE_CASE` pour constantes d'environnement.
- Architecture modulaire par feature (`src/features/<feature>/`) dès qu'un domaine dépasse 3 fichiers.

## Layout cible
```
src/
  app/             # routes Next.js App Router
  components/
    ui/            # shadcn (style "new-york", baseColor neutral, icônes lucide) — pas de logique métier
    <shared>/      # composants partagés (Header, Footer, …)
  features/        # modules par domaine : catalogue, checkout, account, admin
  lib/             # clients (supabase, stripe), helpers, validation
  hooks/           # hooks React partagés
  context/         # providers globaux
```
Tokens design dans `src/index.css` (variables HSL, primary `#2B2086`).

## Authentification
- Jamais de hash de mot de passe maison. Jamais côté client.
- `src/lib/auth.js` (SHA-256 client) est provisoire et doit être supprimé à la mise en place de Supabase Auth.
- Authentification = Supabase Auth uniquement (bcrypt côté serveur, JWT signé Supabase).
- Validation client (format email, complexité mot de passe) tolérée mais ne remplace jamais la validation serveur.

## Sécurité
- RBAC + RLS Supabase sur **toutes** les tables.
- MFA/2FA obligatoire pour `/admin` — enforcé par `src/middleware.ts` (pages) ET par le guard `src/lib/admin/require-aal2.ts` appelé au top des 15 handlers `/api/admin/*` (mutations). Réponse standardisée `403 { error: 'aal2 required', step_up_path: '/admin/verify' }` pour permettre à l'UI de rediriger le client.
- **F2 vs F3 (dette assumée)** : le guard AAL2 ferme le gap de MUTATION via API. Les policies RLS `*_admin_read` (categories/carousel/homepage_content/admin_audit_log) restent gatées par `is_admin()` seul, qui ne considère PAS l'AAL — un admin AAL1 peut donc LIRE ces tables via `supabase-js` directement (pas via API). Risque de lecture, pas d'écriture. Un lot F3 dédié (rendre `is_admin()` AAL2-aware côté DB) fermera ce résiduel avec tests de non-régression sur chaque section BO — non planifié dans ce lot.
- Aucun `dangerouslySetInnerHTML` sans sanitization explicite.
- CSRF : cookies `SameSite=Lax` minimum + double-submit sur mutations sensibles.
- Aucune requête SQL en concaténation de string — toujours via le client Supabase paramétré.
- Paiements : Stripe Checkout / Elements uniquement. Aucune donnée de carte ne transite par nos serveurs.
- RGPD : consentement explicite, droit à l'oubli, export des données utilisateur, journalisation des accès.
- Secrets : `.env.local` git-ignored, aucun secret commité, valeurs sensibles en variables d'environnement Hostinger / Supabase vault.

## Contraintes UX
- Mobile-first. Toute nouvelle UI démarre au breakpoint < 640px puis remonte.
- Recherche catalogue < 100 ms. Index Postgres (`pg_trgm` ou full-text) côté Supabase. Pas de filtrage client sur listes non bornées.
- WCAG 2.1 AA : navigation clavier complète, attributs `aria-*` sur composants custom, focus visible, contrastes vérifiés sur palette dark.

## i18n
- **Librairie** : `next-intl@4` (App Router first). Plugin activé dans `next.config.mjs` via `createNextIntlPlugin('./src/i18n/request.ts')`.
- **Locales supportées lot 1** : `fr` (défaut), `en`. `ar` / `he` (RTL) prévues lot 2 — le layout applique déjà `<html lang={locale} dir={dir}>` dynamique (constante `RTL_LOCALES` en place, inactive).
- **Routage** : `localePrefix: 'as-needed'` → `/checkout` = FR, `/en/checkout` = EN. Zéro régression des URLs FR déjà indexées.
- **Fichiers de config** : `src/i18n/routing.ts` (locales/default/prefix), `src/i18n/request.ts` (RSC message loader avec fallback FR si locale non-reconnue), `src/i18n/navigation.ts` (Link/useRouter/usePathname/redirect locale-aware — à préférer à `next/link` et `next/navigation` pour tout ce qui touche à un pathname localisé).
- **Middleware composé** — `src/middleware.ts` compose next-intl + le gate admin AAL2 (F2) sans les entrelacer. Le matcher exclut `/api/*`, `/_next/*`, `/_vercel/*` et les fichiers statiques → **aucune route API n'est jamais préfixée par une locale**, non-régression stricte du webhook Stripe et des 15 routes `/api/admin/*`. Le gate AAL2 (getUser → profile.role → mfa.getAuthenticatorAssuranceLevel) est inchangé fonctionnellement ; ses redirects passent par `withLocalePrefix()` pour préserver la locale courante.
- **UI statique** : `messages/{fr,en}.json` en **strict miroir** (parity ≥ 648 clés au lot 1, à vérifier programmatiquement à chaque évolution). Organisation par domaine (`nav`, `home`, `productCard`, `catalogue`, `product`, `category`, `search`, `cart`, `checkout`, `checkoutSuccess`, `account.*`, `orders`, `orderCard`, `tools`, `contact`, `legal.*`, `admin.*`, `auth`, `common`, `pagination`, `cookieConsent`, `chatbot`, `footer`). Les valeurs peuvent contenir des placeholders ICU (`{name}`), des pluriels (`{count, plural, ...}`) et des tags (`<em>{value}</em>` → résolus via `t.rich`).
- **Contenu dynamique** : les tables `products`, `categories`, `carousel_slides`, `homepage_content`, `product_images` stockent leur texte dans des colonnes jsonb `{fr, en, ...}`. Les loaders `src/lib/data/*` appellent `pickLocalised(field, locale)` (fallback FR si EN manque) — **pas de migration DB requise pour ajouter une langue**. L'édition bilingue en BO reste hors périmètre du lot 1 (les form BO n'écrivent que la clé `fr` ; le fallback prend le relais côté front).
- **Validation** : les modules `validation.ts` (checkout billing, address book, contact form) retournent des **clés i18n** (ex. `billing.errors.emailInvalid`) ou des tuples `{ key, values }` — jamais de messages français en dur. Les composants les résolvent via `t()` avec interpolation des bornes numériques quand pertinent.
- **Sélecteur de langue** : `src/components/LanguageSwitcher.tsx` monté dans le Header. Persistance via cookie `NEXT_LOCALE` (géré par next-intl).
- **Ce que ce lot NE fait PAS** :
  - Le `success_url` du checkout Stripe pointe toujours vers `/checkout/success` sans préfixe : un user EN qui paye revient sur la page FR. Correctif optionnel identifié, non planifié.
  - Le corpus FAQ du chatbot (5 réponses SOC/EDR/XDR/tarif/facture) reste en FR côté EN — clés i18n en place, corpus EN à écrire dans un lot dédié.
  - Le corps des pages légales (`mentions-legales`, `cgu`, `confidentialite`) reste FR (contient encore des `[À COMPLÉTER]`, non shippable) — H1 + label "Dernière mise à jour" + metadata traduits + bannière EN `legal.onlyFrenchNotice` qui prévient les non-francophones. Traduction complète attendra l'équipe légale.
  - `is_admin()` en base reste AAL-blind pour la lecture (voir § Sécurité, dette F2 vs F3) — indépendant du lot i18n.

## Commits
- Conventional Commits obligatoires. Préfixes autorisés : `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Un commit = un changement atomique. Message à l'impératif présent.
- Pas de `wip`, `update`, `fix bug` sans détail.

## Git
- À versionner : `CLAUDE.md`, `.claude/settings.json` (hooks partagés, s'il existe).
- À ignorer : `.claude/skills/`, `.claude/settings.local.json`, `.env*` (sauf `.env.example`), `.agents/`, `node_modules/`, `dist/`, `.next/`, `out/`.

## Workflow Claude Code (v2.1.148)
Slash commands utilisables sur ce projet :
- `/code-review` — review du diff courant avant PR.
- `/security-review` — passage sécurité avant merge (RLS, JWT, Stripe, XSS/CSRF).
- `/review` — review d'une pull request GitHub donnée.
- `/verify` — lance l'app et vérifie qu'un changement marche réellement.
- `/run` — démarre l'app pour tests manuels.
- `/find-skills` — recherche de skills tiers.
- `/graphify` — graphe de connaissance du repo (skill installé localement).
- `/update-config` — édition contrôlée de `.claude/settings.json` (hooks, permissions).

---

## État de recette (2026-07-04)

> Synthèse du dernier point de recette navigateur. Mise à jour à chaque
> bloc de tests validés ou correctifs livrés. Ne pas re-tester ni modifier
> ce qui est marqué ✅ sans raison nouvelle.

### ✅ Validé en navigateur — **ne plus y toucher**

**Bloc i18n LOT 1 (FR/EN, LTR)** — livré en 5 sous-lots A→E, tous validés en navigateur (2026-07-04) :
- A (data layer locale-aware) : loaders `src/lib/data/*` picks du bon jsonb selon la locale, fallback FR ; `/en/catalogue`, recherche, filtres, fiche produit en EN, aucune régression FR (`CAT-04` préservé).
- B (cart / checkout / success / account) : `CHK-01` (4242 de bout en bout) validé **en FR ET en EN** ; gate admin AAL2 intact ; compte (personal info, adresses, méthodes de paiement, abonnements, 2FA) en EN OK ; `formatPrice` corrigé (Intl.NumberFormat locale-aware, plus de `$` en dur) ; `validation.ts` retourne des clés i18n.
- C (contact / orders / pages légales) : formulaire contact + chatbot + `/orders` en FR/EN ; pages légales gardent leur corps FR (contient `[À COMPLÉTER]`) avec bannière EN `legal.onlyFrenchNotice` ; `/a-propos` traduite intégralement.
- D (admin BO) : dashboard, produits, promos, commandes, catégories, carrousel, home-content, messages contact, prix — tout traduit avec priorité FR ; **AAL2 gate intact** ; routes `/api/admin/*` inchangées.
- E (auth + polish) : login, register, forgot-password, reset-password ; toasts transverses, messages d'erreur globaux ; parité JSON finale ≥ 648 clés miroir.

**Deux finitions optionnelles** identifiées, non planifiées : (1) `success_url` du checkout Stripe qui ramène en FR même quand la session est EN, (2) corpus FAQ chatbot encore FR côté EN. Clés en place, texte EN à écrire.


**Bloc ADMIN**
- Accès `/admin` : refus visiteur (`SEC-01`), refus client non-admin (`SEC-02`), accès admin après 2FA (`SEC-04`), lien Admin masqué pour client/visiteur (`SEC-06`).
- 2FA : enrôlement TOTP fonctionnel (`SEC-05`).
- Produits : création (`BO-01`), refus champs invalides/slug doublon (`BO-02`/`BO-03`), modification (`BO-04`), désactivation/réactivation (`BO-06`), tri (`BO-08`), filtres Tous/Actifs/Désactivés (`BO-09`), pagination (`BO-10`).
- Dashboard : graphes + KPI (`BO-11`), bascule 7j/5sem (`BO-12`), cohérence chiffres (`BO-13`).
- Commandes admin : liste complète + détail (`BO-14`/`BO-15`).
- Carrousel : create/edit/reorder/désactivation/suppression (`BO-16` → `BO-20`).
- Catégories : create/edit/reorder (`BO-21`/`BO-22`/`BO-23`), suppression catégorie avec produits → propose Désactiver, aucun orphelin (`BO-24`), messages d'erreur slug précis (`BO-25`).
- Messages contact : lecture + changement statut (`BO-26`/`BO-27`, persistance à reconfirmer).

**Bloc CLIENT**
- Auth : connexion + erreurs (`AUTH-04`), redirection après login (`AUTH-05`), front `/forgot-password` + `/reset-password` sans token (`AUTH-03` partiel).
- Catalogue/recherche : page catégorie (`CAT-01`), tri+stock (`CAT-02`), fiche produit complète (`CAT-03`), filtre catégorie (`CAT-05`), tris (`CAT-06`), **recherche texte corrigée et validée (`CAT-04`)**.
- Panier : contenu (`PAN-01`), quantité+total dynamique (`PAN-02`).
- Achat : 4242 de bout en bout (`CHK-01`), commande dans historique (`CHK-02`), mensuel/annuel (`CHK-03`), refus `4000…0002` sans commande (`CHK-04`), 3DS (`CHK-05`), **checkout sans session corrigé → "Se connecter pour payer" (`CHK-06`)**.
- Compte : infos perso persistées (`ACC-01`), carnet d'adresses + confirmation suppression (`ACC-02`), résiliation/réactivation abonnement (`ACC-03`), téléchargement facture (`ACC-04`).
- Contenu : formulaire contact (`SUP-01`), chatbot réponse + escalade (`SUP-03`/`SUP-04`).

**Correctifs livrés et validés** : confirmation suppression sur produits/slides/catégories + adresses (`ConfirmDialog` partagé), messages d'erreur slug, recherche catalogue, checkout sans session, liens sociaux morts retirés, focus clavier visible (WCAG), UI de modification de prix câblée sur `/api/admin/prices/[id]`.

### ⏳ Reste à tester (humain, hors capacité agent)

- `BO-05` — rejouer modif prix (49 → 60) → achat 4242 → facture au nouveau montant (ferme ANO-004).
- `PAN-03` — produit en rupture → refus d'ajout au panier.
- `RWD-01` — vue mobile DevTools (375/768 px) : burger menu, débordements.
- `AUTH-03` complet — clic sur le lien email réel.
- `SEC-03` — comportement du step-up 2FA selon que le compte a déjà un facteur enrôlé (à trancher).
- `BO-27` persistance — recharger après archivage d'un message.
- `ACC-05` — méthodes de paiement (ticket 22) livré : ajouter carte 4242, la voir listée avec brand/last4/expiration, ajouter une 2e, marquer par défaut (persistance après refresh), supprimer via ConfirmDialog. **Isolation cross-user obligatoire** : depuis un compte A, `DELETE /api/account/payment-methods/pm_<id-de-B>` et `PATCH /api/account/payment-methods/pm_<id-de-B>/default` doivent renvoyer 404 indifférencié (pas 403/500).

### 🧹 Données / config à nettoyer avant démo

- Produits de test (`"Produit BO-05 Test Prix"` à 0 €/an, autres `"…test…"`) → à corriger ou supprimer.
- Pages légales (`/mentions-legales`, `/cgu`, `/confidentialite`) : nombreux `[À COMPLÉTER]` (raison sociale, hébergeur, RCS/SIRET, DPO).
- Confirmation d'inscription par email (`AUTH-01`/`AUTH-02`) : réglage Supabase "Confirm email" actuellement désactivé. Sera traité avec le **ticket 39** (notifications email — même dépendance d'envoi).

### 🔜 Prochain code — Phase B : ticket 39 (notifications email)

Couplé à l'activation de la confirmation d'inscription. Cadrer AVANT de coder :
- Service d'envoi (Resend / SendGrid / SMTP Supabase managé)
- Points de branchement : `auth signUp`, `checkout.session.completed`, `customer.subscription.updated` (résiliation programmée, échec paiement)
- Gestion d'erreur : un envoi raté ne doit JAMAIS bloquer un paiement Stripe (queue / retry / log + alerte admin)
- Templates : FR par défaut, en-tête Cyna, lien de désabonnement RGPD

**Action attendue** : ne pas attaquer le code tant que le prompt de cadrage n'a pas été envoyé.
