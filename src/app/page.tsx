'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield, Zap, TrendingUp, Users } from 'lucide-react';
import {
  getCarouselItems,
  getCategories,
  getTopProducts,
  type CarouselItem,
  type Category,
  type Product,
} from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [carouselItems, setCarouselItems] = useState<CarouselItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topProducts, setTopProducts] = useState<Product[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    void (async () => {
      const [carousel, cats, products] = await Promise.all([
        getCarouselItems(),
        getCategories(),
        getTopProducts(6),
      ]);
      setCarouselItems(carousel);
      setCategories(cats);
      setTopProducts(products);
    })();
  }, []);

  useEffect(() => {
    if (carouselItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselItems.length]);

  const nextSlide = () =>
    setCurrentSlide((prev) => (prev + 1) % carouselItems.length);
  const prevSlide = () =>
    setCurrentSlide((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);

  return (
    <div className="bg-background text-foreground">
      {/* Hero Carousel */}
      <section className="relative h-screen overflow-hidden" aria-label="Carrousel d'accueil">
        <AnimatePresence mode="wait">
          {carouselItems.length > 0 && (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${carouselItems[currentSlide]?.image_url})` }}
              >
                <div className="w-full h-full bg-gradient-to-r from-background/90 via-background/60 to-transparent flex items-center">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <motion.div
                      initial={{ y: 50, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2, duration: 0.8 }}
                      className="max-w-2xl"
                    >
                      <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                        {carouselItems[currentSlide]?.title}
                      </h1>
                      <p className="text-xl text-muted-foreground mb-8">
                        {carouselItems[currentSlide]?.description}
                      </p>
                      <Link href={carouselItems[currentSlide]?.cta_link || '/catalogue'}>
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-primary/20 transition-all">
                          {carouselItems[currentSlide]?.cta_text || 'Commencer'}
                        </Button>
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {carouselItems.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevSlide}
              aria-label="Slide précédent"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur-sm text-foreground p-3 rounded-full transition-all duration-300 border border-border/20"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="Slide suivant"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-background/20 hover:bg-background/40 backdrop-blur-sm text-foreground p-3 rounded-full transition-all duration-300 border border-border/20"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {carouselItems.length > 1 && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
            {carouselItems.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentSlide(index)}
                aria-label={`Aller au slide ${index + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'bg-primary w-8' : 'bg-muted w-2'
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Company Description */}
      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Partenaire de Sécurité de Confiance
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Cyna fournit des solutions de cybersécurité de pointe pour protéger votre organisation contre les menaces évolutives.
              Notre plateforme complète combine SOC, EDR, XDR et renseignement sur les menaces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center p-6 rounded-xl hover:bg-secondary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">Protection 24/7</h3>
              <p className="text-muted-foreground">Surveillance et réponse aux incidents en continu</p>
            </div>

            <div className="text-center p-6 rounded-xl hover:bg-secondary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">Propulsé par IA</h3>
              <p className="text-muted-foreground">Détection des menaces par apprentissage automatique</p>
            </div>

            <div className="text-center p-6 rounded-xl hover:bg-secondary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">Évolutif</h3>
              <p className="text-muted-foreground">Grandit avec les besoins de votre organisation</p>
            </div>

            <div className="text-center p-6 rounded-xl hover:bg-secondary/20 transition-colors">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">Support Expert</h3>
              <p className="text-muted-foreground">Analystes de sécurité et équipe support dédiés</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-12">Catégories de Sécurité</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/category/${category.id}`} className="group">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="relative h-80 rounded-xl overflow-hidden shadow-lg border border-border group-hover:border-primary/50 transition-colors"
                >
                  <img
                    src={category.image_url}
                    alt={category.name}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent flex items-end">
                    <div className="p-6 w-full">
                      <h3 className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{category.name}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">{category.description}</p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top Products */}
      <section className="py-24 bg-card border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-foreground">Produits Populaires</h2>
            <Link href="/catalogue">
              <Button variant="outline" className="text-primary border-primary hover:bg-primary/10">
                Voir Tout
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {topProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
