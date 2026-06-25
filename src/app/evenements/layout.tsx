import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Événements du hobby',
  description: 'Retrouvez tous les prochains événements du hobby de cartes NBA : shows, releases, meetups de collectionneurs.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
