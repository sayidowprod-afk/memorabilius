'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

// Petit ilot client sur la page /guides (composant serveur), visible uniquement des
// admins : seul moyen d'atteindre /admin/guides depuis l'interface, le lien de nav
// "Guides" pointant vers la page publique (accessible a tous).
export default function GuidesAdminBar() {
  const { dark } = useTheme()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      setIsAdmin(!!p?.is_admin)
    })
  }, [])

  if (!isAdmin) return null

  return (
    <Link href="/admin/guides" style={{
      display: 'inline-block', marginBottom: 24, padding: '9px 16px', borderRadius: 8,
      background: dark ? '#1e1e1e' : '#f0f4ff', border: '1px solid #003DA6', color: '#003DA6',
      fontWeight: 700, fontSize: 13, textDecoration: 'none',
    }}>
      ⚙️ Gérer les guides
    </Link>
  )
}
