'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

/**
 * AAL1 → AAL2 step-up page for /admin.
 *
 * Reached only by admins whose current session is AAL1 but who already have
 * a verified TOTP factor (the /admin middleware filters everyone else: no
 * user → /login ; non-admin → / ; admin without factor → /my-account).
 * The middleware also lets this exact path through at AAL1 — otherwise we
 * would redirect to ourselves in a loop.
 *
 * Successful verify upgrades the session JWT to AAL2 and the browser
 * supabase client rotates the cookie automatically; the next /admin
 * request sails through.
 *
 * Navigation after step-up is a HARD reload (window.location.assign), not
 * router.replace. A soft App Router navigation races with the cookie write
 * triggered by the auth-state change: the middleware sometimes still sees
 * the old aal1 cookie on the next request and bounces us back here, which
 * re-mounts the component, re-reads aal2 client-side, soft-navigates again
 * — silent loop. A full reload forces the browser to send the freshly
 * written cookie and the middleware re-evaluates against it.
 */

type Stage = 'loading' | 'ready' | 'no_factor' | 'busy';

function mapMfaError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid totp') || m.includes('invalid code') || m.includes('invalid one-time')) {
    return 'Code à 6 chiffres invalide.';
  }
  if (m.includes('expir')) {
    return 'Le code a expiré, un nouveau défi a été émis. Réessayez.';
  }
  if (m.includes('not found') || m.includes('does not exist')) {
    return 'Facteur introuvable. Reconfigurez-le depuis votre espace personnel.';
  }
  return raw;
}

const codeInputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-center font-mono text-lg tracking-widest';

export default function VerifyView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const { toast } = useToast();

  // safeRedirectTarget rejects protocol-relative URLs and external origins.
  // If `from` is absent we default to /admin (this page exists for that).
  const rawFrom = searchParams.get('from');
  const target = rawFrom == null ? '/admin' : safeRedirectTarget(rawFrom);

  const [stage, setStage] = useState<Stage>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') {
        // Already stepped up — hard reload so the middleware sees the
        // current aal2 cookie on the next request (see file header).
        window.location.assign(target);
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      // `data.totp` only contains VERIFIED totp factors.
      const verified = (factors?.totp ?? [])[0];
      if (!verified) {
        setStage('no_factor');
        return;
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: verified.id,
      });
      if (chErr || !ch) {
        setError(chErr ? mapMfaError(chErr.message) : 'Le défi a échoué.');
        setStage('ready');
        return;
      }
      setFactorId(verified.id);
      setChallengeId(ch.id);
      setStage('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!factorId || !challengeId || code.length !== 6) return;
    setError('');
    setStage('busy');
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    });
    if (verifyErr) {
      // Challenges are single-use; mint a fresh one so the user can retry
      // without reloading.
      const { data: fresh } = await supabase.auth.mfa.challenge({ factorId });
      if (fresh) setChallengeId(fresh.id);
      setStage('ready');
      setError(mapMfaError(verifyErr.message));
      return;
    }
    toast({
      title: 'Vérification réussie',
      description: "Accès à l'administration accordé.",
    });
    // Best-effort: nudge the SDK to flush the freshly-rotated tokens to
    // cookies before we navigate. mfa.verify already rotates the JWT to
    // aal2 and the @supabase/ssr cookie writer fires on the auth event,
    // so this is belt-and-braces — we ignore any error and proceed.
    try {
      await supabase.auth.refreshSession();
    } catch {
      /* refresh failed, fall through to navigation */
    }
    // Hard reload so the middleware re-evaluates with the aal2 cookie
    // (see file header). The page is about to unload — leave `stage`
    // on 'busy' so the form stays disabled in the meantime.
    window.location.assign(target);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className="space-y-6">
      <header className="text-center">
        <ShieldCheck aria-hidden="true" className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
          Vérification à deux facteurs
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisissez le code à 6 chiffres généré par votre application TOTP pour accéder à
          l’administration.
        </p>
      </header>

      {stage === 'loading' && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Préparation du défi…
        </p>
      )}

      {stage === 'no_factor' && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <p className="mb-1 font-medium leading-none tracking-tight">
            Aucun facteur 2FA configuré
          </p>
          <p className="leading-relaxed">
            Votre compte n’a pas encore de second facteur. Configurez-le depuis votre{' '}
            <Link
              href="/my-account#two-factor"
              className="font-medium underline-offset-4 hover:underline"
            >
              espace personnel
            </Link>
            , puis revenez ici.
          </p>
        </div>
      )}

      {(stage === 'ready' || stage === 'busy') && (
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg"
        >
          <div className="space-y-2">
            <label htmlFor="verify-code" className="text-sm font-medium text-foreground">
              Code à 6 chiffres
            </label>
            <input
              id="verify-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={stage === 'busy'}
              aria-describedby={error ? 'verify-error' : undefined}
              className={codeInputClass}
            />
          </div>
          {error && (
            <p id="verify-error" className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={stage === 'busy' || code.length !== 6} className="w-full">
            {stage === 'busy' ? 'Vérification…' : 'Vérifier'}
          </Button>
        </form>
      )}

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-muted-foreground underline-offset-4 hover:text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Pas votre appareil ? Se déconnecter
        </button>
      </div>
    </div>
  );
}
