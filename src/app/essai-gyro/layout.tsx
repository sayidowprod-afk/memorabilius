import type { Metadata } from 'next'

// Page d'essai (effet d'inclinaison au gyroscope) : non référencée, pas dans les menus.
export const metadata: Metadata = { title: 'Essai : inclinaison', robots: { index: false, follow: false } }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
