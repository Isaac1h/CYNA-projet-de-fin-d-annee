/**
 * Données de démonstration pour l'application (Français)
 */

export const demoCategories = [
  {
    id: 'cat-1',
    name: 'SOC',
    description: 'Solutions de Centre des Opérations de Sécurité pour une surveillance complète des menaces et une réponse aux incidents.',
    image_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    created_at: new Date().toISOString()
  },
  {
    id: 'cat-2',
    name: 'EDR',
    description: 'Détection et Réponse aux Endpoints pour une sécurité avancée des terminaux et la détection des menaces.',
    image_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
    created_at: new Date().toISOString()
  },
  {
    id: 'cat-3',
    name: 'XDR',
    description: 'Détection et Réponse Étendues offrant une sécurité unifiée à travers toute votre infrastructure.',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    created_at: new Date().toISOString()
  },
  {
    id: 'cat-4',
    name: 'Intelligence des Menaces',
    description: 'Plateformes avancées de renseignement sur les menaces pour une posture de sécurité proactive.',
    image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    created_at: new Date().toISOString()
  }
];

export const demoProducts = [
  // Produits SOC
  {
    id: 'prod-1',
    name: 'CyberWatch SOC Pro',
    description: 'Plateforme SOC de niveau entreprise avec surveillance 24/7, détection des menaces par IA et réponse automatisée aux incidents. Inclut l\'intégration SIEM, les rapports de conformité et des analystes de sécurité dédiés.',
    price_monthly: 2999,
    price_annual: 29990,
    price_per_user: 99,
    category_id: 'cat-1',
    image_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Déploiement': 'Cloud/Sur site',
      'Utilisateurs': 'Illimité',
      'Stockage': '10TB/mois',
      'Rétention': '1 an',
      'SLA': '99.9% disponibilité',
      'Support': '24/7 Premium'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-2',
    name: 'SecureOps Elite',
    description: 'Solution SOC complète avec analyses avancées, capacités de chasse aux menaces et gestion intégrée des vulnérabilités. Parfait pour les grandes entreprises aux besoins de sécurité complexes.',
    price_monthly: 4999,
    price_annual: 49990,
    price_per_user: 149,
    category_id: 'cat-1',
    image_url: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Déploiement': 'Cloud',
      'Utilisateurs': 'Illimité',
      'Stockage': '50TB/mois',
      'Rétention': '2 ans',
      'SLA': '99.99% disponibilité',
      'Support': '24/7 Équipe dédiée'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-3',
    name: 'SOC Essentiel',
    description: 'Plateforme SOC d\'entrée de gamme pour les PME. Comprend la surveillance de base, les alertes et la gestion des incidents avec une configuration facile et un tableau de bord intuitif.',
    price_monthly: 999,
    price_annual: 9990,
    price_per_user: 49,
    category_id: 'cat-1',
    image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
    stock_status: 'Limité',
    technical_specs: {
      'Déploiement': 'Cloud',
      'Utilisateurs': 'Jusqu\'à 50',
      'Stockage': '1TB/mois',
      'Rétention': '90 jours',
      'SLA': '99.5% disponibilité',
      'Support': 'Heures ouvrables'
    },
    created_at: new Date().toISOString()
  },
  // Produits EDR
  {
    id: 'prod-4',
    name: 'EndpointShield Avancé',
    description: 'EDR de nouvelle génération avec analyse comportementale, détection par apprentissage automatique et remédiation automatisée. Protège contre les menaces zero-day et les menaces persistantes avancées.',
    price_monthly: 1999,
    price_annual: 19990,
    price_per_user: 29,
    category_id: 'cat-2',
    image_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Support OS': 'Windows, Mac, Linux',
      'Déploiement': 'Agent Cloud',
      'Taux de détection': '99.7%',
      'Temps de réponse': '< 1 seconde',
      'Intégration': 'API, SIEM, SOAR',
      'Mises à jour': 'Temps réel'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-5',
    name: 'DefendPoint Entreprise',
    description: 'Solution EDR d\'entreprise avec visibilité complète sur tous les terminaux, investigation avancée et outils de chasse aux menaces. Inclut la protection des appareils mobiles et le contrôle des périphériques USB.',
    price_monthly: 2499,
    price_annual: 24990,
    price_per_user: 39,
    category_id: 'cat-2',
    image_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Support OS': 'Windows, Mac, Linux, iOS, Android',
      'Déploiement': 'Cloud/Hybride',
      'Taux de détection': '99.9%',
      'Temps de réponse': '< 500ms',
      'Intégration': 'Suite API complète',
      'Mises à jour': 'Continu'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-6',
    name: 'EDR Lite',
    description: 'EDR léger pour les PME avec protection essentielle des terminaux, surveillance en temps réel et déploiement simple. Idéal pour les organisations qui débutent leur parcours de sécurité.',
    price_monthly: 799,
    price_annual: 7990,
    price_per_user: 19,
    category_id: 'cat-2',
    image_url: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Support OS': 'Windows, Mac',
      'Déploiement': 'Cloud',
      'Taux de détection': '98.5%',
      'Temps de réponse': '< 2 secondes',
      'Intégration': 'API basique',
      'Mises à jour': 'Quotidien'
    },
    created_at: new Date().toISOString()
  },
  // Produits XDR
  {
    id: 'prod-7',
    name: 'UnifiedDefense XDR',
    description: 'Plateforme XDR complète intégrant la sécurité des terminaux, du réseau, du cloud et des emails. Le moteur de corrélation piloté par l\'IA identifie les modèles d\'attaque sophistiqués à travers toute votre infrastructure.',
    price_monthly: 5999,
    price_annual: 59990,
    price_per_user: 79,
    category_id: 'cat-3',
    image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Couverture': 'Endpoint, Réseau, Cloud, Email',
      'Déploiement': 'Cloud-Natif',
      'Moteur IA': 'ML Avancé',
      'Intégrations': '200+ Outils de sécurité',
      'Automatisation': 'Intégration SOAR complète',
      'Conformité': 'SOC2, ISO27001, GDPR'
    },
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-8',
    name: 'XDR Complet',
    description: 'Solution XDR tout-en-un avec SIEM, SOAR et renseignement sur les menaces intégrés. Offre une visibilité unifiée et une réponse automatisée à travers votre écosystème de sécurité.',
    price_monthly: 7999,
    price_annual: 79990,
    price_per_user: 99,
    category_id: 'cat-3',
    image_url: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Couverture': 'Full Stack',
      'Déploiement': 'Cloud/Hybride',
      'Moteur IA': 'Deep Learning',
      'Intégrations': '500+ Outils',
      'Automatisation': 'Playbooks personnalisés',
      'Conformité': 'Tous standards majeurs'
    },
    created_at: new Date().toISOString()
  },
  // Produits Threat Intelligence
  {
    id: 'prod-10',
    name: 'ThreatPulse Intelligence',
    description: 'Plateforme de renseignement sur les menaces premium avec flux en temps réel de sources mondiales, surveillance du deep web et analyses prédictives.',
    price_monthly: 3999,
    price_annual: 39990,
    price_per_user: 199,
    category_id: 'cat-4',
    image_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800',
    stock_status: 'En Stock',
    technical_specs: {
      'Sources de flux': '1000+ Globales',
      'Fréquence MAJ': 'Temps réel',
      'Indicateurs': 'IOCs, TTPs, Campagnes',
      'Dark Web': 'Couverture complète',
      'Accès API': 'Illimité',
      'Rapports': 'Briefings quotidiens'
    },
    created_at: new Date().toISOString()
  }
];

