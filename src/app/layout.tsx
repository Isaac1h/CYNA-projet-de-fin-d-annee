import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Cyna — Solutions de Sécurité Entreprise',
  description:
    'Protégez votre organisation avec des plateformes SOC, EDR, XDR et de renseignement sur les menaces.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
