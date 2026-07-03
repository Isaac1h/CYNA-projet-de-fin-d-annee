import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import { getCategories, getProducts } from '@/lib/demoData';
import ProductCard from '@/components/ProductCard';

const CategoryPage = () => {
  const { id } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [sortBy, setSortBy] = useState('priority');

  useEffect(() => {
    const categories = getCategories();
    const foundCategory = categories.find(c => c.id === id);
    setCategory(foundCategory);

    const allProducts = getProducts();
    let filtered = allProducts.filter(p => p.category_id === id);
    
    // Sort products
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        // Priority: In Stock > Limited > Out of Stock
        const statusOrder = { 'En Stock': 0, 'Limité': 1, 'Rupture de Stock': 2 };
        return statusOrder[a.stock_status] - statusOrder[b.stock_status];
      }
      return 0;
    });

    setProducts(filtered);
  }, [id, sortBy]);

  if (!category) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Catégorie non trouvée</p>
    </div>;
  }

  return (
    <>
      <Helmet>
        <title>{category.name} - Cyna</title>
        <meta name="description" content={category.description} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Category Header */}
        <div className="relative h-80 overflow-hidden">
          <img
            src={category.image_url}
            alt={category.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <h1 className="text-5xl font-bold text-foreground mb-4">{category.name}</h1>
              <p className="text-xl text-muted-foreground max-w-2xl">{category.description}</p>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">
              {products.length} {products.length === 1 ? 'Produit' : 'Produits'}
            </h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            >
              <option value="priority">Trier par Disponibilité</option>
            </select>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Aucun produit disponible dans cette catégorie.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CategoryPage;