import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Setlist NBA',
  description: 'Synchronise ta galerie avec la Setlist NBA complète. Vois exactement quelles cartes tu possèdes et ce qu\'il te manque set par set.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
