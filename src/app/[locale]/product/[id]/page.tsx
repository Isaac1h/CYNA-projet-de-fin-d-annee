import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Check, ChevronLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  getCategoryById,
  getProductById,
  getProducts,
  getProductsByCategory,
  type ProductImage,
  type StockStatus,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import ProductPurchase from './ProductPurchase';
import ProductImageCarousel from './ProductImageCarousel';

type Params = { id: string };

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const products = await getProducts();
    return products.map((product) => ({ id: product.id }));
  } catch (err) {
    console.warn('[product/[id]] generateStaticParams: Supabase unreachable, deferring all routes to ISR.', err);
    return [];
  }
}

export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await getTranslations('product');
  const product = await getProductById(params.id);
  if (!product) {
    return { title: t('notFoundTitle') };
  }
  return {
    title: `${product.name} — Cyna`,
    description: product.description,
  };
}

const STOCK_BADGE: Record<StockStatus, string> = {
  'En Stock': 'border-green-800 bg-green-900/50 text-green-200',
  'Limité': 'border-yellow-800 bg-yellow-900/50 text-yellow-200',
  'Rupture de Stock': 'border-red-800 bg-red-900/50 text-red-200',
};

// Enum DB → clé i18n. Le type StockStatus (partagé) reste FR pour ne
// pas casser catalogue/search/panier ; l'affichage local à la page
// produit passe par ce mapping.
const STOCK_LABEL_KEY: Record<StockStatus, 'inStock' | 'limited' | 'outOfStock'> = {
  'En Stock': 'inStock',
  'Limité': 'limited',
  'Rupture de Stock': 'outOfStock',
};

export default async function ProductPage({ params }: { params: Params }) {
  const t = await getTranslations('product');
  const product = await getProductById(params.id);
  if (!product) {
    notFound();
  }

  const [siblings, category] = await Promise.all([
    getProductsByCategory(product.category_id),
    getCategoryById(product.category_id),
  ]);

  const SIMILAR_TARGET = 6;
  const sameCategory = siblings.filter((sibling) => sibling.id !== product.id);
  let similarProducts = sameCategory.slice(0, SIMILAR_TARGET);

  if (similarProducts.length < SIMILAR_TARGET) {
    const allActive = await getProducts();
    const excluded = new Set<string>([product.id, ...similarProducts.map((p) => p.id)]);
    const topup = allActive.filter((p) => !excluded.has(p.id));
    similarProducts = [...similarProducts, ...topup].slice(0, SIMILAR_TARGET);
  }

  const specs = Object.entries(product.technical_specs);

  const gallery: ProductImage[] =
    product.images.length > 0
      ? product.images
      : product.image_url
        ? [{ url: product.image_url, alt: product.name, position: 0 }]
        : [];

  const stockKey = STOCK_LABEL_KEY[product.stock_status];
  const stockLabel = t(`stockLabel.${stockKey}`);

  return (
    <div className="bg-background py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label={t('breadcrumbAria')} className="mb-6">
          <Link
            href={category ? `/category/${category.id}` : '/catalogue'}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {category
              ? t('backToCategory', { category: category.name })
              : t('backToCatalogue')}
          </Link>
        </nav>

        <article className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          <ProductImageCarousel images={gallery} fallbackAlt={product.name} />

          <div className="rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
            <h1 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">{product.name}</h1>

            <p
              className={`mb-6 inline-block rounded-full border px-3 py-1 text-sm font-semibold ${STOCK_BADGE[product.stock_status]}`}
              aria-label={t('availabilityAria', { label: stockLabel })}
            >
              {stockLabel}
            </p>

            <p className="mb-8 text-muted-foreground">{product.description}</p>

            <ProductPurchase product={product} />
          </div>
        </article>

        {specs.length > 0 && (
          <section
            aria-labelledby="product-specs-heading"
            className="mt-12 rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8"
          >
            <h2 id="product-specs-heading" className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
              {t('specsHeading')}
            </h2>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {specs.map(([key, value]) => (
                <div key={key} className="flex items-start gap-3">
                  <Check aria-hidden="true" className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                  <div>
                    <dt className="font-semibold text-foreground">{key}</dt>
                    <dd className="text-muted-foreground">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        )}

        {similarProducts.length > 0 && (
          <section aria-labelledby="similar-products-heading" className="mt-12">
            <h2 id="similar-products-heading" className="mb-6 text-xl font-bold text-foreground sm:text-2xl">
              {t('similarHeading')}
            </h2>
            <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similarProducts.map((sibling) => (
                <li key={sibling.id}>
                  <ProductCard product={sibling} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
