import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CheckoutStep4 = ({ orderNumber }) => {
  const navigate = useNavigate();

  return (
    <div className="text-center space-y-6">
      <div className="bg-card border border-border rounded-lg p-8">
        <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">Commande Confirmée !</h2>
        <p className="text-muted-foreground mb-6">
          Merci pour votre achat. Votre commande a été traitée avec succès.
        </p>

        <div className="bg-secondary border border-input rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground mb-1">Numéro de Commande</p>
          <p className="text-2xl font-bold text-primary">{orderNumber}</p>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Un email de confirmation a été envoyé à votre adresse avec les détails de la commande et le reçu.
        </p>

        <div className="flex gap-4">
          <Button
            onClick={() => navigate('/orders')}
            variant="outline"
            className="flex-1"
          >
            Voir la Commande
          </Button>
          <Button
            onClick={() => navigate('/')}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Continuer vos Achats
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutStep4;