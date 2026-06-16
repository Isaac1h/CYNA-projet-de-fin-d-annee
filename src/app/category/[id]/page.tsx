import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getCategories, getCategoryById, getProductsByCategory } from '@/lib/data';
import ProductCard from '@/components/ProductCard';

type Params = { id: string };

/**
 * Pre-render one route per known category id. With the demoData stub the set
 * is closed (4 ids). When Supabase lands, categories will be added by admins
 * at runtime — flip `dynamicParams` to `true` and add an ISR `revalidate` so
 * new categories appear without a redeploy.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const categories = await getCategories();
  return categories.map((category) => ({ id: category.id }));
}

// TODO(supabase): flip to `true` and add `revalidate` when categories become
// dynamic. Until then any non-pre-rendered id returns 404 automatically.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const category = await getCategoryById(params.id);
  if (!category) {
    return { title: 'Catégorie introuvable — Cyna' };
  }
  return {
    title: `${category.name} — Cyna`,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const category = await getCategoryById(params.id);
  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(params.id);
  const productCount = products.length;
  const productLabel = productCount === 1 ? 'produit disponible' : 'produits disponibles';

  return (
    <div className="bg-background">
      <section
        aria-label={`Présentation de la catégorie ${category.name}`}
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
              Retour au catalogue
            </Link>
            <h1 className="mb-3 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              {category.name}
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">{category.description}</p>
          </div>
        </div>
      </section>

      <section
        aria-label={`Produits de la catégorie ${category.name}`}
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8"
      >
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-2xl font-bold text-foreground">
            {productCount} {productLabel}
          </h2>
          <p className="text-sm text-muted-foreground">
            Triés par priorité puis disponibilité
          </p>
        </header>

        {productCount > 0 ? (
          <ul
            role="list"
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
            <h3 className="text-xl font-semibold text-foreground">
              Aucun produit dans cette catégorie pour le moment
            </h3>
            <p className="mt-2 text-muted-foreground">
              Revenez plus tard ou explorez le{' '}
              <Link
                href="/catalogue"
                className="text-primary underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                catalogue complet
              </Link>
              .
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
