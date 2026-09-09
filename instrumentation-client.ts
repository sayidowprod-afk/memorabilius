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
    // Bruit classique "extension navigateur modifie le DOM sous le nez de
    // React" (Google Translate, Grammarly, bloqueurs de pub) -- React tente
    // de retirer/deplacer un noeud deja retire par l'extension et leve cette
    // erreur interne (react#11538, tres documente). Constate en masse sur
    // /galerie/:userId avec des dizaines de userId differents et aucune
    // manipulation DOM directe correspondante dans le code -- pas un bug
    // applicatif, juste du bruit qui mangeait le quota gratuit pour rien.
    ignoreErrors: [
      "Cannot read properties of null (reading 'parentNode')",
      "null is not an object (evaluating 'b.parentNode')",
      "can't access property \"parentNode\", b is null",
      "The node to be removed is not a child of this node",
      "Failed to execute 'removeChild' on 'Node'",
      "Failed to execute 'insertBefore' on 'Node'",
    ],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
