# Modèle de données CYNA — analyse & schéma physique (Supabase)

Conception de la base cible pour la plateforme e-commerce SaaS de cybersécurité CYNA,
sur PostgreSQL/Supabase, intégrée à Stripe. Ce document part de ton MCD/MLD, corrige
les points qui desservent l'application, et produit le **modèle physique** (MPD)
prêt à implémenter.

---

## 1. Principes directeurs (les décisions structurantes)

| # | Décision | Pourquoi |
|---|---|---|
| 1 | **Clés primaires UUID** (`gen_random_uuid()`) + **slug** pour l'URL publique | Pas d'IDs devinables, scalable, et le slug donne des URLs SEO (`/product/cyberwatch-soc-pro`) |
| 2 | **Supabase Auth possède les mots de passe** — table `profiles` liée à `auth.users`, **aucune colonne `mot_de_passe_hash`** | Supabase gère bcrypt + JWT + MFA côté serveur ; stocker un hash soi-même est la faille à éviter (corrige le `mot_de_passe_hash` du MCD) |
| 3 | **Stripe = source de vérité de la facturation** — on stocke les IDs Stripe + un miroir minimal synchronisé par **webhooks** | Ne pas réimplémenter Stripe ; conformité PCI-DSS (aucune donnée carte chez nous) |
| 4 | **Montants en centimes entiers** (`integer`), `currency char(3)` | Convention Stripe ; évite les erreurs d'arrondi des décimaux (corrige le `decimal montant` + le `$`/euros entiers du code actuel) |
| 5 | **Disponibilité = enum à 3 valeurs**, pas un booléen | L'UI affiche « Limité » (badge orange, bouton actif) — un booléen `est_disponible` le perdrait (corrige le MLD) |
| 6 | **Caractéristiques = `jsonb`** clé/valeur | La fiche produit fait `Object.entries(specs)` — un `TEXT` casserait ça (corrige le MCD) |
| 7 | **i18n par colonnes `jsonb`** (`{ "fr": …, "en": …, "ar": …, "he": … }`) résolues dans `lib/data` | Satisfait l'exigence FR/EN/AR/HE sans table de traduction lourde ; une ligne par entité, CRUD admin simple |
| 8 | **Recherche : `tsvector` généré + index GIN** (config française) + `pg_trgm` pour la tolérance aux fautes | Répond à l'exigence « recherche < 100 ms » côté Postgres |
| 9 | **RLS activée sur TOUTES les tables** dès la création | C'est un projet de cybersécurité : aucune table sans politique |
| 10 | **`timestamptz` partout** + trigger `updated_at` | Cohérence fuseaux, traçabilité |
| 11 | **PCI-DSS** : `payment_methods` ne stocke que l'ID Stripe + `brand`/`last4`/`exp` (métadonnées d'affichage, non sensibles) | Jamais de PAN ni CVV ; aligne avec les placeholders du front |

---

## 2. Vue d'ensemble — 4 domaines, 16 tables

```
Domaine 1 — Identité & compte         profiles · addresses · payment_methods
Domaine 2 — Catalogue                 categories · products · product_images · prices
Domaine 3 — Panier, commandes, abos   carts · cart_items · orders · order_items · subscriptions
Domaine 4 — Support & contenu         contact_messages · chatbot_conversations ·
                                      chatbot_messages · carousel_slides
```

Types énumérés (Postgres `enum`) :
`user_role` (client, admin) · `stock_status` (in_stock, limited, out_of_stock) ·
`billing_interval` (monthly, annual) · `price_unit` (flat, per_user, per_device) ·
`order_status` (pending, paid, failed, refunded, cancelled) ·
`subscription_status` (active, trialing, past_due, canceled, paused, incomplete, expired) ·
`contact_status` (new, read, handled) · `chat_role` (user, bot, agent).

---

## 3. Schéma physique, table par table

Format : **PK** = clé primaire, **FK** = clé étrangère. Tout a `created_at timestamptz default now()` ;
les tables modifiables ont aussi `updated_at` (mis à jour par trigger).

### Domaine 1 — Identité & compte

**profiles** — prolonge `auth.users` (l'email et le mot de passe vivent dans `auth.users`)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK**, **FK → auth.users(id)** ON DELETE CASCADE |
| full_name | text | |
| role | user_role | NOT NULL, default `client` |
| is_active | boolean | NOT NULL, default true |
| created_at / updated_at | timestamptz | |

> Créé automatiquement à l'inscription par un **trigger** `on auth.users insert`.

**addresses**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)** ON DELETE CASCADE, NOT NULL |
| label, first_name, last_name | text | |
| line1, city, postal_code, country | text | NOT NULL |
| line2, phone | text | |
| is_default | boolean | default false |

