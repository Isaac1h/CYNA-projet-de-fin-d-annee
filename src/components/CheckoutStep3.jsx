import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CreditCard } from 'lucide-react';

const CheckoutStep3 = ({ onNext, onBack, total }) => {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    setProcessing(false);
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Méthode de Paiement</h3>

        {/* Payment Method Selection */}
        <div className="flex gap-4 mb-6">
          <button
            type="button"
            onClick={() => setPaymentMethod('card')}
            className={`flex-1 p-4 border-2 rounded-lg transition-all duration-300 ${
              paymentMethod === 'card'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-secondary'
            }`}
          >
            <CreditCard className="w-6 h-6 mx-auto mb-2 text-foreground" />
            <p className="text-sm font-medium text-foreground">Carte de Crédit</p>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('paypal')}
            className={`flex-1 p-4 border-2 rounded-lg transition-all duration-300 ${
              paymentMethod === 'paypal'
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50 bg-secondary'
            }`}
          >
            <div className="w-6 h-6 mx-auto mb-2 text-2xl">💳</div>
            <p className="text-sm font-medium text-foreground">PayPal</p>
          </button>
        </div>

        {/* Card Payment Form */}
        {paymentMethod === 'card' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cardNumber" className="text-foreground">Numéro de Carte</Label>
              <input
                id="cardNumber"
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                placeholder="1234 5678 9012 3456"
                maxLength="19"
                required
                className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cardExpiry" className="text-foreground">Date d'Expiration</Label>
                <input
                  id="cardExpiry"
                  type="text"
                  value={cardExpiry}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length >= 2) {
                      value = value.slice(0, 2) + '/' + value.slice(2, 4);
                    }
                    setCardExpiry(value);
                  }}
                  placeholder="MM/YY"
                  maxLength="5"
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div>
                <Label htmlFor="cardCVC" className="text-foreground">CVC</Label>
                <input
                  id="cardCVC"
                  type="text"
                  value={cardCVC}
                  onChange={(e) => setCardCVC(e.target.value.replace(/\D/g, ''))}
                  placeholder="123"
                  maxLength="4"
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* PayPal */}
        {paymentMethod === 'paypal' && (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">Vous serez redirigé vers PayPal pour finaliser votre paiement.</p>
            <div className="text-4xl mb-2">🔒</div>
            <p className="text-sm text-muted-foreground">Traitement de paiement sécurisé</p>
          </div>
        )}

        {/* Order Total */}
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex justify-between items-center text-lg font-bold">
            <span className="text-foreground">Montant Total</span>
            <span className="text-primary">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="flex-1"
          disabled={processing}
        >
          Retour
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={processing}
        >
          {processing ? 'Traitement...' : 'Payer Maintenant'}
        </Button>
      </div>
    </form>
  );
};

export default CheckoutStep3;