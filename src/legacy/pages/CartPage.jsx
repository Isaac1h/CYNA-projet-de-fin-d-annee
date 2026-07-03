import React from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

const CartPage = () => {
  const { cartItems, removeFromCart, updateQuantity, updateSubscriptionDuration, getItemPrice, getCartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (cartItems.length === 0) {
    return (
      <>
        <Helmet>
          <title>Panier - Cyna</title>
          <meta name="description" content="Votre panier" />
        </Helmet>

        <div className="min-h-screen bg-background py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <ShoppingBag className="w-24 h-24 text-muted-foreground mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-foreground mb-4">Votre panier est vide</h1>
              <p className="text-muted-foreground mb-8">Commencez à explorer nos solutions de sécurité</p>
              <Link to="/catalogue">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Parcourir les Produits
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Panier - Cyna</title>
        <meta name="description" content="Vérifiez vos solutions de sécurité sélectionnées" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Panier</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map(item => (
                <div key={item.cartId} className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex gap-4">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-24 h-24 object-cover rounded-lg opacity-90"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground mb-2">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.description}</p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Subscription Duration */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Durée</label>
                          <select
                            value={item.subscriptionDuration}
                            onChange={(e) => updateSubscriptionDuration(item.cartId, e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                          >
                            <option value="monthly">Mensuel</option>
                            <option value="annual">Annuel</option>
                            <option value="per_user">Par Utilisateur</option>
                          </select>
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Quantité</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.cartId, parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground text-sm"
                          />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Prix</label>
                          <div className="text-lg font-bold text-primary mt-2">
                            ${(getItemPrice(item) * item.quantity).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-destructive hover:text-destructive/80 p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border rounded-lg shadow-lg p-6 sticky top-20">
                <h2 className="text-xl font-bold text-foreground mb-6">Récapitulatif de la Commande</h2>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span className="font-semibold text-foreground">${getCartTotal().toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span className="text-foreground">Calculées au paiement</span>
                  </div>
                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-foreground">Total</span>
                      <span className="text-primary">${getCartTotal().toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {!isAuthenticated && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
                    <p className="text-sm text-primary mb-2">Connectez-vous pour sauvegarder votre panier</p>
                    <div className="flex gap-2">
                      <Link to="/login" className="flex-1">
                        <Button variant="outline" className="w-full text-sm border-primary text-primary hover:bg-primary/10">Connexion</Button>
                      </Link>
                      <Link to="/register" className="flex-1">
                        <Button variant="outline" className="w-full text-sm border-primary text-primary hover:bg-primary/10">Inscription</Button>
                      </Link>
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mb-4"
                >
                  Procéder au Paiement
                </Button>

                <Link to="/catalogue">
                  <Button variant="outline" className="w-full border-input text-foreground hover:bg-accent">
                    Continuer vos Achats
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CartPage;