'use client'
// Générateur de pub : vidéos verticales 9:16 (TikTok, Reels, Shorts), créées sur l'appareil de l'admin — rien n'est envoyé.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import PubGenerator from './PubGenerator'

export default function AdminPubPage() {
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
    <div>
      <Link href="/admin" style={{ display: 'inline-block', margin: '0 0 12px', fontSize: 14, fontWeight: 700, textDecoration: 'none', color: 'inherit' }}>← Administration</Link>
      <PubGenerator />
    </div>
  )
}
