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
  // Les photos de cartes ne changent quasiment jamais une fois uploadees :
  // 1 jour de cache forcait Vercel a retransformer (et re-facturer) la meme
  // image chaque jour pour rien. 1 an -> les transformations ne sont payees
  // qu'une fois par image/taille, plus jamais reevaluees a moins d'un nouvel
  // upload (nouvelle URL). C'est le plus gros poste de cout du plan (Image
  // Optimization Transformation + Cache Writes, ~10e/mois).
  minimumCacheTTL: 31536000,
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
      {
        // Isolation cross-origin (nécessaire à SharedArrayBuffer → WASM multi-thread
        // pour onnxruntime-web, voir src/lib/cornerDetectorYolo.ts) UNIQUEMENT sur la
        // page de scan de carte — 'credentialless' plutôt que 'require-corp' pour ne
        // pas exiger un header CORP sur chaque image externe chargée ailleurs sur le
        // site (cartes CSV hébergées sur des domaines tiers variés) : seules les
        // requêtes AVEC identifiants seraient bloquées si elles manquent de CORS,
        // ce qui n'est pas le cas des <img> classiques.
        source: '/galerie/:userId/ajouter',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
      {
        // CardScanner (donc detectCornersYOLO) est aussi utilisé pour re-scanner les
        // coins depuis la page de modification d'une carte.
        source: '/galerie/:userId/editer/:id',
        headers: [
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