**payment_methods** (PCI-DSS : métadonnées d'affichage uniquement)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)** ON DELETE CASCADE, NOT NULL |
| stripe_payment_method_id | text | NOT NULL, UNIQUE |
| brand | text | (Visa, Mastercard…) |
| last4 | char(4) | |
| exp_month, exp_year | int | |
| is_default | boolean | default false |

### Domaine 2 — Catalogue

**categories**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| slug | citext | NOT NULL, UNIQUE |
| name | jsonb | NOT NULL (`{fr,en,ar,he}`) |
| description | jsonb | |
| image_url | text | |
| display_order | int | default 0 |
| is_active | boolean | default true |

**products**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| category_id | uuid | **FK → categories(id)** ON DELETE RESTRICT, NOT NULL |
| slug | citext | NOT NULL, UNIQUE |
| name | jsonb | NOT NULL |
| description | jsonb | |
| specs | jsonb | NOT NULL, default `'{}'` (clé/valeur) |
| availability | stock_status | NOT NULL, default `in_stock` |
| priority | int | default 0 (tri « top produits ») |
| is_featured | boolean | default false |
| is_active | boolean | default true |
| search_fr | tsvector | **généré** (voir §5), indexé GIN |

**product_images** (galerie de la fiche produit)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| product_id | uuid | **FK → products(id)** ON DELETE CASCADE, NOT NULL |
| url | text | NOT NULL |
| alt | jsonb | (texte alternatif WCAG, i18n) |
| position | int | default 0 |

**prices** (remplace les colonnes `price_monthly/annual/per_user`, et prépare Stripe)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| product_id | uuid | **FK → products(id)** ON DELETE CASCADE, NOT NULL |
| stripe_price_id | text | UNIQUE (NULL tant que Stripe pas branché) |
| billing_interval | billing_interval | NOT NULL (monthly/annual) |
| unit_type | price_unit | NOT NULL, default `flat` |
| unit_amount | integer | NOT NULL, CHECK ≥ 0 (**centimes**) |
| currency | char(3) | NOT NULL, default `eur` |
| is_active | boolean | default true |
| | | UNIQUE (product_id, billing_interval, unit_type) |

### Domaine 3 — Panier, commandes & abonnements

**carts** / **cart_items** *(différé — le front utilise localStorage ; à activer pour le panier multi-appareils)*

| carts | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)**, nullable (panier invité) |
| session_id | text | nullable |

| cart_items | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| cart_id | uuid | **FK → carts(id)** ON DELETE CASCADE |
| product_id | uuid | **FK → products(id)** |
| price_id | uuid | **FK → prices(id)** |
| quantity | int | NOT NULL, CHECK > 0 |

**orders**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)**, NOT NULL |
| billing_address_id | uuid | **FK → addresses(id)**, nullable |
| order_number | text | NOT NULL, UNIQUE (ex. `ORD-…`) |
| status | order_status | NOT NULL, default `pending` |
| subtotal_amount, total_amount | integer | NOT NULL (centimes) |
| currency | char(3) | NOT NULL, default `eur` |
| stripe_checkout_session_id | text | |
| stripe_payment_intent_id | text | |

**order_items** (avec **snapshots** — exactitude historique même si le produit change)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| order_id | uuid | **FK → orders(id)** ON DELETE CASCADE, NOT NULL |
| product_id | uuid | **FK → products(id)**, nullable (ON DELETE SET NULL) |
| price_id | uuid | **FK → prices(id)**, nullable |
| product_name_snapshot | text | NOT NULL |
| unit_amount | integer | NOT NULL (centimes, figé) |
| billing_interval | billing_interval | |
| quantity | int | NOT NULL, CHECK > 0 |
| line_total | integer | NOT NULL |

> Corrige la dette « commandes légères » : le détail des articles est désormais persisté.

**subscriptions** (cœur du modèle SaaS, miroir Stripe synchronisé par webhook)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)**, NOT NULL |
| product_id | uuid | **FK → products(id)** |
| price_id | uuid | **FK → prices(id)** |
| stripe_subscription_id | text | NOT NULL, UNIQUE |
| status | subscription_status | NOT NULL |
| current_period_start, current_period_end | timestamptz | |
| cancel_at_period_end | boolean | default false |

