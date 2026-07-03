import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { getCategories } from '@/lib/demoData';
import { motion } from 'framer-motion';

const CataloguePage = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    setCategories(getCategories());
  }, []);

  return (
    <>
      <Helmet>
        <title>Catalogue - Cyna</title>
        <meta name="description" content="Parcourez notre catalogue complet de solutions de sécurité incluant SOC, EDR, XDR et plateformes de renseignement sur les menaces." />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-foreground mb-4">Catalogue des Solutions</h1>
            <p className="text-xl text-muted-foreground">
              Explorez notre gamme complète de solutions de sécurité pour entreprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Link to={`/category/${category.id}`} className="group block h-full">
                  <div className="bg-card border border-border rounded-xl shadow-lg hover:shadow-2xl overflow-hidden transition-all duration-300 h-full flex flex-col">
                    <div className="relative h-64 overflow-hidden">
                      <img
                        src={category.image_url}
                        alt={category.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <h2 className="text-3xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{category.name}</h2>
                      </div>
                    </div>
                    <div className="p-6 flex-1">
                      <p className="text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CataloguePage;