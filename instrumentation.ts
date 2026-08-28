// Initialise Sentry cote serveur (Node) et edge -- appele automatiquement
// par Next au demarrage de chaque runtime. Desactive si aucun DSN n'est
// configure (dev local, ou avant que le DSN Sentry ne soit ajoute en prod).
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      // Le tier gratuit Sentry est limite en volume d'evenements/mois --
      // desactive les logs de debug internes du SDK, inutiles en prod.
      debug: false,
    })
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs')
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
    })
  }
}

export const onRequestError: typeof import('@sentry/nextjs').captureRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
