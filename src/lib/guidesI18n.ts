// Traductions pour les pages publiques /guides (composants serveur) — LangContext.tsx
// est marqué 'use client', son objet `translations` ne peut pas être importé
// de façon fiable dans un composant serveur (frontière RSC). On duplique donc ici
// les quelques chaînes nécessaires plutôt que de dépendre du module client.
import type { Lang } from '@/lib/LangContext'

export const guidesI18n: Record<Lang, {
  guides_title: string; guides_subtitle: string; guides_empty: string; guides_back: string
  guides_search_placeholder: string; guides_filter_all: string; guides_no_results: string
}> = {
  fr: {
    guides_title: 'Guides',
    guides_subtitle: 'Conseils, tutoriels et checklists pour les collectionneurs',
    guides_empty: 'Aucun guide pour le moment.',
    guides_back: '← Tous les guides',
    guides_search_placeholder: 'Rechercher un guide…',
    guides_filter_all: 'Tous',
    guides_no_results: 'Aucun guide ne correspond à ta recherche.',
  },
  en: {
    guides_title: 'Guides',
    guides_subtitle: 'Tips, tutorials and checklists for collectors',
    guides_empty: 'No guides yet.',
    guides_back: '← All guides',
    guides_search_placeholder: 'Search guides…',
    guides_filter_all: 'All',
    guides_no_results: 'No guide matches your search.',
  },
  de: {
    guides_title: 'Guides',
    guides_subtitle: 'Tipps, Anleitungen und Checklisten für Sammler',
    guides_empty: 'Noch keine Guides.',
    guides_back: '← Alle Guides',
    guides_search_placeholder: 'Guides durchsuchen…',
    guides_filter_all: 'Alle',
    guides_no_results: 'Kein Guide entspricht deiner Suche.',
  },
  es: {
    guides_title: 'Guías',
    guides_subtitle: 'Consejos, tutoriales y listas de verificación para coleccionistas',
    guides_empty: 'Todavía no hay guías.',
    guides_back: '← Todas las guías',
    guides_search_placeholder: 'Buscar una guía…',
    guides_filter_all: 'Todas',
    guides_no_results: 'Ninguna guía coincide con tu búsqueda.',
  },
  it: {
    guides_title: 'Guide',
    guides_subtitle: 'Consigli, tutorial e checklist per i collezionisti',
    guides_empty: 'Nessuna guida per il momento.',
    guides_back: '← Tutte le guide',
    guides_search_placeholder: 'Cerca una guida…',
    guides_filter_all: 'Tutte',
    guides_no_results: 'Nessuna guida corrisponde alla tua ricerca.',
  },
}
