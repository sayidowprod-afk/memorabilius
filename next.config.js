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
