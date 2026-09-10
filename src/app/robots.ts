import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/profil', '/messages', '/connexion', '/sinscrire', '/reset-password',
        // Pages admin -- auth verifiee uniquement cote client (composants
        // 'use client'), le HTML initial servi a un crawler est donc une
        // coquille vide indexable par defaut sans cette regle.
        '/admin', '/evenements/admin',
        // Comptes/reglages personnels, jamais utiles a indexer.
        '/mot-de-passe-oublie', '/parametres', '/moi', '/notifications',
        '/wishlist', '/scanner', '/qr-gen', '/auth/callback', '/confirm',
      ],
    },
    sitemap: 'https://www.memorabilius.fr/sitemap.xml',
  }
}
