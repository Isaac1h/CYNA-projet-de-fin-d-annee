'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { safeRedirectTarget } from '@/features/auth/redirect';
import { isAdmin } from '@/features/admin/guard';
import DashboardSection from '@/features/admin/DashboardSection';
import ProductsAdminSection from '@/features/admin/ProductsAdminSection';
import OrdersAdminSection from '@/features/admin/OrdersAdminSection';
import MessagesAdminSection from '@/features/admin/MessagesAdminSection';
import AuditLogAdminSection from '@/features/admin/AuditLogAdminSection';
import CarouselAdminSection from '@/features/admin/CarouselAdminSection';
import CategoriesAdminSection from '@/features/admin/CategoriesAdminSection';
import HomeContentAdminSection from '@/features/admin/HomeContentAdminSection';
import PromotionsAdminSection from '@/features/admin/PromotionsAdminSection';

const ADMIN_PATH = '/admin';

const AdminSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-live="polite">
    {[0, 1, 2].map((row) => (
      <div
        key={row}
        className="h-44 animate-pulse rounded-lg border border-border bg-card/40"
        aria-hidden="true"
      />
    ))}
    <span className="sr-only">Vérification de votre habilitation administrateur…</span>
  </div>
);

const AccessDenied = ({ email }: { email: string }) => (
  <section
    aria-labelledby="admin-denied-heading"
    className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center shadow-sm"
  >
    <div
      aria-hidden="true"
      className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15"
    >
      <ShieldOff className="h-8 w-8 text-destructive" />
    </div>
    <h1 id="admin-denied-heading" className="text-2xl font-bold text-foreground">
      Accès refusé
    </h1>
    <p className="mt-2 max-w-md text-sm text-muted-foreground sm:mx-auto">
      Vous êtes bien connecté en tant que <span className="font-medium text-foreground">{email}</span>{' '}
      mais ce compte n&apos;a pas les droits d&apos;administration. Contactez votre référent Cyna
      si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
    </p>
    <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
      <Link href="/my-account">
        <Button type="button" variant="outline">
          Retour à mon compte
        </Button>
      </Link>
      <Link href="/">
        <Button type="button">Aller à l&apos;accueil</Button>
      </Link>
    </div>
  </section>
);

export default function AdminView() {
  const router = useRouter();
  const { isAuthenticated, loading, currentUser } = useAuth();
  const allowed = isAdmin(currentUser);

  // Client-side guard for `/admin`. UX only — the real protection lives
  // in Postgres (RLS + `is_admin()`), so a tampered client can render
  // this view but cannot read or mutate any admin data. Still missing:
  // a Next.js middleware that rejects `/admin/*` for non-admin JWTs
  // before render, plus MFA for the admin role.
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const fromParam = encodeURIComponent(safeRedirectTarget(ADMIN_PATH));
      router.replace(`/login?from=${fromParam}`);
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return <AdminSkeleton />;
  }

  if (!allowed) {
    return <AccessDenied email={currentUser?.email ?? '—'} />;
  }

  return (
    <div className="space-y-10">
      <div
        role="note"
        className="rounded-md border border-border bg-card/40 p-4 text-sm text-muted-foreground"
      >
        <p className="font-semibold text-foreground">Sécurité de l&apos;administration</p>
        <p className="mt-1">
          Accès gaté côté serveur par{' '}
          <code className="rounded bg-secondary px-1 text-foreground">src/middleware.ts</code>{' '}
          (session + rôle <code className="rounded bg-secondary px-1 text-foreground">admin</code>{' '}
          + AAL2 / TOTP, <em>fail-closed</em>) avant tout rendu. Toutes les écritures admin
          passent par des RPC SECURITY DEFINER qui re-vérifient{' '}
          <code className="rounded bg-secondary px-1 text-foreground">is_admin()</code> ; les
          lectures sont protégées par la RLS Postgres. Cette UI n&apos;est qu&apos;une
          surface — un client trafiqué peut l&apos;afficher mais aucune donnée sensible
          ne sortira de la base.
        </p>
      </div>

      <nav aria-label="Sections de l'administration" className="rounded-lg border border-border bg-card/40 p-3 text-sm">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="#dashboard"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Tableau de bord
            </Link>
          </li>
          <li>
            <Link
              href="#products"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Produits
            </Link>
          </li>
          <li>
            <Link
              href="#orders"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Commandes
            </Link>
          </li>
          <li>
            <Link
              href="#messages"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Messages
            </Link>
          </li>
          <li>
            <Link
              href="#carousel"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Carrousel
            </Link>
          </li>
          <li>
            <Link
              href="#categories"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Catégories
            </Link>
          </li>
          <li>
            <Link
              href="#promotions"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Promotions
            </Link>
          </li>
          <li>
            <Link
              href="#home-content"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Contenu home
            </Link>
          </li>
          <li>
            <Link
              href="#audit-log"
              className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Journal
            </Link>
          </li>
        </ul>
      </nav>

      <DashboardSection />
      <ProductsAdminSection />
      <OrdersAdminSection />
      <MessagesAdminSection />
      <CarouselAdminSection />
      <CategoriesAdminSection />
      <PromotionsAdminSection />
      <HomeContentAdminSection />
      <AuditLogAdminSection />
    </div>
  );
}
