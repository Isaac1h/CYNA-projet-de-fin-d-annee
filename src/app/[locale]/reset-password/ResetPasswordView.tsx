'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { evaluatePassword, RULE_LABELS } from '@/features/auth/passwordStrength';

/**
 * Page d'atterrissage du lien email "réinitialiser mon mot de passe".
 *
 * Mécanique Supabase :
 *   - Le lien email pointe vers /reset-password avec un hash
 *     (#access_token=...&type=recovery&...). Le client browser
 *     supabase-js parse automatiquement ce hash au mount (option
 *     detectSessionInUrl, activée par défaut), pose la session côté
 *     localStorage et émet PASSWORD_RECOVERY via onAuthStateChange.
 *   - Tant qu'on n'a pas observé PASSWORD_RECOVERY, on ne montre PAS le
 *     formulaire : c'est la seule garantie qu'on est bien dans un flow
 *     de récupération et pas dans une session normale qui aurait dérivé
 *     sur cette URL. Au timeout, on bascule en "lien invalide" avec un
 *     pont vers /forgot-password.
 *
 * Après mise à jour :
 *   - On signOut() pour invalider la session de récupération. Le mot de
 *     passe vient de changer ; toute session héritée du flow recovery
 *     doit disparaître, et l'utilisateur doit s'authentifier proprement
 *     avec le nouveau MDP. Sinon on resterait connecté avec la session
 *     issue du lien email, ce qui pollue la sémantique "il faut prouver
 *     que tu connais le nouveau MDP".
 *   - Redirection /login après un court délai pour laisser lire le
 *     message de succès.
 */

const RECOVERY_DETECT_TIMEOUT_MS = 3000;
const SUCCESS_REDIRECT_DELAY_MS = 2500;

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'updating' }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

const INVALID_LINK_MESSAGE =
  "Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau pour continuer.";

function mapUpdateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('same as the old password') || m.includes('different from')) {
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  }
  if (m.includes('auth session missing') || m.includes('jwt expired') || m.includes('invalid jwt')) {
    return 'Votre session de récupération a expiré. Demandez un nouveau lien.';
  }
  if (m.includes('password should be') || m.includes('weak password')) {
    return 'Le mot de passe ne respecte pas les règles de complexité.';
  }
  return raw;
}

export default function ResetPasswordView() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const recoverySeen = useRef(false);

  const strength = useMemo(() => evaluatePassword(password), [password]);
  const passwordValid = strength.score === strength.outOf;
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const showPasswordsMismatch = confirm.length > 0 && !passwordsMatch;

  // Écoute les évènements auth ; PASSWORD_RECOVERY est le signal
  // canonique qu'on est dans un flow de récupération.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoverySeen.current = true;
        setStatus((prev) => (prev.kind === 'loading' ? { kind: 'ready' } : prev));
      }
    });
    const timeout = window.setTimeout(() => {
      if (!recoverySeen.current) {
        setStatus((prev) =>
          prev.kind === 'loading' ? { kind: 'invalid', reason: INVALID_LINK_MESSAGE } : prev,
        );
      }
    }, RECOVERY_DETECT_TIMEOUT_MS);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  // Quand on passe en 'ready', on focus le champ pour les claviers / AT.
  useEffect(() => {
    if (status.kind === 'ready') {
      passwordInputRef.current?.focus();
    }
  }, [status.kind]);

  const canSubmit =
    status.kind === 'ready' && passwordValid && passwordsMatch;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus({ kind: 'updating' });

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus({ kind: 'error', message: mapUpdateError(error.message) });
      return;
    }

    // Mot de passe changé → on invalide la session héritée du flow
    // recovery puis on bascule sur /login.
    await supabase.auth.signOut();
    setStatus({ kind: 'done' });
    window.setTimeout(() => {
      router.replace('/login');
    }, SUCCESS_REDIRECT_DELAY_MS);
  };

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
          Nouveau mot de passe
        </h1>
        <p className="text-muted-foreground">
          Choisissez un mot de passe respectant la politique de sécurité Cyna.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        {status.kind === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className="space-y-3"
            aria-busy="true"
          >
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-card/40" aria-hidden="true" />
            <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
            <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Vérification du lien…</p>
          </div>
        )}

        {status.kind === 'invalid' && (
          <div
            role="alert"
            className="space-y-4 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-foreground"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <p>{status.reason}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/forgot-password">
                <Button type="button">Demander un nouveau lien</Button>
              </Link>
              <Link href="/login">
                <Button type="button" variant="outline">
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          </div>
        )}

        {status.kind === 'done' && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="space-y-2">
              <p>
                Votre mot de passe a bien été mis à jour. Vous allez être redirigé vers la page
                de connexion…
              </p>
              <Link href="/login">
                <Button type="button" size="sm">
                  Se connecter maintenant
                </Button>
              </Link>
            </div>
          </div>
        )}

        {(status.kind === 'ready' || status.kind === 'updating' || status.kind === 'error') && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5"
            aria-label="Formulaire de nouveau mot de passe"
          >
            <div>
              <label
                htmlFor="reset-password"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Nouveau mot de passe
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </label>
              <input
                ref={passwordInputRef}
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="reset-password-meter reset-password-rules"
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />

              <div id="reset-password-meter" aria-live="polite" className="mt-2">
                <div
                  role="meter"
                  aria-label="Force du mot de passe"
                  aria-valuemin={0}
                  aria-valuemax={strength.outOf}
                  aria-valuenow={strength.score}
                  aria-valuetext={strength.label}
                  className="grid grid-cols-5 gap-1"
                >
                  {Array.from({ length: strength.outOf }).map((_, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`h-1.5 rounded-full transition-colors ${
                        index < strength.score ? strength.barColorClass : 'bg-secondary'
                      }`}
                    />
                  ))}
                </div>
                <p className={`mt-1 text-xs font-medium ${strength.labelColorClass}`}>
                  Force&nbsp;: {password.length === 0 ? 'à renseigner' : strength.label}
                </p>
              </div>

              <ul id="reset-password-rules" className="mt-2 space-y-1">
                {RULE_LABELS.map(({ rule, label }) => {
                  const ok = strength.ruleStatus[rule];
                  return (
                    <li
                      key={rule}
                      className={`flex items-center gap-2 text-xs ${
                        ok ? 'text-green-500' : 'text-muted-foreground'
                      }`}
                    >
                      {ok ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      <span>
                        <span className="sr-only">{ok ? 'Validé : ' : 'À compléter : '}</span>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <label
                htmlFor="reset-confirm"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Confirmer le nouveau mot de passe
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                aria-invalid={showPasswordsMismatch || undefined}
                aria-describedby={showPasswordsMismatch ? 'reset-confirm-error' : undefined}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showPasswordsMismatch && (
                <p id="reset-confirm-error" role="alert" className="mt-1 text-sm text-destructive">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            <p
              id="reset-form-error"
              role="alert"
              aria-live="polite"
              className="min-h-[1.25rem] text-sm text-destructive"
            >
              {status.kind === 'error' ? status.message : ''}
            </p>

            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              aria-busy={status.kind === 'updating' || undefined}
              aria-describedby={status.kind === 'error' ? 'reset-form-error' : undefined}
              className="w-full"
            >
              {status.kind === 'updating' ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </Button>
          </form>
        )}
      </div>

      {status.kind !== 'done' && status.kind !== 'invalid' && (
        <p className="text-center text-sm text-muted-foreground">
          Le lien ne fonctionne plus ?{' '}
          <Link
            href="/forgot-password"
            className="font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Demander un nouveau lien
          </Link>
        </p>
      )}
    </div>
  );
}
