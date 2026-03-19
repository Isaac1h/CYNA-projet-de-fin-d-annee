'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/lib/auth';

/**
 * Demande de réinitialisation de mot de passe.
 *
 * Anti-énumération : qu'un compte existe ou non pour l'email saisi, on
 * affiche EXACTEMENT le même message de confirmation. Supabase
 * resetPasswordForEmail() ne renvoie pas non plus d'erreur sur un email
 * inexistant, donc on n'a rien à filtrer côté client — seul l'utilisateur
 * légitime, qui a accès à sa boîte, recevra le lien.
 *
 * Les erreurs de format (email vide / invalide) sont affichées en clair
 * parce qu'elles n'apprennent rien à un attaquant (c'est juste une
 * validation syntaxique du champ).
 */

const NEUTRAL_CONFIRMATION =
  "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans les prochaines minutes. Pensez à vérifier vos spams.";
const GENERIC_ERROR =
  "Impossible d'envoyer le lien pour le moment. Merci de réessayer dans quelques instants.";

export default function ForgotPasswordView() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = validateEmail(email);
  const canSubmit = emailValid && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const result = await resetPassword(email.trim());
    setSubmitting(false);
    if (result.success) {
      setDone(true);
      return;
    }
    // Erreur réseau/serveur — on reste générique pour ne pas leaker.
    setError(GENERIC_ERROR);
  };

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">
          Mot de passe oublié
        </h1>
        <p className="text-muted-foreground">
          Saisissez votre email, nous vous enverrons un lien pour en choisir un nouveau.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        {done ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm text-foreground"
          >
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="space-y-2">
              <p>{NEUTRAL_CONFIRMATION}</p>
              <p className="text-xs text-muted-foreground">
                Le lien expire après une heure pour des raisons de sécurité.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDone(false);
                    setEmail('');
                  }}
                >
                  Utiliser un autre email
                </Button>
                <Link href="/login">
                  <Button type="button" size="sm">
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5"
            aria-label="Formulaire de réinitialisation du mot de passe"
          >
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <p>
                Si l&apos;email correspond à un compte Cyna, vous recevrez un lien valide une heure.
              </p>
            </div>

            <div>
              <label
                htmlFor="forgot-email"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Email
                <span aria-hidden="true" className="ml-0.5 text-destructive">
                  *
                </span>
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={email.length > 0 && !emailValid ? true : undefined}
                aria-describedby={error ? 'forgot-form-error' : undefined}
                placeholder="votre@email.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {email.length > 0 && !emailValid && (
                <p className="mt-1 text-sm text-destructive">
                  Veuillez entrer une adresse email valide.
                </p>
              )}
            </div>

            <p
              id="forgot-form-error"
              role="alert"
              aria-live="polite"
              className="min-h-[1.25rem] text-sm text-destructive"
            >
              {error ?? ''}
            </p>

            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit}
              aria-busy={submitting || undefined}
              className="w-full"
            >
              {submitting ? 'Envoi…' : 'Envoyer le lien'}
            </Button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Vous vous souvenez de votre mot de passe ?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
