'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Search, ShoppingCart, User, Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navLinks = [
  { path: '/', label: 'Accueil' },
  { path: '/catalogue', label: 'Catalogue' },
  { path: '/tools', label: 'Outils' },
];

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, currentUser, logout } = useAuth();
  const { getCartItemCount } = useCart();

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
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

          <nav className="hidden md:flex items-center space-x-1" aria-label="Navigation principale">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isActivePath(link.path)
                    ? 'text-primary bg-secondary'
                    : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {currentUser?.email === 'admin@cyna.com' && (
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                  isActivePath('/admin')
                    ? 'text-primary bg-secondary'
                    : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                }`}
              >
                Admin
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
                placeholder="Rechercher des produits..."
                aria-label="Rechercher des produits"
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-300 text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </form>

          <div className="flex items-center space-x-4">
            <Link
              href="/cart"
              className="relative p-2 hover:bg-secondary rounded-lg transition-all duration-300 text-muted-foreground hover:text-primary"
              aria-label="Panier"
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
                    aria-label="Menu utilisateur"
                  >
                    <User className="w-6 h-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border-border">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground">{currentUser?.full_name || 'Utilisateur'}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem asChild className="focus:bg-secondary focus:text-primary">
                    <Link href="/my-account" className="cursor-pointer">Mon Compte</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="focus:bg-secondary focus:text-primary">
                    <Link href="/orders" className="cursor-pointer">Historique des Commandes</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Connexion / Inscription
                </Button>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
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
                  placeholder="Rechercher..."
                  aria-label="Rechercher des produits"
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                />
              </div>
            </form>

            <nav className="flex flex-col space-y-2" aria-label="Navigation mobile">
              {navLinks.map((link) => (
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
                  {link.label}
                </Link>
              ))}
              {currentUser?.email === 'admin@cyna.com' && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                    isActivePath('/admin')
                      ? 'text-primary bg-secondary'
                      : 'text-muted-foreground hover:text-primary hover:bg-secondary/50'
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
