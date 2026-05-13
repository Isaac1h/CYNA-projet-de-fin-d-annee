import React from 'react';
import { useAuth } from '@/context/AuthContext';
import LoginForm from '@/components/LoginForm';
import { Button } from '@/components/ui/button';

const CheckoutStep1 = ({ onNext, guestEmail, setGuestEmail }) => {
  const { isAuthenticated, currentUser } = useAuth();

  const handleContinueAsGuest = () => {
    if (guestEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      onNext();
    }
  };

  if (isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-400 mb-2">Connecté en tant que</h3>
          <p className="text-green-200">{currentUser?.email}</p>
        </div>
        <Button
          onClick={onNext}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Continuer vers la Facturation
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Connectez-vous à votre compte</h3>
        <LoginForm onSuccess={onNext} />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-background text-muted-foreground">Ou</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Continuer en tant qu'invité</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="guest-email" className="block text-sm font-medium text-foreground mb-1">
              Email
            </label>
            <input
              id="guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
              placeholder="votre@email.com"
            />
          </div>
          <Button
            onClick={handleContinueAsGuest}
            disabled={!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)}
            variant="secondary"
            className="w-full"
          >
            Continuer en tant qu'invité
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CheckoutStep1;