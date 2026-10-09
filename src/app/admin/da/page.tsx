'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import DaIdeas from './DaIdeas'

// Page de travail reservee aux admins (idees visuelles pour la nouvelle DA). Remplace l'ancien /design-preview.
export default function AdminDaPage() {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single().then(({ data: p }) => setIsAdmin(p?.is_admin ?? false))
  }, [user, loading])

  if (isAdmin === null) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!isAdmin) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>Accès réservé aux admins.</div>
  return <DaIdeas />
}
