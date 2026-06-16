import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border text-foreground mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Cyna
            </span>
            <p className="mt-4 text-muted-foreground text-sm">
              Votre partenaire de confiance pour les solutions de sécurité d&apos;entreprise.
              Protection des organisations avec des plateformes SOC, EDR, XDR et de renseignement sur les menaces de pointe.
            </p>
          </div>

          <div>
            <span className="text-lg font-semibold text-foreground">Liens Rapides</span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/catalogue" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Catalogue
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Outils
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-lg font-semibold text-foreground">Légal</span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Politique de Confidentialité
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Conditions de Service
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  Contactez-nous
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center">
          <p className="text-muted-foreground text-sm">
            &copy; {currentYear} Cyna. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
