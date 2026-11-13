import type { Metadata } from 'next'

// Page d'essai (parallèles d'une carte) : non référencée, pas dans les menus.
export const metadata: Metadata = { title: 'Essai : parallèles', robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
