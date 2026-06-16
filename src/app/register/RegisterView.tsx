'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import RegisterForm from '@/features/auth/RegisterForm';
import { safeRedirectTarget } from '@/features/auth/redirect';

const RegisterSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    {[0, 1, 2, 3].map((row) => (
      <div
        key={row}
        className="h-10 animate-pulse rounded-md border border-border bg-card/40"
        aria-hidden="true"
      />
    ))}
    <span className="sr-only">Chargement du formulaire d&apos;inscription…</span>
  </div>
);

export default function RegisterView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading } = useAuth();

  const redirectTarget = useMemo(
    () => safeRedirectTarget(searchParams.get('from')),
    [searchParams],
  );

  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  // FIXME-SECURITY: client-side guard only. Already-authenticated users get
  // bounced away from /register as a UX nicety; real route protection will
  // live in a Supabase middleware once the auth swap lands. Do not rely on
  // this for authorisation.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(redirectTarget);
    }
  }, [loading, isAuthenticated, redirectTarget, router]);

  if (loading || isAuthenticated) {
    return <RegisterSkeleton />;
  }

  if (registeredEmail !== null) {
    const loginHref = `/login${redirectTarget !== '/' ? `?from=${encodeURIComponent(redirectTarget)}` : ''}`;
    return (
      <section
        aria-labelledby="register-success-heading"
        className="rounded-lg border border-border bg-card p-6 text-center shadow-sm sm:p-8"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15"
        >
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 id="register-success-heading" className="mb-2 text-xl font-bold text-foreground sm:text-2xl">
          Compte créé
        </h1>
        <p className="mb-5 text-muted-foreground">
          Un email de confirmation va être envoyé à{' '}
          <span className="font-medium text-foreground">{registeredEmail}</span>. Cliquez sur le
          lien qu&apos;il contiendra pour activer votre compte avant de vous connecter.
        </p>
        {/* TODO(supabase): the verification email will be sent automatically
            by Supabase Auth once integration lands. Until then, no email is
            actually sent — this confirmation screen is purely informational. */}
        <p className="mb-6 text-xs text-muted-foreground">
          Pendant la phase de démo, cet email n&apos;est pas encore réellement envoyé.
        </p>
        <Link href={loginHref}>
          <Button type="button" size="lg" className="w-full">
            Aller à la page de connexion
          </Button>
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground sm:text-3xl">Créer un compte</h1>
        <p className="text-muted-foreground">
          Rejoignez Cyna pour gérer vos solutions de sécurité.
        </p>
        {redirectTarget !== '/' && (
          <p className="mt-2 text-xs text-muted-foreground">
            Vous serez redirigé vers{' '}
            <span className="font-mono text-foreground">{redirectTarget}</span> après connexion.
          </p>
        )}
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
        <RegisterForm onSuccess={setRegisteredEmail} />
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link
          href={`/login${redirectTarget !== '/' ? `?from=${encodeURIComponent(redirectTarget)}` : ''}`}
          className="font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
