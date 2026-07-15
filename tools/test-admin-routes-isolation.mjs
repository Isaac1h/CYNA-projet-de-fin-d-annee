/**
 * tools/test-admin-routes-isolation.mjs
 *
 * Prouve que TOUTES les routes /api/admin/* refusent :
 *   1. Une requête SANS session  → 401 'authentication required'
 *   2. Une requête d'un CLIENT non-admin → 403 'admin required'
 *   3. Une requête d'un ADMIN en AAL1 (pas de TOTP validé) → 403 'aal2 required'
 *
 * Le guard `requireAdminAAL2()` (src/lib/admin/require-aal2.ts) est appelé
 * en TÊTE de chaque handler admin. Le script teste que ce guard s'exécute
 * bien AVANT toute mutation. Les requêtes sont conçues pour ÉCHOUER (401/403) :
 *   - GET : rien à muter.
 *   - POST/PATCH : body JSON `{}` — si le guard fire correctement il coupe
 *     avant validation ; si (bug) il ne fire pas, la validation renverra
 *     400 (invalid body) sans écrire quoi que ce soit.
 *
 * ⚠ Un 2xx sur n'importe quel test = faille grave. Le script le marque
 *   FAIL en rouge et en majuscules pour attirer l'œil.
 *
 * Aucun credential n'est hardcodé — tout vient de .env.local.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Lancement :
 *
 *   1. Complète .env.local avec (à côté des variables déjà présentes) :
 *
 *        NEXT_PUBLIC_SUPABASE_URL=<déjà présent>
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=<déjà présent>
 *        TEST_ADMIN_EMAIL=<email d'un compte admin>
 *        TEST_ADMIN_PASSWORD=<mot de passe du compte admin>
 *        TEST_CLIENT_EMAIL=<email d'un compte CLIENT non-admin>
 *        TEST_CLIENT_PASSWORD=<mot de passe du compte client>
 *
 *      Facultatif — override de l'URL de l'app testée (défaut ci-dessous) :
 *        NEXT_APP_URL=http://localhost:3000
 *
 *   2. Démarre le serveur Next.js dans un autre terminal :
 *        npm run dev
 *
 *   3. Lance :
 *        node tools/test-admin-routes-isolation.mjs
 *
 *   4. Optionnel : retirer TEST_*_PASSWORD de .env.local après le test.
 *
 * Aucun secret à coller ici — je lis strictement le fichier .env.local.
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBrowserClient } from '@supabase/ssr';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loader minimal (zéro dépendance dotenv) ────────────────────────
function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local');
  let raw;
  try {
    raw = readFileSync(envPath, 'utf-8');
  } catch {
    console.warn(`[env] ${envPath} introuvable — process.env only.`);
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

// ── ANSI couleurs ──────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const passTag = () => `${GREEN}${BOLD}PASS${RESET}`;
const failTag = () => `${RED}${BOLD}FAIL${RESET}`;
const critTag = () => `${RED}${BOLD}⚠ CRITIQUE ⚠${RESET}`;
const info = (s) => `${CYAN}${s}${RESET}`;
const warn = (s) => `${YELLOW}${s}${RESET}`;
const bad = (s) => `${RED}${s}${RESET}`;
const good = (s) => `${GREEN}${s}${RESET}`;

// ── Env requis ─────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'TEST_ADMIN_EMAIL',
  'TEST_ADMIN_PASSWORD',
  'TEST_CLIENT_EMAIL',
  'TEST_CLIENT_PASSWORD',
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(bad(`✗ Variables d'environnement manquantes : ${missing.join(', ')}`));
  console.error(warn('Attendues dans .env.local :'));
  for (const k of REQUIRED_ENV) console.error(`   ${k}=...`);
  process.exit(2);
}

const APP_URL = (process.env.NEXT_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

// ── Cookie jar : capte ce que @supabase/ssr écrirait côté browser ──────
// Le format exact des cookies (nom `sb-<ref>-auth-token[.i]`, valeur
// base64-préfixée, chunking éventuel) est laissé à la librairie — pas
// de sérialisation maison à maintenir.
function makeJar() {
  const store = new Map();
  return {
    getAll: () =>
      [...store.entries()].map(([name, value]) => ({ name, value })),
    setAll: (list) => {
      for (const { name, value } of list) {
        if (value === '' || value == null) store.delete(name);
        else store.set(name, value);
      }
    },
    entries: () => [...store.entries()],
    clear: () => store.clear(),
  };
}

async function signInAndCaptureCookies(email, password) {
  const jar = makeJar();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: jar },
  );
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword(${email}): ${error.message}`);
  // Force écriture cookies via lecture getSession (déclenche setAll).
  await supabase.auth.getSession();
  const cookieHeader = jar
    .entries()
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  return { userId: data.user?.id ?? null, cookieHeader };
}

// ── Définition des routes à tester ─────────────────────────────────────
// Chaque entrée décrit UNE requête (méthode + path + body). Le guard
// AAL2 est censé firer AVANT parsing du body : `{}` sur POST/PATCH est
// donc suffisant pour prouver la coupure sans risquer de muter.
const PLACEHOLDER_ID = '00000000-0000-0000-0000-000000000000';
const ROUTES = [
  { name: 'GET  /api/admin/promotions',              method: 'GET',   path: '/api/admin/promotions',                                body: null },
  { name: 'POST /api/admin/promotions',              method: 'POST',  path: '/api/admin/promotions',                                body: {} },
  { name: `PATCH /api/admin/products/${PLACEHOLDER_ID}`, method: 'PATCH', path: `/api/admin/products/${PLACEHOLDER_ID}`,           body: {} },
  { name: 'POST /api/admin/categories',              method: 'POST',  path: '/api/admin/categories',                                body: {} },
  { name: 'POST /api/admin/carousel-slides',         method: 'POST',  path: '/api/admin/carousel-slides',                           body: {} },
  { name: 'POST /api/admin/home-content',            method: 'POST',  path: '/api/admin/home-content',                              body: {} },
];

// ── Attendus par état ──────────────────────────────────────────────────
const STATES = [
  {
    key: 'NO_SESSION',
    label: 'sans session',
    expectedStatus: 401,
    expectedError: 'authentication required',
    // pas de cookies
    getCookies: () => '',
  },
  {
    key: 'CLIENT_NON_ADMIN',
    label: 'client non-admin (AAL1)',
    expectedStatus: 403,
    expectedError: 'admin required',
    // set plus tard (dépend du sign-in)
    getCookies: null,
  },
  {
    key: 'ADMIN_AAL1',
    label: 'admin AAL1 (TOTP non validé)',
    expectedStatus: 403,
    expectedError: 'aal2 required',
    getCookies: null,
  },
];

// ── HTTP helper ────────────────────────────────────────────────────────
async function callRoute(route, cookieHeader) {
  const url = `${APP_URL}${route.path}`;
  const init = {
    method: route.method,
    headers: {
      Accept: 'application/json',
      ...(route.body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
    redirect: 'manual',
  };
  if (route.body != null) init.body = JSON.stringify(route.body);
  try {
    const res = await fetch(url, init);
    let payload = null;
    try {
      payload = await res.json();
    } catch {
      // pas de JSON — probable HTML 404 Next.js si la route n'existe pas
    }
    return { status: res.status, payload, ok: res.ok };
  } catch (err) {
    return { status: 0, payload: null, ok: false, error: err.message ?? String(err) };
  }
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  console.log(info('[admin-isolation] .env.local chargé.'));
  console.log(info(`[admin-isolation] Supabase URL   : ${process.env.NEXT_PUBLIC_SUPABASE_URL}`));
  console.log(info(`[admin-isolation] App URL        : ${APP_URL}`));
  console.log(info(`[admin-isolation] Admin testé    : ${process.env.TEST_ADMIN_EMAIL}`));
  console.log(info(`[admin-isolation] Client testé   : ${process.env.TEST_CLIENT_EMAIL}`));

  // Sanity check : le serveur Next.js répond.
  console.log(info('[admin-isolation] Ping Next.js…'));
  try {
    const ping = await fetch(APP_URL, { method: 'GET', redirect: 'manual' });
    if (ping.status >= 500) {
      console.error(bad(`✗ ${APP_URL} répond ${ping.status}. Serveur pas prêt ?`));
      process.exit(2);
    }
  } catch (err) {
    console.error(bad(`✗ Impossible de joindre ${APP_URL}: ${err.message ?? err}`));
    console.error(warn('   Démarre le serveur : npm run dev'));
    process.exit(2);
  }

  // ── Sign-in client non-admin ────────────────────────────────────────
  console.log(info('[admin-isolation] Sign-in CLIENT…'));
  let clientCookie;
  try {
    const c = await signInAndCaptureCookies(
      process.env.TEST_CLIENT_EMAIL,
      process.env.TEST_CLIENT_PASSWORD,
    );
    clientCookie = c.cookieHeader;
    console.log(info(`   → user_id = ${c.userId}`));
  } catch (err) {
    console.error(bad(`✗ Sign-in client échoué : ${err.message}`));
    process.exit(2);
  }
  STATES.find((s) => s.key === 'CLIENT_NON_ADMIN').getCookies = () => clientCookie;

  // ── Sign-in admin AAL1 (pas de challenge/verify TOTP) ───────────────
  console.log(info('[admin-isolation] Sign-in ADMIN (AAL1)…'));
  let adminCookie;
  try {
    const a = await signInAndCaptureCookies(
      process.env.TEST_ADMIN_EMAIL,
      process.env.TEST_ADMIN_PASSWORD,
    );
    adminCookie = a.cookieHeader;
    console.log(info(`   → user_id = ${a.userId}`));
  } catch (err) {
    console.error(bad(`✗ Sign-in admin échoué : ${err.message}`));
    process.exit(2);
  }
  STATES.find((s) => s.key === 'ADMIN_AAL1').getCookies = () => adminCookie;

  console.log();

  // ── Boucle test ─────────────────────────────────────────────────────
  const results = [];
  let critical = 0;

  for (const state of STATES) {
    console.log(info(`${BOLD}═══ État : ${state.label} — attendu HTTP ${state.expectedStatus} (error='${state.expectedError}') ═══${RESET}`));
    const cookies = state.getCookies();
    for (const route of ROUTES) {
      const res = await callRoute(route, cookies);
      const statusOK = res.status === state.expectedStatus;
      const errorField = res.payload?.error;
      const errorOK =
        typeof errorField === 'string' &&
        errorField.toLowerCase().includes(state.expectedError.toLowerCase());
      const pass = statusOK && errorOK;
      const is2xx = res.status >= 200 && res.status < 300;

      let tag;
      if (is2xx) {
        tag = `${critTag()} ${failTag()}`;
        critical += 1;
      } else {
        tag = pass ? passTag() : failTag();
      }
      const details = `status=${res.status} error='${errorField ?? '<none>'}'`;
      console.log(`  ${tag}  ${route.name}  →  ${details}`);
      if (!pass && !is2xx) {
        console.log(
          bad(
            `        attendu : status=${state.expectedStatus} error inclut '${state.expectedError}'`,
          ),
        );
      }
      if (is2xx) {
        console.log(
          bad(
            `        ⚠ 2xx OBTENU → guard AAL2 non actif sur cette route ! ` +
              `Une donnée a peut-être été mutée. À investiguer d'urgence.`,
          ),
        );
      }
      results.push({
        state: state.key,
        route: route.name,
        pass,
        critical: is2xx,
        status: res.status,
        error: errorField,
      });
    }
    console.log();
  }

  // ── Récap ───────────────────────────────────────────────────────────
  console.log('═'.repeat(72));
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  console.log(`${BOLD}RÉCAP ${passed}/${total} PASS${RESET}`);
  console.log(`  routes testées   : ${ROUTES.length}`);
  console.log(`  états testés     : ${STATES.length}`);
  console.log(`  total assertions : ${total}`);
  if (critical > 0) {
    console.log(bad(`  ${BOLD}✗ ${critical} route(s) ont renvoyé 2xx alors qu'elles auraient dû refuser. ${critTag()}${RESET}`));
  }
  if (passed === total) {
    console.log(good(`${BOLD}Overall : isolation /api/admin/* VALIDÉE ✅${RESET}`));
    process.exit(0);
  } else {
    console.log(bad(`${BOLD}Overall : ${total - passed} assertion(s) en échec ✗${RESET}`));
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(bad(`✗ Erreur non catchée : ${msg}`));
  process.exit(2);
});
