# CLAUDE.md — Projet CYNA

## Projet
- E-commerce SaaS cybersécurité (SOC / EDR / XDR). Équipe 4, projet école B3.
- Ce repo = web uniquement. App mobile React Native dans un dépôt séparé.

## Stack
- Actuel : React 18 + Vite 4 + JavaScript. État via Context API + `localStorage`. Stubs Supabase et Stripe non câblés.
- Cible : Next.js (App Router) + TypeScript strict + Supabase (Auth, Postgres + RLS, Edge Functions) + Stripe (Checkout/Elements + webhooks).
- Stubs à remplacer : `src/lib/supabase.js`, `src/lib/stripe.js`, `src/lib/auth.js`, `src/lib/demoData.js`.
- À supprimer à la migration : `plugins/visual-editor/`, `plugins/selection-mode/`, `plugins/vite-plugin-iframe-route-restoration.js`, `tools/generate-llms.js`.
- **Attention** : `tools/generate-llms.js` est appelé par le script `build` du `package.json` (`node tools/generate-llms.js || true && vite build`). Ne pas le supprimer sans retirer aussi cette invocation, sinon le build casse.

## Rendu
- Next.js App Router, rendu SSR/SSG hybride ; catalogue et pages produit en RSC ; navigation client-side.

## Commandes
```bash
npm install
npm run dev        # vite, port 3000
npm run build      # vite build
npm run preview    # vite preview, port 3000
npm run lint       # eslint . --quiet
npm run lint:warn  # eslint .
```
Pas de script `test` ni `typecheck` aujourd'hui — à ajouter avec la migration TS/Next.

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
- MFA/2FA obligatoire pour `/admin`.
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
- i18n + RTL. FR / EN / AR / HE au minimum. `dir="rtl"` appliqué au layout pour AR/HE. Le backoffice peut rester en EN.

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