### Domaine 4 — Support & contenu backoffice

**contact_messages**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)**, nullable |
| sender_email | text | NOT NULL |
| subject, message | text | NOT NULL |
| status | contact_status | NOT NULL, default `new` |

**chatbot_conversations** / **chatbot_messages** *(différé — le front est une coquille sans IA)*

| chatbot_conversations | Type | |
|---|---|---|
| id | uuid | **PK** |
| user_id | uuid | **FK → profiles(id)**, nullable |
| session_id | text | |
| status | text | (ouverte/fermée/escaladée) |
| escalated_to_human | boolean | default false |

| chatbot_messages | Type | |
|---|---|---|
| id | uuid | **PK** |
| conversation_id | uuid | **FK → chatbot_conversations(id)** ON DELETE CASCADE |
| role | chat_role | NOT NULL |
| content | text | NOT NULL |

**carousel_slides**

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | **PK** |
| title | jsonb | NOT NULL |
| subtitle | jsonb | |
| image_url | text | NOT NULL |
| cta_text | jsonb | |
| cta_link | text | |
| display_order | int | default 0 |
| is_active | boolean | default true |

> **Simplification vs MCD** : le « top produits » devient une colonne `is_featured` + `priority`
> sur `products` (au lieu d'une table `top_produits` à part) — un join en moins, même résultat.

---

## 4. Stratégie RLS (Row Level Security)

Activée partout. Politiques par table :

| Table(s) | Lecture | Écriture |
|---|---|---|
| categories, products, product_images, prices, carousel_slides | **Publique** (anon + authenticated) | **Admin uniquement** |
| profiles | Soi-même ; admin = tous | Soi-même (champs limités) ; rôle non modifiable par l'utilisateur |
| addresses, payment_methods, carts, cart_items, orders, order_items, subscriptions | **Propriétaire** (`auth.uid() = user_id`) ; admin = tous | Propriétaire (selon le cas) ; `orders`/`subscriptions` écrites surtout par le serveur (service_role / webhooks) |
| contact_messages | Auteur + admin | Insertion publique (formulaire) ; lecture/maj admin |
| chatbot_* | Auteur + admin | Auteur |

**Vérification du rôle admin — pattern recommandé.** Ne pas interroger `profiles` dans chaque
politique (lent + risque de récursion RLS). À la place : injecter le rôle dans le **JWT** via un
*custom access token hook* Supabase, puis tester `(auth.jwt() ->> 'user_role') = 'admin'`.
Alternative simple : une fonction `SECURITY DEFINER public.is_admin()` qui lit `profiles` une fois.

---

## 5. Recherche < 100 ms (exigence cahier des charges)

Colonne générée + index GIN sur les produits :

```sql
ALTER TABLE products ADD COLUMN search_fr tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french',
      coalesce(name->>'fr','') || ' ' || coalesce(description->>'fr',''))
  ) STORED;
CREATE INDEX products_search_fr_idx ON products USING gin (search_fr);

-- tolérance aux fautes de frappe (recherche partielle / approximative)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX products_name_trgm_idx ON products USING gin ((name->>'fr') gin_trgm_ops);
```

La recherche `lib/data` passe alors de `ILIKE` côté client à `search_fr @@ plainto_tsquery('french', q)`
côté Postgres — indexé, donc < 100 ms même avec un vrai catalogue. (Pour EN/AR/HE : ajouter
`search_en`, etc. au lot i18n.)

---

## 6. Intégration Stripe (mapping)

| Concept Stripe | Côté base CYNA |
|---|---|
| Product | `products` (lien logique) |
| Price | `prices.stripe_price_id` (1 ligne par interval/unité) |
| Customer | `profiles` (ajouter `stripe_customer_id` au lot Stripe) |
| Checkout Session | `orders.stripe_checkout_session_id` |
| PaymentIntent | `orders.stripe_payment_intent_id` → `orders.status` |
| Subscription | `subscriptions` (statut + périodes, via webhook) |
| PaymentMethod | `payment_methods` (id + brand/last4/exp) |

**Flux** : on crée Product+Price dans Stripe → on stocke `stripe_price_id` dans `prices`.
Le Checkout utilise `stripe_price_id`. Une **Edge Function webhook** met à jour `orders` /
`subscriptions` sur `checkout.session.completed`, `customer.subscription.*`, `payment_intent.*`.
**Centimes obligatoires** côté Stripe (cohérent avec le point 4).

---

## 7. Écarts avec le code actuel & stratégie de remapping

Le contrat de `lib/data` (la couche d'accès) **absorbe** la différence : les pages ne changent
quasiment pas, on réécrit `lib/data/{products,categories,carousel}.ts` pour lire le nouveau schéma
et le **réaplatir** vers la forme `Product`/`Category` que les pages consomment déjà.

| Aujourd'hui (code) | Cible (ce modèle) | Qui absorbe |
|---|---|---|
| ID `prod-1` (text) | UUID + **slug** | `lib/data` ; routage **par slug** (voir décision ci-dessous) |
| `price_monthly/annual/per_user` (colonnes) | table `prices` (centimes) | `lib/data` aplatit → mêmes champs pour les pages, ÷100 à l'affichage |
| `stock_status` chaîne FR | enum `availability` (codes) | `lib/data` mappe code → libellé localisé |
| `image_url` unique | `product_images` (galerie) | `lib/data` expose `image_url` (1ʳᵉ image) + `images[]` |
| `name`/`description` string | `jsonb` i18n | `lib/data` résout la locale (fallback `fr`) |
| specs jsonb | specs jsonb | inchangé |

**Une seule vraie décision à impact « pages » : le routage.**
- **Recommandé** : router par **slug** (`/product/cyberwatch-soc-pro`) → SEO, lisible, conforme au MCD.
  Coût : adapter `generateStaticParams` + les `<Link>` (qui pointent déjà vers un identifiant).
- **Sans changement de page** : garder le routage par un identifiant texte, en utilisant le slug
  comme cet identifiant. Moins de bénéfice SEO, zéro modif de page.

---

## 8. Ordre de construction (lots)

| Lot | Contenu | Débloque |
|---|---|---|
| **A — Catalogue** *(maintenant)* | enums + categories, products, product_images, prices, carousel_slides + RLS lecture publique + FTS + seed. Réécriture des 3 fichiers `lib/data`. | Home, Catalogue, Category, Product, Search sur la vraie base |
| **B — Auth** | `profiles` + trigger + rôle/JWT + RLS. Bascule `AuthContext` → Supabase Auth. | Tue le SHA-256 et les ~14 `FIXME-SECURITY` auth |
| **C — Commandes** | addresses, orders, order_items (+ carts optionnel) + RLS propriétaire. | Persistance réelle checkout, carnet d'adresses, historique « riche » |
| **D — Stripe** | `stripe_customer_id`, Checkout Session, subscriptions, payment_methods, **webhooks**. | Paiement + abonnements réels ; décolle les `data-stripe` |
| **E — Support & admin** | contact_messages, chatbot_*, écritures backoffice + RLS admin + **MFA** `/admin`. | Formulaire contact réel, CRUD admin, RBAC serveur |

---

## 9. Ce qu'on applique maintenant

**Lot A uniquement.** Il remplace le schéma minimal qu'on s'apprêtait à poser, et il est conçu
pour accueillir B→E sans refonte. Concrètement, à générer puis appliquer :

1. Les **types enum** + extensions (`pgcrypto` pour UUID, `pg_trgm`, `citext`).
2. Les **5 tables catalogue** + index + `tsvector` généré + trigger `updated_at`.
3. **RLS** : lecture publique sur les 5 tables, aucune écriture (les écritures admin viennent au lot E).
4. Le **seed** depuis `demoData.js` (4 catégories, 9 produits, leurs prix en centimes, images, 3 slides).
5. La réécriture de `lib/data/{products,categories,carousel}.ts` pour lire ce schéma et réaplatir.

Décisions à confirmer avant de générer le SQL du lot A :
- **Routage** par slug (recommandé) ou par identifiant texte (zéro modif page) ?
- **i18n** : on stocke seulement `fr` pour l'instant (les colonnes jsonb sont prêtes pour en/ar/he) — OK ?
- **Centimes** : prix stockés ×100 (ex. 2999 € → `299900`) — OK ?

---

*Ce document constitue le MPD (modèle physique) du projet, dérivé du MCD/MLD fournis. Il est
volontairement plus normalisé et plus sûr que le modèle initial (suppression du hash maison,
prix en centimes, disponibilité à 3 états, i18n et recherche prévues nativement).*
