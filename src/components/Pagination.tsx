'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * Wrapper typé autour des primitives shadcn pagination.
 *
 * Deux modes via union discriminée :
 *   - `hrefForPage`  → pagination URL (catalogue, search, …). Rend des
 *     `<Link>` next-intl (Bloc A i18n LOT 1) → SSR + partage URL + prefetch
 *     + préfixe locale préservé automatiquement.
 *   - `onPageChange` → pagination en mémoire (tableaux admin). Rend des
 *     `<button type="button">` → pas de navigation, juste un setter
 *     local côté parent.
 *
 * i18n LOT 1 Bloc A — libellés externalisés (namespace `pagination`).
 * Chaque texte visible (Précédent/Suivant, aria-labels par page) passe
 * par `useTranslations('pagination')`.
 */

type CommonProps = {
  currentPage: number;
  totalPages: number;
  className?: string;
  ariaLabel?: string;
};

type LinkProps = CommonProps & {
  hrefForPage: (page: number) => string;
  onPageChange?: never;
};

type ButtonProps = CommonProps & {
  onPageChange: (page: number) => void;
  hrefForPage?: never;
};

type Props = LinkProps | ButtonProps;

function pageItems(current: number, total: number): Array<number | 'ellipsis-left' | 'ellipsis-right'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const window = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => window.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => window.add(p));

  const pages = Array.from(window)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);

  const items: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];
  for (let i = 0; i < pages.length; i++) {
    items.push(pages[i]);
    const next = pages[i + 1];
    if (next !== undefined && next - pages[i] > 1) {
      items.push(pages[i] < current ? 'ellipsis-left' : 'ellipsis-right');
    }
  }
  return items;
}

export default function Pagination(props: Props): JSX.Element | null {
  const t = useTranslations('pagination');
  const { currentPage, totalPages, className, ariaLabel } = props;
  if (totalPages <= 1) return null;

  const isLink = 'hrefForPage' in props && typeof props.hrefForPage === 'function';
  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;
  const prevPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  const items = pageItems(currentPage, totalPages);

  const pageButtonClass = (isActive: boolean) =>
    cn(buttonVariants({ variant: isActive ? 'outline' : 'ghost', size: 'icon' }));

  const renderPageControl = (page: number, isActive: boolean): JSX.Element => {
    const label = isActive
      ? t('pageAriaCurrent', { page })
      : t('pageAria', { page });
    if (isLink) {
      return (
        <Link
          href={props.hrefForPage(page)}
          scroll={false}
          aria-label={label}
          aria-current={isActive ? 'page' : undefined}
          className={pageButtonClass(isActive)}
        >
          {page}
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => props.onPageChange(page)}
        className={pageButtonClass(isActive)}
      >
        {page}
      </button>
    );
  };

  const prevNextClass = (side: 'prev' | 'next', disabled: boolean) =>
    cn(
      buttonVariants({ variant: 'ghost', size: 'default' }),
      side === 'prev' ? 'gap-1 pl-2.5' : 'gap-1 pr-2.5',
      disabled && 'pointer-events-none opacity-50',
    );

  const renderPrev = (): JSX.Element => {
    const label = prevDisabled ? t('prevAriaDisabled') : t('prevAria');
    if (isLink) {
      return prevDisabled ? (
        <span aria-disabled="true" aria-label={label} className={prevNextClass('prev', true)}>
          <ChevronLeft className="h-4 w-4" />
          <span>{t('previous')}</span>
        </span>
      ) : (
        <Link
          href={props.hrefForPage(prevPage)}
          scroll={false}
          aria-label={label}
          className={prevNextClass('prev', false)}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{t('previous')}</span>
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={label}
        disabled={prevDisabled}
        onClick={() => props.onPageChange(prevPage)}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'default' }),
          'gap-1 pl-2.5 disabled:opacity-50',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        <span>{t('previous')}</span>
      </button>
    );
  };

  const renderNext = (): JSX.Element => {
    const label = nextDisabled ? t('nextAriaDisabled') : t('nextAria');
    if (isLink) {
      return nextDisabled ? (
        <span aria-disabled="true" aria-label={label} className={prevNextClass('next', true)}>
          <span>{t('next')}</span>
          <ChevronRight className="h-4 w-4" />
        </span>
      ) : (
        <Link
          href={props.hrefForPage(nextPage)}
          scroll={false}
          aria-label={label}
          className={prevNextClass('next', false)}
        >
          <span>{t('next')}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      );
    }
    return (
      <button
        type="button"
        aria-label={label}
        disabled={nextDisabled}
        onClick={() => props.onPageChange(nextPage)}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'default' }),
          'gap-1 pr-2.5 disabled:opacity-50',
        )}
      >
        <span>{t('next')}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  };

  return (
    <nav
      role="navigation"
      aria-label={ariaLabel ?? t('ariaLabel')}
      className={cn('mx-auto flex w-full justify-center', className)}
    >
      <ul className="flex flex-row items-center gap-1">
        <li>{renderPrev()}</li>
        {items.map((item) =>
          item === 'ellipsis-left' || item === 'ellipsis-right' ? (
            <li key={item}>
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t('morePages')}</span>
              </span>
            </li>
          ) : (
            <li key={item}>{renderPageControl(item, item === currentPage)}</li>
          ),
        )}
        <li>{renderNext()}</li>
      </ul>
    </nav>
  );
}
