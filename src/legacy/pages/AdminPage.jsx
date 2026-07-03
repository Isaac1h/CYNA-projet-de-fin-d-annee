import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getProducts, getCategories, getCarouselItems } from '@/lib/demoData';
import { Plus, Edit, Trash2, TrendingUp, Package } from 'lucide-react';

const AdminPage = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [carouselItems, setCarouselItems] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || currentUser?.email !== 'admin@cyna.com') {
      navigate('/login');
      return;
    }

    setProducts(getProducts());
    setCategories(getCategories());
    setCarouselItems(getCarouselItems());
  }, [isAuthenticated, currentUser, navigate]);

  const handleFeatureClick = (feature) => {
    toast({
      title: '🚧 Cette fonctionnalité n\'est pas encore implémentée—mais ne vous inquiétez pas ! Vous pourrez la demander dans votre prochain prompt ! 🚀',
      description: `La fonctionnalité ${feature} arrive bientôt.`,
    });
  };

  if (!isAuthenticated || currentUser?.email !== 'admin@cyna.com') {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Tableau de Bord Admin - Cyna</title>
        <meta name="description" content="Tableau de bord administrateur" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Tableau de Bord Admin</h1>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-secondary">
              <TabsTrigger value="dashboard">Tableau de Bord</TabsTrigger>
              <TabsTrigger value="products">Produits</TabsTrigger>
              <TabsTrigger value="categories">Catégories</TabsTrigger>
              <TabsTrigger value="carousel">Carrousel</TabsTrigger>
            </TabsList>

            {/* Dashboard */}
            <TabsContent value="dashboard">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Revenu Total</span>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">$0</div>
                  <p className="text-sm text-muted-foreground mt-1">Aucune commande pour le moment</p>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Commandes Totales</span>
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">0</div>
                  <p className="text-sm text-muted-foreground mt-1">Aucune commande pour le moment</p>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Produits</span>
                    <Package className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{products.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">Produits actifs</p>
                </div>

                <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground">Catégories</span>
                    <Package className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="text-3xl font-bold text-foreground">{categories.length}</div>
                  <p className="text-sm text-muted-foreground mt-1">Catégories actives</p>
                </div>
              </div>
            </TabsContent>

            {/* Products */}
            <TabsContent value="products">
              <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">Gestion des Produits</h2>
                  <Button
                    onClick={() => handleFeatureClick('Ajouter Produit')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter Produit
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Nom</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Catégorie</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Prix</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Statut</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {products.slice(0, 5).map(product => {
                        const category = categories.find(c => c.id === product.category_id);
                        return (
                          <tr key={product.id}>
                            <td className="px-6 py-4 text-sm text-foreground">{product.name}</td>
                            <td className="px-6 py-4 text-sm text-muted-foreground">{category?.name}</td>
                            <td className="px-6 py-4 text-sm text-foreground">${product.price_monthly}</td>
                            <td className="px-6 py-4 text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                product.stock_status === 'En Stock'
                                  ? 'bg-green-900/50 text-green-200'
                                  : 'bg-yellow-900/50 text-yellow-200'
                              }`}>
                                {product.stock_status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleFeatureClick('Modifier Produit')}
                                  className="text-blue-500 hover:text-blue-400"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleFeatureClick('Supprimer Produit')}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* Categories */}
            <TabsContent value="categories">
              <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">Gestion des Catégories</h2>
                  <Button
                    onClick={() => handleFeatureClick('Ajouter Catégorie')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter Catégorie
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map(category => (
                    <div key={category.id} className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-foreground">{category.name}</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFeatureClick('Modifier Catégorie')}
                            className="text-blue-500 hover:text-blue-400"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleFeatureClick('Supprimer Catégorie')}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Carousel */}
            <TabsContent value="carousel">
              <div className="bg-card border border-border rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">Gestion du Carrousel</h2>
                  <Button
                    onClick={() => handleFeatureClick('Ajouter Élément Carrousel')}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter Slide
                  </Button>
                </div>

                <div className="space-y-4">
                  {carouselItems.map(item => (
                    <div key={item.id} className="border border-border rounded-lg p-4 bg-card">
                      <div className="flex gap-4">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-32 h-20 object-cover rounded opacity-80"
                        />
                        <div className="flex-1">
                          <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                          <div className="text-xs text-muted-foreground">CTA: {item.cta_text}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleFeatureClick('Modifier Slide')}
                            className="text-blue-500 hover:text-blue-400"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleFeatureClick('Supprimer Slide')}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default AdminPage;