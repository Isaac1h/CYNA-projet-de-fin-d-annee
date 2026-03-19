'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import LoginForm from '@/features/auth/LoginForm';
import { useAuth } from '@/context/AuthContext';

/**
 * Open-redirect guard for the `?from=` query string. Only same-origin
 * absolute paths are accepted; protocol-relative URLs and full URLs fall
 * back to the home page.
 *
 * FIXME-SECURITY: this is a client-side guard so a tampered URL cannot
 * push us anywhere external — when the Supabase middleware lands, the
 * server route will re-validate the redirect target before issuing the
 * session cookie.
 */
const safeRedirectTarget = (raw: string | null): string => {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
};

const LoginSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <div className="h-10 animate-pulse rounded-md border border-border bg-card/40" aria-hidden="true" />
    <span className="sr-only">Chargement du formulaire de connexion…</span>
  </div>
);

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  const redirectTarget = useMemo(
    () => safeRedirectTarget(searchParams.get('from')),
    [searchParams],
  );

  // FIXME-SECURITY: client-side guard only. If the user is already
  // authenticated we send them away from /login as a UX nicety, but real
  // route protection will live in a Supabase middleware once the auth swap
  // lands. Do not rely on this for authorisation.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [loading, isAuthenticated, redirectTarget, router]);

  const handleSuccess = () => {
    router.replace(redirectTarget);
  };

  if (loading) {
    return <LoginSkeleton />;
  }

  if (isAuthenticated) {
    return <LoginSkeleton />;
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Bon retour</h1>
        <p className="text-muted-foreground">Connectez-vous à votre compte Cyna.</p>
        {redirectTarget !== '/' && (
          <p className="mt-2 text-xs text-muted-foreground">
            Vous serez redirigé vers{' '}
            <span className="font-mono text-foreground">{redirectTarget}</span> après la connexion.
          </p>
        )}
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <LoginForm onSuccess={handleSuccess} />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link
          href={`/register${redirectTarget !== '/' ? `?from=${encodeURIComponent(redirectTarget)}` : ''}`}
          className="font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
