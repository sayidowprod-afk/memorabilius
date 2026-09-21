'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'

interface AdminLink { href: string; icon: string; title: string; desc: string }

const GROUPS: { title: string; links: AdminLink[] }[] = [
  {
    title: 'Modération & stats',
    links: [
      { href: '/admin/stats', icon: '📊', title: 'Statistiques', desc: 'Vue d\'ensemble du site' },
      { href: '/admin/reports', icon: '🚩', title: 'Signalements', desc: 'Contenus signalés par la communauté' },
      { href: '/admin/demo', icon: '🎪', title: 'Mode démo', desc: 'Configuration du mode salon / tablette' },
      { href: '/evenements/admin', icon: '📅', title: 'Événements', desc: 'Gestion des événements' },
      { href: '/admin/guides', icon: '📖', title: 'Guides', desc: 'Rédaction et publication des guides' },
    ],
  },
  {
    title: 'Quiz autographes',
    links: [
      { href: '/admin/autograph-quiz', icon: '✍️', title: 'Curation', desc: 'Valider les cartes candidates au quiz' },
      { href: '/admin/autograph-quiz/presenter', icon: '🎤', title: 'Présentateur', desc: 'Mode live pour l\'émission' },
      { href: '/admin/autograph-quiz/tierlist', icon: '🏆', title: 'Tier list', desc: 'Classement S/A/B/C/D en direct' },
    ],
  },
  {
    title: 'Quiz en direct (podcast)',
    links: [
      { href: '/admin/live-quiz', icon: '🎙️', title: 'Quiz en direct', desc: 'Sessions QCM, QR code, overlay OBS/Streamlabs' },
    ],
  },
  {
    title: 'Revue d\'équipe (émission)',
    links: [
      { href: '/admin/player-sheets', icon: '🏀', title: 'Fiches joueurs', desc: 'Équipe NBA, carte 3D et stats par joueur' },
    ],
  },
]

export default function AdminHubPage() {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data: p }) => setIsAdmin(p?.is_admin ?? false))
  }, [user, loading])

  if (isAdmin === null) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!isAdmin) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Accès réservé aux admins.</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 24 }}>🛠️ Administration</h1>
      {GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 10 }}>
            {group.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {group.links.map(l => (
              <Link key={l.href} href={l.href} style={{
                display: 'block', padding: '16px 18px', borderRadius: 14, border: '1px solid #eee',
                textDecoration: 'none', color: 'inherit', background: 'white', transition: 'border-color 0.15s',
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{l.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{l.title}</div>
                <div style={{ fontSize: 12.5, color: '#888', lineHeight: 1.35 }}>{l.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
