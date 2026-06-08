'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

/**
 * Two-factor (TOTP) enrollment section in /my-account.
 *
 * Open to every user (good practice — clients can also opt in). For admins
 * it is REQUIRED: the /admin middleware enforces AAL2, redirecting an
 * admin without a verified TOTP factor here with `?reason=mfa_required`.
 *
 * Recovery: Supabase Auth has no native backup codes. If the user loses
 * their TOTP device, recovery means another admin removes their factor in
 * the database. Documented in the UI and in the "active" state copy.
 *
 * Disabling a verified factor requires AAL2; rather than pre-checking the
 * level we always run a fresh challenge + verify before unenroll. Side
 * benefit: the user proves they still own the device at the moment of
 * disabling.
 */

type Stage = 'loading' | 'idle' | 'enrolling' | 'active' | 'disabling';

type EnrollPayload = {
  factorId: string;
  qrCode: string;
  secret: string;
};

const codeInputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-lg tracking-widest';

const destructiveBoxClass =
  'rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive';

export default function TwoFactorSection() {
  const t = useTranslations('account.twoFactor');
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null);
  const [enrollPayload, setEnrollPayload] = useState<EnrollPayload | null>(null);
  const [code, setCode] = useState('');

  function mapMfaError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('invalid totp') || m.includes('invalid code') || m.includes('invalid one-time')) {
      return t('mfaError.invalidCode');
    }
    if (m.includes('aal2') && m.includes('required')) {
      return t('mfaError.aal2Required');
    }
    if (m.includes('expir')) {
      return t('mfaError.expired');
    }
    if (m.includes('not found') || m.includes('does not exist')) {
      return t('mfaError.notFound');
    }
    return raw;
  }

  useEffect(() => {
    void refreshStage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshStage(): Promise<void> {
    const { data, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) {
      toast({
        title: t('toastError.title'),
        description: mapMfaError(listErr.message),
        variant: 'destructive',
      });
      setStage('idle');
      return;
    }
    // `data.totp` only contains VERIFIED totp factors in @supabase/ssr.
    // Unverified ones (abandoned enrolls) live in `data.all` until we
    // explicitly clean them up so a fresh enroll cannot collide on
    // friendly_name.
    const verified = (data?.totp ?? [])[0];
    if (verified) {
      setActiveFactorId(verified.id);
      setStage('active');
      return;
    }
    const unverifiedTotp = (data?.all ?? []).filter(
      (f) => f.factor_type === 'totp' && f.status === 'unverified',
    );
    for (const f of unverifiedTotp) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    setActiveFactorId(null);
    setStage('idle');
  }

  async function startEnrollment(): Promise<void> {
    setError('');
    setBusy(true);
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Cyna TOTP',
    });
    setBusy(false);
    if (enrollErr || !data) {
      setError(enrollErr ? mapMfaError(enrollErr.message) : t('enrollFailed'));
      return;
    }
    setEnrollPayload({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
    setCode('');
    setStage('enrolling');
  }

  async function handleVerifyEnrollment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!enrollPayload || code.length !== 6) return;
    setError('');
    setBusy(true);
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: enrollPayload.factorId,
    });
    if (challengeErr || !challenge) {
      setBusy(false);
      setError(challengeErr ? mapMfaError(challengeErr.message) : t('challengeFailed'));
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrollPayload.factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyErr) {
      setError(mapMfaError(verifyErr.message));
      return;
    }
    toast({
      title: t('toastEnabled.title'),
      description: t('toastEnabled.desc'),
    });
    setEnrollPayload(null);
    setCode('');
    await refreshStage();
  }

  function cancelEnrollment(): void {
    setError('');
    if (enrollPayload) {
      void supabase.auth.mfa.unenroll({ factorId: enrollPayload.factorId });
    }
    setEnrollPayload(null);
    setCode('');
    setStage('idle');
  }

  function startDisable(): void {
    setError('');
    setCode('');
    setStage('disabling');
  }

  function cancelDisable(): void {
    setError('');
    setCode('');
    setStage('active');
  }

  async function handleConfirmDisable(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!activeFactorId || code.length !== 6) return;
    setError('');
    setBusy(true);
    // Step-up: challenge + verify before unenroll. Supabase requires AAL2
    // to unenroll a verified factor; verify always satisfies that for the
    // current session and also proves the user still owns the device.
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: activeFactorId,
    });
    if (challengeErr || !challenge) {
      setBusy(false);
      setError(challengeErr ? mapMfaError(challengeErr.message) : t('challengeFailed'));
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: activeFactorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) {
      setBusy(false);
      setError(mapMfaError(verifyErr.message));
      return;
    }
    const { error: unenrollErr } = await supabase.auth.mfa.unenroll({
      factorId: activeFactorId,
    });
    setBusy(false);
    if (unenrollErr) {
      setError(mapMfaError(unenrollErr.message));
      return;
    }
    toast({
      title: t('toastDisabled.title'),
      description: t('toastDisabled.desc'),
    });
    setActiveFactorId(null);
    setCode('');
    await refreshStage();
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <section id="two-factor" aria-labelledby="two-factor-heading" className="space-y-4">
      <header>
        <h2 id="two-factor-heading" className="text-xl font-bold text-foreground">
          {t('heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('subheading')}</p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
        {stage === 'loading' && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('loading')}
          </p>
        )}

        {stage === 'idle' && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 text-yellow-500" />
              <span>
                {t('stateLabel')} <strong>{t('stateInactive')}</strong>
              </span>
            </p>
            <Button type="button" onClick={() => void startEnrollment()} disabled={busy}>
              {busy ? t('preparing') : t('activate')}
            </Button>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        {stage === 'enrolling' && enrollPayload && (
          <form onSubmit={(e) => void handleVerifyEnrollment(e)} className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                <strong>1.</strong> {t('qrStep1')}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollPayload.qrCode}
                alt={t('qrAlt')}
                className="block h-48 w-48 rounded-md border border-border bg-white p-2"
              />
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {t('secretToggle')}
                </summary>
                <code className="mt-2 block break-all rounded bg-secondary p-2 text-xs">
                  {enrollPayload.secret}
                </code>
              </details>
            </div>
            <div className="space-y-2">
              <label htmlFor="enroll-code" className="text-sm font-medium text-foreground">
                <strong>2.</strong> {t('codeStep2')}
              </label>
              <input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
                aria-describedby={error ? 'enroll-error' : undefined}
                className={codeInputClass}
              />
            </div>
            {error && (
              <p id="enroll-error" className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? t('verifying') : t('verifyActivate')}
              </Button>
              <Button type="button" variant="outline" onClick={cancelEnrollment} disabled={busy}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}

        {stage === 'active' && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-green-500" />
              <span>
                {t('stateLabel')} <strong>{t('stateActive')}</strong>
              </span>
            </p>
            <p className="text-sm text-muted-foreground">{t('activeHint')}</p>
            <Button type="button" variant="outline" onClick={startDisable} disabled={busy}>
              {t('disable')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('recoveryHint')}</p>
          </div>
        )}

        {stage === 'disabling' && (
          <form onSubmit={(e) => void handleConfirmDisable(e)} className="space-y-4">
            <div role="alert" className={destructiveBoxClass}>
              <p className="mb-1 font-medium leading-none tracking-tight">
                {t('confirmDisableHeading')}
              </p>
              <p className="leading-relaxed">
                {isAdmin ? (
                  <>
                    {t('confirmDisableAdminBefore')}{' '}
                    <strong>{t('confirmDisableAdminEmphasis')}</strong>{' '}
                    {t('confirmDisableAdminAfter')}
                  </>
                ) : (
                  <>{t('confirmDisableUser')}</>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="disable-code" className="text-sm font-medium text-foreground">
                {t('disableCodeLabel')}
              </label>
              <input
                id="disable-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={busy}
                aria-describedby={error ? 'disable-error' : undefined}
                className={codeInputClass}
              />
            </div>
            {error && (
              <p id="disable-error" className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" variant="destructive" disabled={busy || code.length !== 6}>
                {busy ? t('disabling') : t('confirmDisable')}
              </Button>
              <Button type="button" variant="outline" onClick={cancelDisable} disabled={busy}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
