import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, Link } from 'react-router-dom';
import { Check, ShoppingCart, FileText } from 'lucide-react';
import { getProducts, getCategories } from '@/lib/demoData';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProductCard from '@/components/ProductCard';

const ProductPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { addToCart, isInCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const products = getProducts();
    const foundProduct = products.find(p => p.id === id);
    setProduct(foundProduct);

    if (foundProduct) {
      const similar = products
        .filter(p => p.category_id === foundProduct.category_id && p.id !== foundProduct.id)
        .slice(0, 6);
      setSimilarProducts(similar);
    }

    window.scrollTo(0, 0);
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, selectedPlan, 1);
    }
  };

  const handleRequestDemo = () => {
    toast({
      title: 'Demande de démo reçue',
      description: 'Notre équipe commerciale vous contactera dans les 24 heures.',
    });
  };

  const getPrice = () => {
    if (!product) return 0;
    switch (selectedPlan) {
      case 'monthly':
        return product.price_monthly;
      case 'annual':
        return product.price_annual;
      case 'per_user':
        return product.price_per_user;
      default:
        return product.price_monthly;
    }
  };

  const getPriceLabel = () => {
    switch (selectedPlan) {
      case 'monthly':
        return '/mois';
      case 'annual':
        return '/an';
      case 'per_user':
        return '/utilisateur/mois';
      default:
        return '/mois';
    }
  };

  if (!product) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Produit non trouvé</p>
    </div>;
  }

  const images = [product.image_url];

  return (
    <>
      <Helmet>
        <title>{product.name} - Cyna</title>
        <meta name="description" content={product.description} />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Product Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Image Gallery */}
            <div>
              <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden mb-4">
                <img
                  src={images[currentImageIndex]}
                  alt={product.name}
                  className="w-full h-96 object-cover opacity-90"
                />
              </div>
            </div>

            {/* Product Info */}
            <div className="bg-card rounded-xl shadow-lg border border-border p-8">
              <h1 className="text-3xl font-bold text-foreground mb-4">{product.name}</h1>
              
              <div className="mb-6">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  product.stock_status === 'En Stock'
                    ? 'bg-green-900/50 text-green-200 border border-green-800'
                    : product.stock_status === 'Limité'
                    ? 'bg-yellow-900/50 text-yellow-200 border border-yellow-800'
                    : 'bg-red-900/50 text-red-200 border border-red-800'
                }`}>
                  {product.stock_status}
                </span>
              </div>

              <p className="text-muted-foreground mb-8">{product.description}</p>

              {/* Pricing Tabs */}
              <Tabs value={selectedPlan} onValueChange={setSelectedPlan} className="mb-8">
                <TabsList className="grid w-full grid-cols-3 bg-secondary">
                  <TabsTrigger value="monthly">Mensuel</TabsTrigger>
                  <TabsTrigger value="annual">Annuel</TabsTrigger>
                  <TabsTrigger value="per_user">Par Utilisateur</TabsTrigger>
                </TabsList>
                <TabsContent value="monthly" className="mt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      ${getPrice()?.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">{getPriceLabel()}</div>
                  </div>
                </TabsContent>
                <TabsContent value="annual" className="mt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      ${getPrice()?.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">{getPriceLabel()}</div>
                    <div className="text-sm text-green-400 mt-2">Économisez 17% annuellement</div>
                  </div>
                </TabsContent>
                <TabsContent value="per_user" className="mt-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary mb-2">
                      ${getPrice()?.toLocaleString()}
                    </div>
                    <div className="text-muted-foreground">{getPriceLabel()}</div>
                    <div className="text-sm text-muted-foreground/80 mt-2">Prix flexible pour toute taille d'équipe</div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Action Buttons */}
              <div className="space-y-4">
                <Button
                  onClick={handleAddToCart}
                  disabled={product.stock_status === 'Rupture de Stock'}
                  className={`w-full ${
                    isInCart(product.id)
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-primary hover:bg-primary/90'
                  } text-white text-lg py-6 shadow-lg`}
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {isInCart(product.id) ? 'Dans le Panier' : 'Ajouter au Panier'}
                </Button>
                <Button
                  onClick={handleRequestDemo}
                  variant="outline"
                  className="w-full border-primary text-primary hover:bg-primary/10 text-lg py-6"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Demander une Démo
                </Button>
              </div>
            </div>
          </div>

          {/* Technical Specs */}
          {product.technical_specs && (
            <div className="bg-card rounded-xl shadow-lg border border-border p-8 mb-16">
              <h2 className="text-2xl font-bold text-foreground mb-6">Spécifications Techniques</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(product.technical_specs).map(([key, value]) => (
                  <div key={key} className="flex items-start">
                    <Check className="w-5 h-5 text-primary mr-3 mt-1 flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">{key}</div>
                      <div className="text-muted-foreground">{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar Products */}
          {similarProducts.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-8">Services Similaires</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {similarProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductPage;