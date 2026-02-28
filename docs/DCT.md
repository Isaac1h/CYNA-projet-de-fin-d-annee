# Dossier de Conception Technique — CYNA

**Projet** : plateforme e-commerce SaaS de cybersécurité (SOC / EDR / XDR).
**Périmètre de ce document** : application web (ce dépôt). L'application mobile
React Native vit dans un dépôt séparé et n'est pas couverte ici.

Ce document décrit l'architecture *réelle* du dépôt à date — pas une cible
idéalisée. Il est rédigé à partir d'une lecture directe du code et des
migrations Supabase.

---

## 1. Vue d'ensemble

La plateforme est une **Single Page Application Next.js 14** (App Router) qui
s'appuie sur **trois services managés** :

- **Supabase** — Auth (JWT, MFA TOTP), Postgres 15+ avec RLS, RPC SECURITY
  DEFINER pour les opérations sensibles (commande, agrégats admin, CRUD
  produit).
- **Stripe Checkout hébergé** — paiement et abonnement. Aucune donnée carte ne
  transite par notre origine (PCI-DSS, scope SAQ A par redirection).
- **Vercel / Hostinger** (déploiement Next.js).

Le client (navigateur) parle directement à Supabase pour les lectures (gatées
par RLS) et à des **route handlers Next.js** server-side pour les actions
sensibles (création de session Stripe, mutations admin). Stripe parle au
backend uniquement par **webhook signé**.

```
+-------------------+     anon-key + JWT     +-------------------+
|                   | <===================== |                   |
|   Browser SPA     |   read via RLS         |   Supabase        |
|   (Next.js 14)    |                        |   - Auth          |
|                   |  ----------- mutation  |   - Postgres+RLS  |
|                   |  ---->  RPC SECURITY   |   - RPC SECDEF    |
+--------+----------+        DEFINER         +-------+-----------+
         |                                           ^
         | POST /api/checkout/session                | service_role
         | POST /api/admin/products/[id]             | (webhook only)
         v                                           |
+-------------------+                        +-------+-----------+
|  Next.js routes   |  Stripe API            |  Webhook handler  |
|  (server-side)    | =====================> |  /api/webhooks/   |
|  - checkout       |  Stripe Checkout       |   stripe          |
|  - admin/products | <===================== |                   |
+-------------------+    webhook signed      +-------------------+
                                                     ^
                                                     |
                                            +--------+--------+
                                            |     Stripe       |
                                            |  - Checkout      |
                                            |  - Prices        |
                                            |  - Subscriptions |
                                            |  - Webhooks      |
                                            +------------------+
```

---

## 2. Stack technique

### Frontend

- **Next.js 14.2** (App Router, rendu hybride : SSR pour les routes
  authentifiées, SSG / ISR pour le catalogue, dynamic pour la recherche).
- **React 18.3**, **TypeScript strict**.
- **Tailwind CSS 3.4** + design system **shadcn** (style "new-york", base
  `neutral`), icônes **lucide-react**.
