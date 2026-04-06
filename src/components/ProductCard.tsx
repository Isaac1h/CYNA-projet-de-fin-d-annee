'use client';

import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { Product, StockStatus } from '@/lib/data';

// Le champ `stock_status` en base est déjà en FR (enum côté data layer),
// donc on mappe explicitement FR → clé i18n plutôt que côté DB.
// À plus long terme, si l'enum côté data devient locale-agnostic
// (ex. 'in_stock'), on simplifie ce mapping.
const STATUS_TO_KEY: Record<StockStatus, 'inStock' | 'limited' | 'outOfStock'> = {
  'En Stock': 'inStock',
  Limité: 'limited',
  'Rupture de Stock': 'outOfStock',
};

const STATUS_COLOR: Record<StockStatus, string> = {
  'En Stock': 'bg-green-900/50 text-green-200 border border-green-800',
  Limité: 'bg-yellow-900/50 text-yellow-200 border border-yellow-800',
  'Rupture de Stock': 'bg-red-900/50 text-red-200 border border-red-800',
};

export default function ProductCard({ product }: { product: Product }) {
  const t = useTranslations('productCard');
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR');

  const stockKey = STATUS_TO_KEY[product.stock_status] ?? 'inStock';
  const stockColor = STATUS_COLOR[product.stock_status] ?? 'bg-secondary text-secondary-foreground';

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-xl shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 flex flex-col h-full"
    >
      <Link href={`/product/${product.id}`} className="flex-1 flex flex-col">
        <div className="relative h-48 overflow-hidden bg-secondary">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110 opacity-90 hover:opacity-100"
          />
          <div className="absolute top-3 right-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stockColor}`}>
              {t(`stock.${stockKey}`)}
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col flex-1">
          <h3 className="text-lg font-bold text-card-foreground mb-2 line-clamp-1">
            {product.name}
          </h3>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">
            {product.description}
          </p>

          <div className="space-y-1 mb-4 border-t border-border pt-4">
            {product.price_monthly != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{t('monthly')}</span>
                <span className="text-sm font-semibold text-primary">
                  {t('pricePerMonth', { price: numberFormatter.format(product.price_monthly) })}
                </span>
              </div>
            )}
            {product.price_annual != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{t('annual')}</span>
                <span className="text-sm font-semibold text-primary">
                  {t('pricePerYear', { price: numberFormatter.format(product.price_annual) })}
                </span>
              </div>
            )}
          </div>

          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300">
            {t('viewDetails')}
          </Button>
        </div>
      </Link>
    </motion.div>
  );
}
