'use client';

import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

/**
 * i18n LOT 1 — sélecteur de langue.
 *
 * Utilise `next-intl/navigation` pour :
 *   - `usePathname()` → pathname SANS préfixe locale (canonique)
 *   - `router.replace(pathname, { locale })` → swap la locale en
 *     conservant l'URL courante (as-needed : /checkout ↔ /en/checkout)
 *
 * Le cookie NEXT_LOCALE est posé automatiquement par le middleware
 * `next-intl` pour mémoriser la préférence utilisateur.
 *
 * Design mobile-first : dropdown compact, deux entrées seulement (FR, EN).
 * Facile d'ajouter une 3e langue (AR) dans routing.ts sans toucher
 * ce composant.
 */

const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (newLocale: Locale) => {
    if (newLocale === locale) return;
    // `pathname` est locale-stripped par next-intl (ex. '/checkout'),
    // et router.replace ajoute automatiquement le préfixe selon la
    // nouvelle locale (as-needed : rien pour FR, '/en' pour EN).
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="p-2 hover:bg-secondary rounded-lg text-muted-foreground hover:text-primary"
          aria-label={`Langue : ${LOCALE_LABELS[locale]}`}
        >
          <Languages className="w-5 h-5" aria-hidden="true" />
          <span className="ml-1 text-xs font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 bg-popover border-border">
        {(Object.entries(LOCALE_LABELS) as [Locale, string][]).map(
          ([code, label]) => (
            <DropdownMenuItem
              key={code}
              onClick={() => switchTo(code)}
              className={`cursor-pointer focus:bg-secondary focus:text-primary ${
                code === locale ? 'font-semibold text-primary' : ''
              }`}
              aria-current={code === locale ? 'true' : undefined}
            >
              <span className="mr-2 text-xs uppercase">{code}</span>
              {label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
