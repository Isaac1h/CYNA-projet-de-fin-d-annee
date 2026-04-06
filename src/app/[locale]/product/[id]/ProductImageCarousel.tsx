'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductImage } from '@/lib/data';

/**
 * Carrousel d'illustrations pour la page produit (CDC VI §1).
 *
 * i18n LOT 1 Bloc A — libellés externalisés (namespace `product.carousel`).
 * Le pluriel `dotAria` est passé via ICU {index}/{total}.
 */

type Props = {
  images: ProductImage[];
  /** Alt par défaut quand une image n'a pas de alt en base. */
  fallbackAlt: string;
};

export default function ProductImageCarousel({ images, fallbackAlt }: Props) {
  const t = useTranslations('product.carousel');
  const [index, setIndex] = useState(0);
  const regionId = useId();
  const regionRef = useRef<HTMLDivElement | null>(null);
  const total = images.length;

  useEffect(() => {
    if (index >= total && total > 0) setIndex(total - 1);
  }, [total, index]);

  const goPrev = useCallback(() => setIndex((i) => (i - 1 + total) % total), [total]);
  const goNext = useCallback(() => setIndex((i) => (i + 1) % total), [total]);

  useEffect(() => {
    if (total < 2) return;
    const el = regionRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [total, goPrev, goNext]);

  if (total === 0) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        aria-label={t('regionAriaEmpty')}
      >
        <div className="aspect-[4/3] w-full bg-secondary/40" aria-hidden="true" />
      </div>
    );
  }

  const current = images[index];
  const currentAlt =
    current.alt && current.alt.trim().length > 0 ? current.alt : fallbackAlt;

  const hasControls = total >= 2;

  return (
    <div
      ref={regionRef}
      id={regionId}
      role="region"
      aria-roledescription="carrousel"
      aria-label={t('regionAria')}
      tabIndex={hasControls ? 0 : -1}
      className="relative overflow-hidden rounded-xl border border-border bg-card shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          key={current.url}
          src={current.url}
          alt={currentAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority={index === 0}
        />
      </div>

      {hasControls && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('prev')}
            aria-controls={regionId}
            className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label={t('next')}
            aria-controls={regionId}
            className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronRight aria-hidden="true" className="h-5 w-5" />
          </button>

          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2"
            role="tablist"
            aria-label={t('dotsAria')}
          >
            {images.map((img, i) => {
              const active = i === index;
              return (
                <button
                  key={`${img.url}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t('dotAria', { index: i + 1, total })}
                  aria-current={active}
                  aria-controls={regionId}
                  className={`h-2 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    active ? 'w-6 bg-primary' : 'w-2 bg-muted hover:bg-muted-foreground/70'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
