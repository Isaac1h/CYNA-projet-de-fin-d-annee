'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useCart, type SubscriptionDuration } from '@/context/CartContext';
import type { Product } from '@/lib/data';

const PRICE_BY_PLAN: Record<SubscriptionDuration, (p: Product) => number> = {
  monthly: (p) => p.price_monthly,
  annual: (p) => p.price_annual,
  per_user: (p) => p.price_per_user,
};

type Props = { product: Product };

export default function ProductPurchase({ product }: Props) {
  const t = useTranslations('product.purchase');
  const locale = useLocale();
  const numberFormatter = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fr-FR');
  const [plan, setPlan] = useState<SubscriptionDuration>('monthly');
  const { addToCart, isInCart } = useCart();
  const { toast } = useToast();

  const isOutOfStock = product.stock_status === 'Rupture de Stock';
  const alreadyInCart = isInCart(product.id);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, plan, 1);
  };

  const handleRequestDemo = () => {
    toast({
      title: t('demoToastTitle'),
      description: t('demoToastDescription'),
    });
  };

  return (
    <div className="space-y-8">
      <Tabs
        value={plan}
        onValueChange={(value) => setPlan(value as SubscriptionDuration)}
        aria-label={t('tabsAria')}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monthly">{t('tabMonthly')}</TabsTrigger>
          <TabsTrigger value="annual">{t('tabAnnual')}</TabsTrigger>
          <TabsTrigger value="per_user">{t('tabPerUser')}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">
            {t('priceMonthly', { price: numberFormatter.format(PRICE_BY_PLAN.monthly(product)) })}
          </p>
          <p className="text-muted-foreground">{t('priceLabelMonthly')}</p>
        </TabsContent>
        <TabsContent value="annual" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">
            {t('priceAnnual', { price: numberFormatter.format(PRICE_BY_PLAN.annual(product)) })}
          </p>
          <p className="text-muted-foreground">{t('priceLabelAnnual')}</p>
          <p className="mt-2 text-sm text-green-400">{t('saveAnnual')}</p>
        </TabsContent>
        <TabsContent value="per_user" className="mt-6 text-center">
          <p className="text-4xl font-bold text-primary">
            {t('pricePerUser', { price: numberFormatter.format(PRICE_BY_PLAN.per_user(product)) })}
          </p>
          <p className="text-muted-foreground">{t('priceLabelPerUser')}</p>
          <p className="mt-2 text-sm text-muted-foreground/80">{t('flexPerUser')}</p>
        </TabsContent>
      </Tabs>

      <div className="space-y-3">
        <Button
          type="button"
          size="lg"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          aria-disabled={isOutOfStock}
          aria-pressed={!isOutOfStock && alreadyInCart}
          className="w-full py-6 text-lg shadow-lg"
        >
          <ShoppingCart aria-hidden="true" className="mr-2 h-5 w-5" />
          {isOutOfStock
            ? t('outOfStockCta')
            : alreadyInCart
              ? t('alreadyInCart')
              : t('subscribe')}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleRequestDemo}
          className="w-full border-primary py-6 text-lg text-primary hover:bg-primary/10"
        >
          <FileText aria-hidden="true" className="mr-2 h-5 w-5" />
          {t('requestDemo')}
        </Button>
      </div>
    </div>
  );
}
