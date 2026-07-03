import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';

const MyAccountPage = () => {
  const { currentUser, isAuthenticated, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [email, setEmail] = useState(currentUser?.email || '');

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    await updateProfile({ full_name: fullName, email });
  };

  const handleFeatureClick = () => {
    toast({
      title: '🚧 Cette fonctionnalité n\'est pas encore implémentée—mais ne vous inquiétez pas ! Vous pourrez la demander dans votre prochain prompt ! 🚀',
    });
  };

  return (
    <>
      <Helmet>
        <title>Mon Compte - Cyna</title>
        <meta name="description" content="Gérer les paramètres de votre compte" />
      </Helmet>

      <div className="min-h-screen bg-background py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">Mon Compte</h1>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-secondary">
              <TabsTrigger value="profile">Infos Perso</TabsTrigger>
              <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
              <TabsTrigger value="addresses">Adresses</TabsTrigger>
              <TabsTrigger value="payment">Paiement</TabsTrigger>
              <TabsTrigger value="security">Sécurité</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-foreground mb-6">Informations Personnelles</h2>
                <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-md">
                  <div>
                    <Label htmlFor="fullName" className="text-foreground">Nom Complet</Label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                    />
                  </div>
                  <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Enregistrer les Modifications
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="subscriptions">
              <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-foreground mb-6">Abonnements Actifs</h2>
                <p className="text-muted-foreground">Pas encore d'abonnements actifs.</p>
              </div>
            </TabsContent>

            <TabsContent value="addresses">
              <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-foreground mb-6">Carnet d'Adresses</h2>
                <Button onClick={handleFeatureClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Ajouter une Nouvelle Adresse
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="payment">
              <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-foreground mb-6">Méthodes de Paiement</h2>
                <Button onClick={handleFeatureClick} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Ajouter une Méthode de Paiement
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="security">
              <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                <h2 className="text-xl font-bold text-foreground mb-6">Paramètres de Sécurité</h2>
                <Button onClick={handleFeatureClick} className="bg-primary hover:bg-primary/90 text-primary-foreground mb-4">
                  Changer le Mot de Passe
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default MyAccountPage;