- **framer-motion** pour quelques animations (carrousel d'accueil).
- État global :
  - `AuthContext` (`src/context/AuthContext.tsx`) — session Supabase, profil,
    flags `currentUser` / `loading`.
  - `CartContext` (`src/context/CartContext.tsx`) — panier en `localStorage`
    avec clé namespacée par utilisateur (`cart:{userId}` ou `cart:anonymous`).

### Backend

- **Supabase managé** :
  - **Auth** : email + password, MFA TOTP, JWT signés. La validation se fait
    via `getUser()` (round-trip vers le serveur Auth, jamais via le cookie
    local).
  - **Postgres 15+** avec **Row Level Security** activée sur toutes les
    tables métier. Étendue `pgcrypto`, `pg_trgm`, `citext`.
  - **PostgREST** (lectures CRUD via le client `@supabase/supabase-js`).
  - **RPC** (procédures stockées `SECURITY DEFINER`) pour toutes les
    mutations sensibles.
- Pas d'Edge Function Supabase dans ce dépôt : les actions backend qui
  doivent appeler des APIs externes (Stripe Checkout, webhook handler) sont
  des **route handlers Next.js** server-side (`src/app/api/**/route.ts`).

### Paiement

- **Stripe Checkout hébergé** (mode `subscription`). Aucune carte côté nous.
- **Webhook signé** (signature vérifiée via le `whsec_` propre à
  l'environnement).
- Les Stripe Price objects sont créés une fois pour toutes par un script
  manuel (`tools/seed-stripe-prices.mjs`) et leur identifiant `price_xxx`
  est stocké dans `public.prices.stripe_price_id`.

### Outillage

- **ESLint** (`next lint`), **TypeScript** (`tsc --noEmit`), pas de framework
  de test installé à ce jour.
- Migrations Supabase versionnées dans `supabase/migrations/`, appliquées via
  le CLI ou l'agent MCP.

---

## 3. Architecture applicative

### Couches

| Couche                    | Localisation                            | Rôle |
|---                        |---                                      |---  |
| Routes Next.js (RSC)      | `src/app/**/page.tsx`                   | Rendu pages, métadonnées, SSG/ISR. |
| Composants UI             | `src/components/ui/`                    | shadcn — pas de logique métier. |
| Composants partagés       | `src/components/`                       | Header, Footer, ProductCard, CookieConsent. |
| Features métier           | `src/features/<domaine>/`               | Auth, checkout, account, admin, orders, contact. |
| Accès données             | `src/lib/data/`                         | `getProducts`, `getCategories`, `getOrders`, `getCarouselItems`. |
| Clients d'infrastructure  | `src/lib/supabase*.ts`, `lib/stripe*.ts`| Singletons typés pour Supabase / Stripe. |
| Route handlers API        | `src/app/api/**/route.ts`               | `checkout/session`, `webhooks/stripe`, `admin/products/[id]`. |
| Middleware                | `src/middleware.ts`                     | Gate `/admin/*` côté serveur. |
| Contextes globaux         | `src/context/`                          | `AuthContext`, `CartContext`. |

### Routes Next.js

| Route                                    | Type      | Notes |
|---                                       |---        |---    |
| `/`                                      | `○` static | Accueil (carrousel, top produits). Revalidé à la mutation admin. |
| `/catalogue`                             | `ƒ` dynamic| Catalogue avec filtres/tri. |
| `/category/[id]`                         | `●` SSG    | Page catégorie. `[id]` = slug catégorie. Revalidé à la mutation admin. |
| `/product/[id]`                          | `●` SSG    | Fiche produit. `[id]` = slug produit (`getProductById` filtre par `slug`). |
| `/search`                                | `ƒ` dynamic| Recherche full-text. |
| `/cart`                                  | `○` static | Panier (rendu client après hydratation). |
| `/checkout` + `/checkout/success`        | `○` static | Tunnel + page de confirmation post-paiement (polling RLS sur `orders`). |
| `/login`, `/register`                    | `○` static | Auth (Supabase). |
| `/my-account`                            | `○` static | Profil, adresses, méthodes de paiement (placeholder Stripe), MFA TOTP. |
| `/orders`                                | `○` static | Historique commandes utilisateur. |
| `/admin`, `/admin/verify`                | `○` static | Backoffice + step-up MFA. Gate middleware. |
| `/cgu`, `/mentions-legales`, `/confidentialite` | `○` static | Pages légales. |

### Routes API

Voir `docs/openapi.yaml` pour la spec complète. Trois familles :

- **Checkout** : `POST /api/checkout/session` (création session Stripe).
- **Webhooks** : `POST /api/webhooks/stripe` (réception events Stripe).
- **Admin** : `PATCH /api/admin/products/[id]`, `DELETE /api/admin/products/[id]`.

Les autres mutations (gestion du compte, panier) passent directement par le
SDK Supabase côté client, gatées par RLS.

---

## 4. Schéma de données

### Catalogue

| Table              | Description |
|---                 |---           |
| `categories`       | Catégories de produits. `name` et `description` sont des jsonb i18n `{fr, en, ar, he}`. `display_order`, `is_active`. |
| `products`         | Produits SaaS. `name`, `description` i18n jsonb. `specs` jsonb. `availability` enum (`in_stock`/`limited`/`out_of_stock`), `priority` int, `is_featured` bool, `is_active` bool. Colonne générée `search_fr` (`tsvector` français). FK `category_id → categories.id`. |
| `product_images`   | Galerie. `url`, `position`, `alt` jsonb i18n. CASCADE sur suppression du produit. |
| `prices`           | Tarifs. Un product peut avoir plusieurs prices (mensuel/annuel × flat/per_user). `unit_amount` en centimes, `currency` (`eur`). `stripe_price_id` (UNIQUE) miroir du Stripe Price object. CASCADE sur suppression du produit. |
| `carousel_slides`  | Slides d'accueil. `title`, `subtitle`, `cta_text` jsonb i18n. `image_url`, `cta_link`, `display_order`, `is_active`. |

### Utilisateurs

| Table        | Description |
|---           |---           |
| `profiles`   | Une ligne par `auth.users.id`. `role` enum `client|admin`, `full_name`, `is_active`, `stripe_customer_id` (UNIQUE). Créée par trigger `on_auth_user_created`. |
| `addresses`  | Carnet d'adresses. `is_default` avec contrainte « 1 default par user » via trigger `enforce_single_default_address` + index partial UNIQUE. CASCADE sur suppression du profil. |

### Commerce

| Table              | Description |
|---                 |---           |
| `orders`           | En-tête commande. `order_number` (UNIQUE, généré côté RPC), `status` enum (`pending|paid|cancelled|refunded`), `subtotal_amount` + `total_amount` en centimes, `currency`. Adresse de facturation FIGÉE dans des colonnes `billing_*`. Identifiants Stripe : `stripe_payment_intent_id`, `stripe_checkout_session_id` (index partial UNIQUE). |
| `order_items`      | Lignes commande, snapshot figé : `product_name_snapshot`, `billing_interval`, `unit_type`, `unit_amount`, `quantity`, `line_total`. `product_id → products.id ON DELETE SET NULL` (historique préservé même si le produit est supprimé). |
| `subscriptions`    | Abonnements Stripe. `stripe_subscription_id` (UNIQUE), `status` enum 8 valeurs 1:1 avec Stripe, `current_period_start/end`, `cancel_at`, `cancel_at_period_end`. |
| `stripe_events`    | Journal d'idempotence du webhook. PK = `event.id` Stripe. Aucune lecture côté client (revoke all from anon+authenticated). |

### Diagramme relationnel simplifié

```
categories 1---* products 1---* product_images
                 |  |
                 |  +----* prices ---- stripe_price_id ---> [Stripe Price]
                 |
                 +-(history)-* order_items *---1 orders
                                              *
                                              |
                                              v
profiles 1---* orders               profiles 1---* subscriptions ---- stripe_subscription_id
profiles 1---* addresses                                        |
profiles 1---* subscriptions                                    +--- stripe_customer_id
                                                                |
                                                                +--- price_id -> prices

stripe_events (independent, idempotency log)
```

### Migrations versionnées

```
20260617120000_data_schema.sql              -- Lot A : catalogue + RLS lecture publique
20260617130000_auth_profiles.sql            -- Lot B : profiles + is_admin() + RLS
20260617140000_auth_profiles_lock_anon.sql  -- Lot B : revoke anon sur profiles
20260618130000_orders_addresses.sql         -- Lot C : orders, order_items, addresses, place_order()
20260619100000_stripe_schema.sql            -- Lot D : Stripe schema + RPC service_role
20260619100100_stripe_rpcs_revoke_…         -- Lot D : revoke from anon/authenticated
20260619200000_revoke_place_order_…         -- Lot D : revoke place_order() from authenticated
20260619210000_admin_dashboard_rpcs.sql     -- Lot E : RPCs agrégats dashboard
20260619220000_set_updated_at_search_path   -- Hardening : set_updated_at search_path locked
20260619230000_admin_product_rpcs.sql       -- Lot E.2 : RPCs CRUD produit (sans prix)
20260619240000_products_admin_read.sql      -- Lot E.2 : policy admin SELECT sur products
```

---

## 5. Sécurité

### 5.1 Authentification et identité

- **Inscription/connexion** : `supabase.auth.signUp` / `signInWithPassword`.
  Hashage des mots de passe : délégué à Supabase (bcrypt côté serveur). Aucun
  hash maison.
- **Session** : JWT signés Supabase, stockés dans des cookies HTTP-only via
  `@supabase/ssr` (browser + middleware utilisent le même format).
- **Profil** : créé par trigger `on_auth_user_created → handle_new_user()`
  qui insère une ligne dans `public.profiles` avec `role = 'client'` par
  défaut. Le rôle ne peut pas être modifié côté client (column grant explicite).
- **MFA TOTP** : `supabase.auth.mfa.enroll`/`verify`/`unenroll`. UI dans
  `/my-account#two-factor`. **Obligatoire pour les admins** sur `/admin/*`.

### 5.2 Autorisation : 3 couches

1. **Middleware Next.js** (`src/middleware.ts`) — autoritatif sur `/admin/*`.
   - Bounce les non-authentifiés vers `/login?from=…`.
   - Bounce les non-admins vers `/`.
   - Bounce les admins en AAL1 vers `/admin/verify` (step-up TOTP).
   - Bounce les admins sans facteur TOTP vers `/my-account?reason=mfa_required`.
   - Le middleware lit `profiles.role` via la session de l'utilisateur (RLS
     `profiles_self_or_admin_read`), jamais via service_role.
2. **Garde UI** (`isAdmin()` dans `src/features/admin/guard.ts`) — purement UX,
   masque les liens admin du header avant que la SPA ait fini de résoudre la
   session. Facilement contournable, sert juste à éviter un flash.
3. **RLS Postgres** — couche de défense ultime. Chaque table métier a des
   policies explicites. Voir §5.4.

### 5.3 Fonction `public.is_admin()`

```sql
create function public.is_admin() returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;
```

- `SECURITY DEFINER` — exécutée comme le rôle propriétaire (`postgres`,
  bypass RLS) sinon récursion infinie.
- `set search_path = ''` — protège contre un attaquant qui forcerait un
  `public` malveillant.
- Utilisée dans toutes les policies RLS et au début de chaque RPC admin
  pour la double barrière.

### 5.4 Politiques RLS

| Table             | Anon              | Authenticated client                    | Admin |
|---                |---                |---                                       |---    |
| `categories`      | SELECT (is_active) | SELECT (is_active)                       | SELECT (is_active) — *pas de policy admin distincte aujourd'hui* |
| `products`        | SELECT (is_active) | SELECT (is_active)                       | SELECT (is_active OR `is_admin()`) — policy `products_admin_read` ajoutée pour voir les soft-deleted |
| `product_images`  | SELECT (true)     | SELECT (true)                            | SELECT (true) |
| `prices`          | SELECT (is_active) | SELECT (is_active)                       | SELECT (is_active) — limite connue, voir §8 |
| `carousel_slides` | SELECT (is_active) | SELECT (is_active)                       | SELECT (is_active) |
| `profiles`        | aucun             | SELECT/UPDATE soi-même (column grants)   | SELECT toutes (via `is_admin()`) |
| `addresses`       | aucun             | SELECT/INSERT/UPDATE/DELETE soi-même     | SELECT toutes (via `is_admin()`) |
| `orders`          | aucun             | SELECT siennes                           | SELECT toutes (via `is_admin()`) |
| `order_items`     | aucun             | SELECT via EXISTS sur ses orders         | SELECT toutes (via `is_admin()`) |
| `subscriptions`   | aucun             | SELECT siennes                           | SELECT toutes (via `is_admin()`) |
| `stripe_events`   | aucun             | aucun (revoke all)                       | aucun (lecture admin via SQL direct uniquement) |

**Aucune table métier n'accorde d'INSERT/UPDATE/DELETE à `authenticated` en
direct**, à l'exception d'`addresses`. Toute autre écriture (commande, profil
admin, produit) passe par une RPC SECURITY DEFINER avec garde `is_admin()`.

### 5.5 RPC SECURITY DEFINER — pattern de durcissement

Toutes les RPC admin (`admin_update_product`, `admin_delete_product`,
`admin_daily_sales`, `admin_category_shares`,
`admin_category_average_baskets`, `admin_dashboard_kpis`) suivent le **même
pattern à 3 verrous** :

1. **Première instruction du corps** :
   ```sql
   if not public.is_admin() then
     raise exception 'forbidden: admin only' using errcode = '42501';
   end if;
   ```
2. **`set search_path = ''`** sur la fonction — un attaquant ne peut pas
   shadowiser `is_admin()` via un `search_path` malveillant.
3. **`revoke execute … from public, anon`** + **`grant execute … to
   authenticated, service_role`**. La barrière de grant n'écarte qu'anon ;
   l'autorisation admin repose sur (1) + (2).

Les RPC orchestrées par le webhook (`place_order_for_user`,
`upsert_subscription_from_stripe`) sont **encore plus restrictives** :
elles sont grantées uniquement à `service_role` (jamais à `authenticated`)
et `public.place_order()` historique est explicitement révoquée pour
`authenticated` (migration `20260619200000`) — la création de commande ne
peut se faire que par le webhook signé.

`set_updated_at` (trigger générique `updated_at`) a aussi été migrée vers
`set search_path = ''` + `pg_catalog.now()` pour ne pas être un point faible.

### 5.6 Sécurité applicative

- **Open redirect** : `safeRedirectTarget()` (`src/features/auth/redirect.ts`)
  rejette les URLs protocole-relatives et externes pour le param `?from=`.
- **XSS** : React échappe par défaut. Aucun usage de
  `dangerouslySetInnerHTML` repéré dans le code applicatif.
- **CSRF** : les mutations sensibles passent par des routes Next.js
  same-origin avec cookies SameSite par défaut Supabase (`Lax`). Les routes
  admin re-vérifient la session via `supabase.auth.getUser()` côté serveur
  avant d'appeler la RPC, défense en profondeur.
- **SQL injection** : 100 % des requêtes passent par le client paramétré
  `@supabase/supabase-js`. Aucune concaténation SQL côté code.
- **PCI-DSS** : Stripe Checkout hébergé → scope SAQ A. Aucune iframe Stripe
  Elements, aucune donnée carte ne touche notre origine.
- **Webhook signature** : `stripe.webhooks.constructEvent(rawBody,
  signature, secret)` avec le body brut (`request.text()`) — pas de
  `request.json()` qui ré-ordonnerait les clés et casserait l'HMAC.

### 5.7 Conformité RGPD (état actuel)

- `addresses.user_id` et `orders.user_id` sont en `ON DELETE CASCADE` pour
  le MVP. La vraie conservation légale (factures ~10 ans en France) implique
  un passage en **anonymisation** (user_id NULL + nullifier `billing_*` /
  `email`) au lot RGPD. À traiter avant production.
- Consentement cookies : bannière `CookieConsent` (`src/components/`),
  préférence en `localStorage` avec clé `cyna-cookie-consent`.

---

## 6. Flux de paiement Stripe

### 6.1 Création de la session Checkout (`POST /api/checkout/session`)

1. Authentification : `getServerSupabase().auth.getUser()` → 401 si non
   connecté.
2. Validation du body : `items[].productSlug`, `subscriptionDuration`,
   `quantity ≥ 1`, `billing` requis.
3. **Résolution serveur** des `stripe_price_id` :
   - Lookup `products.slug` → `product_id`.
   - Lookup `prices(product_id, billing_interval, unit_type, is_active)` →
     `stripe_price_id`.
   - **Le client n'envoie jamais ni montant, ni price_id, ni stripe_price_id.**
4. Get-or-create du Stripe Customer pinné sur
   `profiles.stripe_customer_id` (avec gestion de race `23505` sur la
   contrainte UNIQUE).
5. Création de la `Stripe.Checkout.Session` (`mode: 'subscription'`) avec :
   - `client_reference_id = user.id` (autoritaire côté webhook),
   - `metadata.user_id = user.id` (mirror),
   - `subscription_data.metadata.user_id = user.id` (mirror sur les
     events `customer.subscription.*`),
   - `metadata.billing_*` = snapshot de l'adresse (clés séparées car
     limite Stripe 500 chars/valeur ; jsonb recomposé côté webhook).
