import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/profil', '/messages', '/connexion', '/sinscrire', '/reset-password'],
    },
    sitemap: 'https://www.memorabilius.fr/sitemap.xml',
  }
}
