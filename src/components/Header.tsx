'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Search, ShoppingCart, User, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { isAdmin } from '@/features/admin/guard';
import { Button } from '@/components/ui/button';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Header i18n-aware (i18n LOT 1 — E2).
 *
 * - `Link` et `usePathname` viennent de `@/i18n/navigation` (next-intl) :
 *   les hrefs sont donnés SANS préfixe locale, l'ajout se fait
 *   automatiquement (as-needed → rien pour FR, /en/ pour EN).
 * - `usePathname` retourne le pathname SANS préfixe locale — donc
 *   `pathname === '/checkout'` compare correctement que l'URL soit
 *   '/checkout' ou '/en/checkout'.
 * - Textes via `useTranslations('nav')` avec fallback FR si EN manque.
 * - `useNextRouter` pour la recherche : encode la query et push le path
 *   canonique — next/navigation gère la locale par l'URL courante.
 */

// Chemins canoniques (sans préfixe locale). Le préfixe est appliqué
// automatiquement par le Link de next-intl selon la locale courante.
const NAV_LINKS = [
  { path: '/', labelKey: 'home' },
  { path: '/catalogue', labelKey: 'catalogue' },
  { path: '/tools', labelKey: 'tools' },
] as const;

const STATIC_BURGER_LINKS = [
  { path: '/cgu', labelKey: 'cgu' },
  { path: '/mentions-legales', labelKey: 'mentionsLegales' },
  { path: '/tools', labelKey: 'contact' },
  { path: '/a-propos', labelKey: 'about' },
] as const;

export default function Header() {
  const t = useTranslations('nav');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // useRouter et usePathname viennent de @/i18n/navigation — la locale
  // courante est préservée automatiquement sur les push.
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, currentUser, logout } = useAuth();
  const { getCartItemCount } = useCart();

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Push via next-intl router : pathname canonique '/search' + query.
      // La locale courante est préservée (ex : sur /en/… → /en/search?q=…).
      router.push({ pathname: '/search', query: { q: searchQuery } });
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const isActivePath = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2 group">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
              Cyna
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1" aria-label={t('primaryNav')}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isActivePath(link.path)
                    ? 'text-primary bg-secondary'
                    : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                }`}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            {isAdmin(currentUser) && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isActivePath('/admin')
                    ? 'text-primary bg-secondary'
                    : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                }`}
              >
                {t('admin')}
              </Link>
            )}
          </nav>

          <form onSubmit={handleSearch} className="hidden md:flex items-center flex-1 max-w-md mx-8" role="search">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('search')}
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <Link
              href="/cart"
              className="relative p-2 hover:bg-secondary rounded-lg transition-all duration-300 text-muted-foreground hover:text-primary"
              aria-label={t('cartLabel')}
            >
              <ShoppingCart className="w-6 h-6" />
              {getCartItemCount() > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {getCartItemCount()}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary"
                    aria-label={t('userMenu')}
                  >
                    <User className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {currentUser?.full_name || t('userDefault')}
                    </p>
                    <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="focus:bg-secondary focus:text-primary">
                    <Link href="/my-account" className="cursor-pointer">{t('myAccount')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="focus:bg-secondary focus:text-primary">
                    <Link href="/orders" className="cursor-pointer">{t('orders')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t('logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  {t('loginRegister')}
                </Button>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t('menuClose') : t('menuOpen')}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 hover:bg-secondary rounded-lg transition-all duration-300 text-muted-foreground"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border bg-background">
            <form onSubmit={handleSearch} className="mb-4" role="search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholderShort')}
                  aria-label={t('search')}
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                />
              </div>
            </form>

            <nav className="flex flex-col space-y-2" aria-label={t('mobileNav')}>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isActivePath(link.path)
                      ? 'text-primary bg-secondary'
                      : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              ))}
              {isAdmin(currentUser) && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isActivePath('/admin')
                      ? 'text-primary bg-secondary'
                      : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                  }`}
                >
                  {t('admin')}
                </Link>
              )}

              <div className="my-2 border-t border-border" role="separator" aria-hidden="true" />
              {isAuthenticated ? (
                <>
                  <Link
                    href="/my-account"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isActivePath('/my-account')
                        ? 'text-primary bg-secondary'
                        : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                    }`}
                  >
                    {t('myAccountShort')}
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isActivePath('/orders')
                        ? 'text-primary bg-secondary'
                        : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                    }`}
                  >
                    {t('myOrders')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      void handleLogout();
                    }}
                    className="flex items-center px-4 py-2 rounded-lg font-medium text-destructive hover:bg-destructive/10 transition-all duration-300 text-left"
                  >
                    <LogOut aria-hidden="true" className="w-4 h-4 mr-2" />
                    {t('logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isActivePath('/login')
                        ? 'text-primary bg-secondary'
                        : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                    }`}
                  >
                    {t('login')}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isActivePath('/register')
                        ? 'text-primary bg-secondary'
                        : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                    }`}
                  >
                    {t('register')}
                  </Link>
                </>
              )}

              <div className="my-2 border-t border-border" role="separator" aria-hidden="true" />
              {STATIC_BURGER_LINKS.map((link) => (
                <Link
                  key={`${link.path}-${link.labelKey}`}
                  href={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all duration-300 ${
                    isActivePath(link.path)
                      ? 'text-primary bg-secondary'
                      : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                  }`}
                >
                  {t(link.labelKey)}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
