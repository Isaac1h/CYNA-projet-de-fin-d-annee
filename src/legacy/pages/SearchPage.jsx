import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getProducts, getCategories } from '@/lib/demoData';
import ProductCard from '@/components/ProductCard';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');

  useEffect(() => {
    setProducts(getProducts());
    setCategories(getCategories());
  }, []);

  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
  }, [searchParams]);

  useEffect(() => {
    filterAndSortProducts();
  }, [searchQuery, products, priceRange, selectedCategories, selectedAvailability, sortBy]);

  const filterAndSortProducts = () => {
    let results = [...products];

    // Text search with fuzzy matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(product => {
        const name = product.name.toLowerCase();
        const description = product.description.toLowerCase();
        const specs = JSON.stringify(product.technical_specs || {}).toLowerCase();

        // Exact match
        if (name.includes(query) || description.includes(query) || specs.includes(query)) {
          return true;
        }

        // Starts with
        if (name.startsWith(query)) {
          return true;
        }

        // Contains (already covered above)
        return false;
      });
    }

    // Price filter
    results = results.filter(product => {
      const price = product.price_monthly || product.price_annual || product.price_per_user || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Category filter
    if (selectedCategories.length > 0) {
      results = results.filter(product => selectedCategories.includes(product.category_id));
    }

    // Availability filter
    if (selectedAvailability.length > 0) {
      results = results.filter(product => selectedAvailability.includes(product.stock_status));
    }

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'price_low':
          return (a.price_monthly || 0) - (b.price_monthly || 0);
        case 'price_high':
          return (b.price_monthly || 0) - (a.price_monthly || 0);
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        default:
          return 0;
      }
    });

    setFilteredProducts(results);
  };

  const handleCategoryToggle = (categoryId) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAvailabilityToggle = (status) => {
    setSelectedAvailability(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ q: searchQuery });
  };

  return (
    <>
      <Helmet>
        <title>Résultats de Recherche - Cyna</title>
        <meta name="description" content="Rechercher des solutions de sécurité" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher des produits..."
                className="w-full pl-12 pr-4 py-3 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground text-lg"
              />
            </div>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg shadow-lg p-6 sticky top-20">
                <h2 className="text-lg font-bold text-foreground mb-4">Filtres</h2>

                {/* Price Range */}
                <div className="mb-6">
                  <Label className="text-foreground mb-2 block">Fourchette de Prix</Label>
                  <Slider
                    value={priceRange}
                    onValueChange={setPriceRange}
                    min={0}
                    max={10000}
                    step={100}
                    className="mb-2"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>${priceRange[0]}</span>
                    <span>${priceRange[1]}</span>
                  </div>
                </div>

                {/* Categories */}
                <div className="mb-6">
                  <Label className="text-foreground mb-2 block">Catégories</Label>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <div key={category.id} className="flex items-center">
                        <Checkbox
                          id={category.id}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={() => handleCategoryToggle(category.id)}
                        />
                        <label
                          htmlFor={category.id}
                          className="ml-2 text-sm text-muted-foreground cursor-pointer"
                        >
                          {category.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <Label className="text-foreground mb-2 block">Disponibilité</Label>
                  <div className="space-y-2">
                    {['En Stock', 'Limité', 'Rupture de Stock'].map(status => (
                      <div key={status} className="flex items-center">
                        <Checkbox
                          id={status}
                          checked={selectedAvailability.includes(status)}
                          onCheckedChange={() => handleAvailabilityToggle(status)}
                        />
                        <label
                          htmlFor={status}
                          className="ml-2 text-sm text-muted-foreground cursor-pointer"
                        >
                          {status}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="lg:col-span-3">
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-foreground">
                  {filteredProducts.length} {filteredProducts.length === 1 ? 'Résultat' : 'Résultats'}
                  {searchQuery && ` pour "${searchQuery}"`}
                </h1>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 bg-card border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                >
                  <option value="relevance">Trier par Pertinence</option>
                  <option value="price_low">Prix : Croissant</option>
                  <option value="price_high">Prix : Décroissant</option>
                  <option value="newest">Plus Récent</option>
                </select>
              </div>

              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-card border border-border rounded-lg shadow-lg">
                  <p className="text-muted-foreground text-lg mb-4">Aucun résultat trouvé</p>
                  <p className="text-muted-foreground/80">Essayez d'ajuster vos filtres ou votre recherche</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SearchPage;