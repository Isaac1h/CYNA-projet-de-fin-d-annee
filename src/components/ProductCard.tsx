'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/data';

const getStockStatusColor = (status: string) => {
  switch (status) {
    case 'En Stock':
      return 'bg-green-900/50 text-green-200 border border-green-800';
    case 'Limité':
      return 'bg-yellow-900/50 text-yellow-200 border border-yellow-800';
    case 'Rupture de Stock':
      return 'bg-red-900/50 text-red-200 border border-red-800';
    default:
      return 'bg-secondary text-secondary-foreground';
  }
};

export default function ProductCard({ product }: { product: Product }) {
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
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStockStatusColor(product.stock_status)}`}>
              {product.stock_status}
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
                <span className="text-xs text-muted-foreground">Mensuel</span>
                <span className="text-sm font-semibold text-primary">
                  ${product.price_monthly.toLocaleString()}/mois
                </span>
              </div>
            )}
            {product.price_annual != null && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Annuel</span>
                <span className="text-sm font-semibold text-primary">
                  ${product.price_annual.toLocaleString()}/an
                </span>
              </div>
            )}
          </div>

          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300">
            Voir Détails
          </Button>
        </div>
      </Link>
    </motion.div>
  );
}
