'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // onAuthStateChange se déclenche après l'échange PKCE complet
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        router.replace('/profil')
      }
    })

    // Vérification immédiate si la session est déjà disponible
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe()
        router.replace('/profil')
      }
    })

    // Fallback : si toujours rien après 8s, renvoie vers connexion
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      router.replace(data.session ? '/profil' : '/connexion')
    }, 8000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid #003DA6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#666', fontSize: 15 }}>Connexion en cours…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
