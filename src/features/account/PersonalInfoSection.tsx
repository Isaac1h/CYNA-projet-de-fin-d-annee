'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { validateEmail, validatePassword } from '@/lib/auth';

export default function PersonalInfoSection() {
  const t = useTranslations('account.personal');
  const { currentUser, updateProfile, updatePassword } = useAuth();
  const [fullName, setFullName] = useState(currentUser?.full_name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [profileError, setProfileError] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const emailValid = validateEmail(email);
  const fullNameValid = fullName.trim().length >= 2;
  const profileDirty = fullName !== (currentUser?.full_name ?? '') || email !== (currentUser?.email ?? '');
  const canSubmitProfile = profileDirty && emailValid && fullNameValid && !profileSubmitting;

  const passwordPolicyValid = validatePassword(newPassword).isValid;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmitPassword =
    currentPassword.length > 0 && passwordPolicyValid && passwordsMatch && !passwordSubmitting;

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitProfile) return;
    setProfileError('');
    setProfileSubmitting(true);
    const result = await updateProfile({ full_name: fullName.trim(), email: email.trim() });
    setProfileSubmitting(false);
    if (!result.success) {
      setProfileError(result.error ?? t('updateFailed'));
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmitPassword) return;
    setPasswordError('');
    setPasswordSubmitting(true);
    const result = await updatePassword(currentPassword, newPassword);
    setPasswordSubmitting(false);
    if (result.success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      return;
    }
    setPasswordError(result.error ?? t('updateFailed'));
  };

  return (
    <section id="personal-info" aria-labelledby="personal-info-heading" className="space-y-6">
      <header>
        <h2 id="personal-info-heading" className="text-xl font-bold text-foreground sm:text-2xl">
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <form onSubmit={handleProfileSubmit} noValidate className="space-y-4" aria-label={t('profileAria')}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="account-fullname" className="mb-1 block text-sm font-medium text-foreground">
                {t('fullName')}
              </label>
              <input
                id="account-fullname"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="account-email" className="mb-1 block text-sm font-medium text-foreground">
                {t('email')}
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={email.length > 0 && !emailValid ? true : undefined}
                aria-describedby={email.length > 0 && !emailValid ? 'account-email-error' : undefined}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {email.length > 0 && !emailValid && (
                <p id="account-email-error" role="alert" className="mt-1 text-sm text-destructive">
                  {t('emailInvalid')}
                </p>
              )}
            </div>
          </div>

          {/* FIXME-SECURITY: changing the email here just rewrites the
              localStorage user. With Supabase Auth, the new address must be
              re-confirmed through a verification email before the change is
              persisted server-side. */}
          <p className="text-xs text-muted-foreground">{t('emailReconfirmNotice')}</p>

          <p
            id="account-profile-error"
            role="alert"
            aria-live="polite"
            className="min-h-[1.25rem] text-sm text-destructive"
          >
            {profileError}
          </p>

          <Button
            type="submit"
            disabled={!canSubmitProfile}
            aria-busy={profileSubmitting || undefined}
            aria-describedby={profileError ? 'account-profile-error' : undefined}
          >
            {profileSubmitting ? t('saving') : t('saveProfile')}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-foreground">{t('password.heading')}</h3>
        <p className="mb-5 text-sm text-muted-foreground">{t('password.subheading')}</p>

        {/* FIXME-SECURITY: client-side current-password verification via
            SHA-256 comparison. Supabase Auth will check the current password
            server-side and re-issue a JWT — drop this entire block when the
            integration lands. */}
        <form
          onSubmit={handlePasswordSubmit}
          noValidate
          className="space-y-4"
          aria-label={t('password.formAria')}
        >
          <div>
            <label htmlFor="account-current-password" className="mb-1 block text-sm font-medium text-foreground">
              {t('password.current')}
            </label>
            <input
              id="account-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="account-new-password" className="mb-1 block text-sm font-medium text-foreground">
                {t('password.new')}
              </label>
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                aria-describedby="account-password-rules"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="account-confirm-password" className="mb-1 block text-sm font-medium text-foreground">
                {t('password.confirm')}
              </label>
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch ? true : undefined}
                aria-describedby={
                  confirmPassword.length > 0 && !passwordsMatch ? 'account-password-mismatch' : undefined
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p id="account-password-mismatch" role="alert" className="mt-1 text-sm text-destructive">
                  {t('password.mismatch')}
                </p>
              )}
            </div>
          </div>

          <ul id="account-password-rules" className="space-y-1 text-xs text-muted-foreground">
            <li>{t('password.rule')}</li>
          </ul>

          <p
            id="account-password-error"
            role="alert"
            aria-live="polite"
            className="min-h-[1.25rem] text-sm text-destructive"
          >
            {passwordError}
          </p>

          <Button
            type="submit"
            variant="secondary"
            disabled={!canSubmitPassword}
            aria-busy={passwordSubmitting || undefined}
            aria-describedby={passwordError ? 'account-password-error' : undefined}
          >
            {passwordSubmitting ? t('password.updating') : t('password.submit')}
          </Button>
        </form>
      </div>
    </section>
  );
}
