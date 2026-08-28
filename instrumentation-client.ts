import * as Sentry from '@sentry/nextjs'

// Desactive si aucun DSN n'est configure (dev local, ou avant que le DSN
// Sentry ne soit ajoute en prod) -- ne bloque jamais le chargement du site.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // Le tier gratuit Sentry (5k evenements/mois) suffit au volume actuel du
    // site -- pas de session replay (consommerait le quota bien plus vite).
    debug: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
