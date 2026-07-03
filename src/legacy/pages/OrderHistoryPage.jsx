import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { FileDown, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const OrderHistoryPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [filterYear, setFilterYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
    setOrders(savedOrders);
  }, [isAuthenticated, navigate]);

  const handleDownloadInvoice = () => {
    toast({
      title: 'Téléchargement de Facture',
      description: 'Le téléchargement de la facture sera bientôt disponible.',
    });
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus !== 'all' && order.status !== filterStatus) return false;
    if (filterYear !== 'all') {
      const orderYear = new Date(order.createdAt).getFullYear().toString();
      if (orderYear !== filterYear) return false;
    }
    return true;
  });

  return (
    <>
      <Helmet>
        <title>Historique des Commandes - Cyna</title>
        <meta name="description" content="Voir votre historique de commandes" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Historique des Commandes</h1>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Filtrer par Année</label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  <option value="all">Toutes les Années</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Filtrer par Statut</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                >
                  <option value="all">Tous les Statuts</option>
                  <option value="Pending">En Attente</option>
                  <option value="Completed">Terminée</option>
                  <option value="Cancelled">Annulée</option>
                </select>
              </div>
            </div>
          </div>

          {/* Orders List */}
          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.orderNumber} className="bg-card border border-border rounded-lg shadow-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{order.orderNumber}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-primary">${order.total.toLocaleString()}</div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'Completed'
                          ? 'bg-green-900/50 text-green-200'
                          : order.status === 'Pending'
                          ? 'bg-yellow-900/50 text-yellow-200'
                          : 'bg-red-900/50 text-red-200'
                      }`}>
                        {order.status === 'Completed' ? 'Terminée' : order.status === 'Pending' ? 'En Attente' : 'Annulée'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 mb-4">
                    <h4 className="font-semibold text-foreground mb-2">Articles :</h4>
                    <ul className="space-y-1">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          {item.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadInvoice}
                      variant="outline"
                      size="sm"
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Télécharger Facture
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg shadow-lg p-12 text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Aucune Commande Pour le Moment</h2>
              <p className="text-muted-foreground mb-6">Commencez vos achats pour voir vos commandes ici</p>
              <Button
                onClick={() => navigate('/catalogue')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Parcourir les Produits
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default OrderHistoryPage;