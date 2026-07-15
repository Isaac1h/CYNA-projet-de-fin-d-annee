'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuth } from '@/context/AuthContext';
import { validateEmail } from '@/lib/auth';
import { RULE_LABELS, evaluatePassword } from './passwordStrength';

type Props = {
  /** Called with the email used to register, after a successful register call. */
  onSuccess: (email: string) => void;
};

/**
 * Pure registration form. All credential handling goes through
 * `useAuth().register()` — we never hash, store or compare passwords here.
 *
 * FIXME-SECURITY: today `useAuth().register()` writes to `localStorage` with
 * the provisional SHA-256 hash in `lib/auth.ts` (Supabase Auth is not wired
 * in yet). The entire flow will be replaced by Supabase Auth (bcrypt + JWT,
 * server-issued cookies, server-enforced password policy, verification
 * email). Do NOT add any new hashing or credential storage here.
 *
 * FIXME-SECURITY: the rules surfaced below are UX hints only. Real password
 * policy is enforced server-side by Supabase Auth once the swap happens.
 */
export default function RegisterForm({ onSuccess }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const emailValid = validateEmail(email);
  const strength = useMemo(() => evaluatePassword(password), [password]);
  const passwordValid = strength.score === strength.outOf;
  const passwordsMatch = confirm.length > 0 && password === confirm;

  const fullNameValid = fullName.trim().length >= 2;

  const canSubmit = fullNameValid && emailValid && passwordValid && passwordsMatch && !submitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setFormError('');
    setSubmitting(true);
    const result = await register(email, password, fullName.trim());
    setSubmitting(false);
    if (result.success) {
      onSuccess(email);
      return;
    }
    setFormError(result.error ?? "L'inscription a échoué.");
  };

  const showEmailError = email.length > 0 && !emailValid;
  const showPasswordsMismatch = confirm.length > 0 && !passwordsMatch;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-label="Formulaire d'inscription"
    >
      <div>
        <label htmlFor="register-fullname" className="mb-1 block text-sm font-medium text-foreground">
          Nom complet
        </label>
        <input
          id="register-fullname"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Jean Dupont"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="mb-1 block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={showEmailError || undefined}
          aria-describedby={showEmailError ? 'register-email-error' : undefined}
          placeholder="votre@email.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {showEmailError && (
          <p id="register-email-error" role="alert" className="mt-1 text-sm text-destructive">
            Veuillez entrer une adresse email valide.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="register-password" className="mb-1 block text-sm font-medium text-foreground">
          Mot de passe
        </label>
        <PasswordInput
          id="register-password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="register-password-meter register-password-rules"
          placeholder="••••••••"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        <div id="register-password-meter" aria-live="polite" className="mt-2">
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

        <ul id="register-password-rules" className="mt-2 space-y-1">
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
        <label htmlFor="register-confirm" className="mb-1 block text-sm font-medium text-foreground">
          Confirmer le mot de passe
        </label>
        <PasswordInput
          id="register-confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={showPasswordsMismatch || undefined}
          aria-describedby={showPasswordsMismatch ? 'register-confirm-error' : undefined}
          placeholder="••••••••"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {showPasswordsMismatch && (
          <p id="register-confirm-error" role="alert" className="mt-1 text-sm text-destructive">
            Les mots de passe ne correspondent pas.
          </p>
        )}
      </div>

      <p
        id="register-form-error"
        role="alert"
        aria-live="polite"
        className="min-h-[1.5rem] text-sm text-destructive"
      >
        {formError}
      </p>

      <Button
        type="submit"
        size="lg"
        disabled={!canSubmit}
        aria-busy={submitting || undefined}
        aria-describedby={formError ? 'register-form-error' : undefined}
        className="w-full"
      >
        {submitting ? 'Création du compte…' : 'Créer un compte'}
      </Button>
    </form>
  );
}