export const demoCarouselItems = [
  {
    id: 'carousel-1',
    title: 'Solutions de Sécurité Entreprise',
    description: 'Protégez votre organisation avec des plateformes SOC, EDR et XDR de pointe',
    image_url: 'https://images.unsplash.com/photo-1688413399498-e35ed74b554f?w=1920',
    cta_text: 'Explorer les Solutions',
    cta_link: '/catalogue',
    order_index: 1,
    created_at: new Date().toISOString()
  },
  {
    id: 'carousel-2',
    title: 'Intelligence des Menaces Avancée',
    description: 'Gardez une longueur d\'avance sur les cybermenaces avec le renseignement et l\'analyse en temps réel',
    image_url: 'https://images.unsplash.com/photo-1616432427123-f83774aeea96?w=1920',
    cta_text: 'En Savoir Plus',
    cta_link: '/category/cat-4',
    order_index: 2,
    created_at: new Date().toISOString()
  },
  {
    id: 'carousel-3',
    title: 'Opérations de Sécurité 24/7',
    description: 'Surveillance et réponse aux incidents en continu pour une tranquillité d\'esprit totale',
    image_url: 'https://images.unsplash.com/photo-1697638164340-6c5fc558bdf2?w=1920',
    cta_text: 'Commencer',
    cta_link: '/category/cat-1',
    order_index: 3,
    created_at: new Date().toISOString()
  }
];

export const initializeDemoData = () => {
  if (!localStorage.getItem('categories')) {
    localStorage.setItem('categories', JSON.stringify(demoCategories));
  }
  if (!localStorage.getItem('products')) {
    localStorage.setItem('products', JSON.stringify(demoProducts));
  }
  if (!localStorage.getItem('carousel_items')) {
    localStorage.setItem('carousel_items', JSON.stringify(demoCarouselItems));
  }
};

export const getCategories = () => {
  const stored = localStorage.getItem('categories');
  return stored ? JSON.parse(stored) : demoCategories;
};

export const getProducts = () => {
  const stored = localStorage.getItem('products');
  return stored ? JSON.parse(stored) : demoProducts;
};

export const getCarouselItems = () => {
  const stored = localStorage.getItem('carousel_items');
  return stored ? JSON.parse(stored) : demoCarouselItems;
};