6. Retour `{ url: session.url }`. Le client fait `window.location.assign(url)`.

### 6.2 Webhook (`POST /api/webhooks/stripe`)

Invariants documentés dans `src/app/api/webhooks/stripe/route.ts:11-53` :

1. **Signature** vérifiée sur le body brut. Sans signature ou signature
   invalide → 400, **pas** d'insertion `stripe_events`.
2. **Idempotence** : insertion `stripe_events(id = event.id)`. Conflit
   `23505` → 200 `{ idempotent: true }` sans re-traitement. La 2ᵉ ligne de
   défense est l'index partial UNIQUE sur
   `orders.stripe_checkout_session_id` (création de commande idempotente
   même si l'insertion `stripe_events` rate). 3ᵉ ligne : early-return dans
   `place_order_for_user` si la session est déjà associée à une commande.
3. **Routage par event type** :
   - `checkout.session.completed` → `handleCheckoutSessionCompleted` :
     `stripe.checkout.sessions.retrieve(id, { expand: line_items… })`,
     puis `supabase.rpc('place_order_for_user', { … })`.
   - `customer.subscription.created|updated|deleted` →
     `handleSubscriptionUpsert` → `upsert_subscription_from_stripe`.
   - autres types (`charge.*`, `payment_intent.*`, etc.) → no-op, 200
     (ligne d'audit conservée dans `stripe_events`).
4. **Identité utilisateur** : extraite de `session.client_reference_id` —
   **jamais** déduite du payload `metadata` non signé.
5. **Statut commande** mappé depuis `session.payment_status` :
   `paid|no_payment_required → 'paid'`, `unpaid → 'pending'`.
6. **Sanity check** : recompute `sum(unit_amount × quantity)` et compare à
   `session.amount_total` (warn sur écart ; ne bloque pas).
7. En cas de throw dans le handler : **rollback de la ligne `stripe_events`**
   (`delete`) + 500. Comme ça la prochaine retry Stripe re-traitera
   réellement au lieu d'être 200 idempotent silencieux.

### 6.3 Page de confirmation (`/checkout/success`)

`SuccessView.tsx` :

1. Lit `session_id` de l'URL.
2. Boucle de polling RLS sur `public.orders` (`user_id = auth.uid()` ET
   `stripe_checkout_session_id = session_id`), 10 tentatives × 1 s.
3. Quand la commande est trouvée → `clearCart()` (1 fois, guard `useRef`),
   affichage du récap.
4. Si timeout → écran "en cours de confirmation" avec bouton Actualiser.

---

## 7. Cache et performance

- **Catalogue** (`/category/[id]`, `/product/[id]`, `/`) : généré statique,
  revalidation déclenchée par les route handlers admin :
  ```ts
  revalidatePath('/');
  revalidatePath('/catalogue');
  revalidatePath('/category/[id]', 'page');
  revalidatePath('/product/[id]', 'page');
  ```
  Une modification produit (PATCH/DELETE) propage en quelques secondes.
- **Recherche** (`/search`) : route dynamique, requête FTS Postgres
  (`search_fr tsvector` + index GIN) avec fallback fuzzy `pg_trgm` sur
  `name->>'fr'`. Bench < 100 ms à valider sur volume représentatif.
- **Admin** : pas de cache (route dynamique).

---

## 8. Limites connues et décisions

### Limites assumées

1. **Modification de prix non couverte par le Lot CRUD-1 produit.** Les
   Stripe Price objects sont immuables : changer un prix implique
   `stripe.prices.create()` + `stripe.prices.update({ active: false })` +
   rotation `prices.stripe_price_id`. C'est un flux Stripe-aware
   (route handler) qui sera couvert par le **Lot CRUD-2 (Stripe-aware)**.
2. **Prix inactifs invisibles côté admin.** `prices_public_read` filtre
   sur `is_active`. Un admin consultant un produit soft-deleted dont les
   prix sont aussi inactifs verra le produit mais pas les prix. Acceptable
   tant que l'admin ne doit que pouvoir réactiver le produit ; à corriger
   au Lot CRUD-2 avec une policy `prices_admin_read`.
3. **TVA / coupons / proration** : hors périmètre actuel. Le webhook
   recompute `total = Σ unit_amount × quantity` ; si l'un de ces trois
   atterrit un jour, il faudra stocker `session.amount_total` directement
   et arrêter de recomputer (sanity check tracé dans `route.ts:248-258`).
4. **i18n** : schéma jsonb `{fr, en, ar, he}` en base, mais aucune
   librairie i18n installée côté front (le rendu prend `name?.fr`). RTL
   non implémenté. À traiter au lot i18n.
5. **Méthodes de paiement client** (`/my-account#payment-methods`) :
   placeholder UI. À brancher sur Stripe Customer Portal au Lot CRUD-2.
6. **Téléchargement de facture PDF** (`/orders`, détail commande) :
   placeholder. Nécessite une Edge Function Supabase ou un endpoint
   server-side qui appelle Stripe pour récupérer / générer le PDF.
7. **Backoffice catégories / carrousel / messages contact / chatbot** :
   pas de section admin à ce jour. CRUD produit est le seul backoffice
   d'écriture câblé.

### Décisions notables

- **Pas de Stripe Elements**. Choix : Checkout hébergé pour rester sur SAQ A.
- **Pas d'Edge Functions Supabase**. Choix : tout le serveur passe par
  les route handlers Next.js — un seul runtime à déployer, un seul flux
  de logs, type-safety end-to-end via TypeScript partagé.
- **Pas de service_role côté navigateur**. La service_role ne sort jamais
  du process Node Next (webhook + checkout/session). Toute opération
  côté client passe par RLS ou par une RPC SECURITY DEFINER + grant à
  `authenticated` + check `is_admin()` interne.
- **Idempotence triple** : PK `stripe_events.id` + index UNIQUE partial
  `orders.stripe_checkout_session_id` + early-return RPC
  `place_order_for_user`. Conçu pour qu'aucune retry Stripe, aucun
  Resend dashboard, aucun bug de routage ne puisse créer une commande
  dupliquée.
- **Stratégie cache** : ISR + `revalidatePath` à la mutation. Évite un
  catalogue obsolète 1 h après une modif admin.

---

## 9. Sources

- Migrations Supabase : `supabase/migrations/*.sql` (historiquement
  numérotées, voir §4).
- Routes API : `src/app/api/**/route.ts`. Spec complète des routes dans
  `docs/openapi.yaml`.
- Middleware admin : `src/middleware.ts`.
- Fonction `is_admin()` : migration `20260617130000_auth_profiles.sql`
  lignes 78-102.
- Pattern RPC admin : migration `20260619210000_admin_dashboard_rpcs.sql`.
- Webhook : `src/app/api/webhooks/stripe/route.ts`.
- Checkout : `src/app/api/checkout/session/route.ts`.
