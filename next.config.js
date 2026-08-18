/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['web-push'],
  // Permet à l'app Capacitor (chargée depuis l'IP réseau) de se connecter au HMR en dev.
  // Sans ça Next.js bloque le websocket _next/webpack-hmr et le JS crashe côté client.
  allowedDevOrigins: ['192.168.1.189'],
  images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.supabase.co' },
    { protocol: 'https', hostname: 'a.espncdn.com' },
    { protocol: 'https', hostname: '*.googleusercontent.com' },
    { protocol: 'https', hostname: 'placehold.co' },
  ],
  minimumCacheTTL: 86400,
  // Le seul next/image optimisé du site est la vignette de galerie
  // (GalerieClient.tsx, sizes="150px, 220px") — les deviceSizes par défaut de
  // Next commencent à 640px, donc chaque vignette de 150-220px affichée était
  // générée à 640px minimum (3-4x plus de pixels que nécessaire), gonflant à
  // la fois le coût de transformation Vercel et la bande passante pour rien.
  // Paliers resserrés autour du besoin réel (1x/2x/3x des deux tailles),
  // avec 1080/1920 en réserve pour un futur usage plus grand.
  deviceSizes: [150, 220, 300, 440, 660, 1080, 1920],
},
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',       value: 'nosniff' },
          { key: 'X-Frame-Options',               value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy',               value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',            value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security',     value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
