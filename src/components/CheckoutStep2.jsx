import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const CheckoutStep2 = ({ formData, setFormData, onNext, onBack }) => {
  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Informations de Facturation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="fullName" className="text-foreground">Nom Complet</Label>
            <input
              id="fullName"
              type="text"
              value={formData.fullName || ''}
              onChange={(e) => handleChange('fullName', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <input
              id="email"
              type="email"
              value={formData.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="address" className="text-foreground">Adresse</Label>
            <input
              id="address"
              type="text"
              value={formData.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="city" className="text-foreground">Ville</Label>
            <input
              id="city"
              type="text"
              value={formData.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          <div>
            <Label htmlFor="postalCode" className="text-foreground">Code Postal</Label>
            <input
              id="postalCode"
              type="text"
              value={formData.postalCode || ''}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="country" className="text-foreground">Pays</Label>
            <input
              id="country"
              type="text"
              value={formData.country || ''}
              onChange={(e) => handleChange('country', e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="flex-1"
        >
          Retour
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Continuer vers le Paiement
        </Button>
      </div>
    </form>
  );
};

export default CheckoutStep2;