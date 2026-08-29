import * as Sentry from '@sentry/nextjs'

// Desactive si aucun DSN n'est configure (dev local, ou avant que le DSN
// Sentry ne soit ajoute en prod) -- ne bloque jamais le chargement du site.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // browserTracingIntegration capture automatiquement les Core Web Vitals
    // (LCP, CLS, INP, FCP, TTFB) par page vue reelle, sans service ni cout
    // separe -- meme quota gratuit Sentry (5k events/mois) que le reste.
    integrations: [Sentry.browserTracingIntegration()],
    // Le tier gratuit Sentry (5k evenements/mois) suffit au volume actuel du
    // site -- pas de session replay (consommerait le quota bien plus vite).
    debug: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
