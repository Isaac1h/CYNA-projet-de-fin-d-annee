import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { validatePassword, validateEmail } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, X } from 'lucide-react';

const RegisterPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const passwordValidation = validatePassword(password);
  const emailValid = validateEmail(email);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!emailValid) {
      return;
    }

    if (!passwordValidation.isValid) {
      return;
    }

    if (!passwordsMatch) {
      return;
    }

    setLoading(true);

    const result = await register(email, password, fullName);

    setLoading(false);

    if (result.success) {
      navigate('/login');
    }
  };

  return (
    <>
      <Helmet>
        <title>Inscription - Cyna</title>
        <meta name="description" content="Créez votre compte Cyna" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Créer un Compte</h1>
            <p className="text-muted-foreground">Rejoignez Cyna pour des solutions de sécurité d'entreprise</p>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="fullName" className="text-foreground">Nom Complet</Label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                  placeholder="votre@email.com"
                />
                {email && !emailValid && (
                  <p className="text-destructive text-sm mt-1">Veuillez entrer une adresse email valide</p>
                )}
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">Mot de passe</Label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
                {password && (
                  <div className="mt-2 space-y-1">
                    <div className={`flex items-center text-sm ${password.length >= 8 ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {password.length >= 8 ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                      Au moins 8 caractères
                    </div>
                    <div className={`flex items-center text-sm ${/[A-Z]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {/[A-Z]/.test(password) ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                      Une majuscule
                    </div>
                    <div className={`flex items-center text-sm ${/[0-9]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {/[0-9]/.test(password) ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                      Un chiffre
                    </div>
                    <div className={`flex items-center text-sm ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {/[!@#$%^&*(),.?":{}|<>]/.test(password) ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                      Un caractère spécial
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-foreground">Confirmer le mot de passe</Label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full mt-1 px-4 py-2 bg-secondary border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-destructive text-sm mt-1">Les mots de passe ne correspondent pas</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !passwordValidation.isValid || !emailValid || !passwordsMatch}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? 'Création...' : 'Créer un Compte'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
                  Se connecter ici
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterPage;