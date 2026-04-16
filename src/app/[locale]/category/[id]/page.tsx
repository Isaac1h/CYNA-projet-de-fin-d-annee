import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getCategories, getCategoryById, getProductsByCategory } from '@/lib/data';
import ProductCard from '@/components/ProductCard';

type Params = { id: string };

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const categories = await getCategories();
    return categories.map((category) => ({ id: category.id }));
  } catch (err) {
    console.warn('[category/[id]] generateStaticParams: Supabase unreachable, deferring all routes to ISR.', err);
    return [];
  }
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getTranslations('category');
  const category = await getCategoryById(params.id);
  if (!category) {
    return { title: t('notFoundTitle') };
  }
  return {
    title: `${category.name} — Cyna`,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const t = await getTranslations('category');
  const category = await getCategoryById(params.id);
  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(params.id);
  const productCount = products.length;

  return (
    <div className="bg-background">
      <section
        aria-label={t('presentationSection', { name: category.name })}
        className="relative h-72 overflow-hidden sm:h-80 md:h-96"
      >
        <Image
          src={category.image_url}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/20"
        />
        <div className="relative mx-auto flex h-full max-w-7xl items-end px-4 pb-8 sm:px-6 sm:pb-12 lg:px-8">
          <div className="max-w-2xl">
            <Link
              href="/catalogue"
              className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              {t('backToCatalogue')}
            </Link>
            <h1 className="mb-3 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              {category.name}
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">{category.description}</p>
          </div>
        </div>
      </section>

      <section
        aria-label={t('productsSection', { name: category.name })}
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      >
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            {t('productCount', { count: productCount })}
          </h2>
          <p className="text-sm text-muted-foreground">{t('sortedByPriority')}</p>
        </header>

        {productCount > 0 ? (
          <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h3 className="text-xl font-semibold text-foreground">{t('empty.title')}</h3>
            <p className="mt-2 text-muted-foreground">
              {t('empty.hint')}{' '}
              <Link
                href="/catalogue"
                className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('empty.hintLink')}
              </Link>
              .
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
