'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

// Accès à la marketplace (bêta privée) : true / false, ou null tant que la vérification
// (côté serveur, /api/marketplace/access) n'est pas revenue. Le résultat est gardé pour la
// durée de la session du navigateur, pour ne pas refaire l'appel à chaque page.
const memo = new Map<string, Promise<boolean>>()
const key = (uid: string) => `mp_access_${uid}`

export function useMarketplaceAccess(): boolean | null {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const uid = user ? user.id : user === null ? 'none' : 'loading'

  useEffect(() => {
    if (uid === 'loading') return
    if (uid === 'none') { setAllowed(false); return }
    try {
      const saved = sessionStorage.getItem(key(uid))
      if (saved !== null) { setAllowed(saved === '1'); return }
    } catch { /* stockage indisponible : on interroge le serveur */ }

    let cancelled = false
    let p = memo.get(uid)
    if (!p) {
      p = supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return false
        const res = await fetch('/api/marketplace/access', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const ok = res.ok ? !!(await res.json()).allowed : false
        try { sessionStorage.setItem(key(uid), ok ? '1' : '0') } catch { /* ignore */ }
        return ok
      }).catch(() => { memo.delete(uid); return false })
      memo.set(uid, p)
    }
    p.then(v => { if (!cancelled) setAllowed(v) })
    return () => { cancelled = true }
  }, [uid])

  return allowed
}
