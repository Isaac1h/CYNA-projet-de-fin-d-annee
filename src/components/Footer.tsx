import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// ANO-008 : liens réseaux sociaux retirés. Le CDC III les demande mais
// nous n'avons pas les vraies URLs ; afficher des liens vers `href="#"`
// est trompeur (clic = rien) et pollue les outils a11y/SEO. À
// réintroduire quand les URLs officielles seront fournies ; le bloc
// `<ul aria-label="Réseaux sociaux">` peut être restauré identique
// avec un tableau SOCIAL_LINKS pointant vers les vraies URLs.
//
// i18n LOT 1 Bloc A — libellés externalisés (namespace `footer`).
// Le tagline reste un paragraphe unique — traduit intégralement.

export default function Footer() {
  const t = useTranslations('footer');
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-background border-t border-border text-foreground mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Cyna
            </span>
            <p className="mt-4 text-muted-foreground text-sm">{t('tagline')}</p>
          </div>

          <div>
            <span className="text-lg font-semibold text-foreground">
              {t('quickLinks')}
            </span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkHome')}
                </Link>
              </li>
              <li>
                <Link href="/catalogue" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkCatalogue')}
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkTools')}
                </Link>
              </li>
              <li>
                <Link href="/tools" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkContact')}
                </Link>
              </li>
              <li>
                <Link href="/a-propos" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkAbout')}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-lg font-semibold text-foreground">
              {t('legal')}
            </span>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/mentions-legales" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkMentionsLegales')}
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkConfidentialite')}
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="text-muted-foreground hover:text-primary transition-colors duration-300">
                  {t('linkCgu')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-center text-muted-foreground text-sm sm:text-left">
            {t('copyright', { year: currentYear })}
          </p>
        </div>
      </div>
    </footer>
  );
}
