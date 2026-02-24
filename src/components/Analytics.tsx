'use client';

import { useEffect } from 'react';

/**
 * Ticket 35 — Analytics gate.
 *
 * Charge le script Plausible **UNIQUEMENT** si l'utilisateur a
 * activement consenti (`localStorage['cyna-cookie-consent'] === 'accepted'`).
 * Décharge le script si le consentement passe à `'rejected'` ou est retiré,
 * dans la même session, sans reload.
 *
 * Invariant RGPD strict :
 *   - Aucun `<script>` tiers injecté tant que consent !== 'accepted'.
 *   - Aucun fetch réseau vers plausible.io avant consentement.
 *   - Silent no-op si les env vars ne sont pas configurées (déploiement
 *     sans Plausible = 0 crash, 0 log erreur).
 *
 * Env vars (posées dans .env.local, exposées via NEXT_PUBLIC_) :
 *   - NEXT_PUBLIC_PLAUSIBLE_DOMAIN : domaine enregistré côté Plausible
 *   - NEXT_PUBLIC_PLAUSIBLE_SRC    : URL du script (par défaut
 *                                    `https://plausible.io/js/script.js`)
 *
 * Cross-tab : `storage` event fire quand un autre onglet change le
 * consent → on relit + on synchronise.
 * Same-tab   : CookieConsent dispatch `cyna-cookie-consent-changed`
 * à chaque décision → on relit sans attendre un reload.
 */

const STORAGE_KEY = 'cyna-cookie-consent';
const SCRIPT_ID = 'cyna-plausible-script';
const CONSENT_EVENT = 'cyna-cookie-consent-changed';

export default function Analytics() {
  useEffect(() => {
    const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
    const src = process.env.NEXT_PUBLIC_PLAUSIBLE_SRC;
    if (!domain || !src) {
      // Env non configurée — pas de tracker actif. On monte quand même
      // les listeners pour rester cohérent si les vars sont posées puis
      // le dev server redémarre : la prochaine session couvrira le cas.
      return;
    }

    const loadScript = () => {
      if (document.getElementById(SCRIPT_ID)) return;
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = src;
      script.defer = true;
      script.setAttribute('data-domain', domain);
      document.head.appendChild(script);
    };

    const unloadScript = () => {
      // 1. Retire l'élément DOM. Plausible n'écoute plus les navigations.
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
      // 2. Nettoie la fonction globale que Plausible pose sur window.
      //    Sans ça, un code applicatif qui appellerait window.plausible(...)
      //    continuerait à faire un fetch après retrait — annulerait le
      //    respect du refus.
      if ('plausible' in window) {
        try {
          delete (window as unknown as Record<string, unknown>).plausible;
        } catch {
          (window as unknown as Record<string, unknown>).plausible = undefined;
        }
      }
    };

    const applyConsent = () => {
      let choice: string | null = null;
      try {
        choice = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // localStorage indisponible (mode privé strict, quota) — fail-closed.
        unloadScript();
        return;
      }
      if (choice === 'accepted') {
        loadScript();
      } else {
        unloadScript();
      }
    };

    applyConsent();

    const onCustomChange = () => applyConsent();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) applyConsent();
    };
    window.addEventListener(CONSENT_EVENT, onCustomChange);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(CONSENT_EVENT, onCustomChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return null;
}
