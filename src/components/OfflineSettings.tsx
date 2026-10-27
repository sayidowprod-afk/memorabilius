'use client'
import { useEffect, useState } from 'react'
import { useIsNative } from '@/lib/useIsNative'
import { isNativeOfflineEnabled, enableNativeOffline, disableNativeOffline } from '@/lib/offlineMode'

// Réglage du mode hors ligne de l'app native (bêta). Invisible sur le web/PWA,
// où il est toujours actif. Voir lib/offlineMode.ts pour le pourquoi du opt-in.
export default function OfflineSettings() {
  const isNative = useIsNative()
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setOn(isNativeOfflineEnabled()) }, [])

  if (!isNative) return null

  const toggle = async () => {
    setBusy(true); setMsg('')
    try {
      if (on) {
        await disableNativeOffline()
        setOn(false)
        setMsg('Mode hors ligne désactivé. Redémarre l\'app pour finir de le retirer.')
      } else {
        await enableNativeOffline()
        setOn(true)
        setMsg('Activé. Navigue avec du réseau (galerie, classeurs...) : ce que tu ouvres reste consultable sans connexion.')
      }
    } catch {
      setMsg('Impossible de modifier le mode hors ligne sur cet appareil.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, margin: '16px 0', background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>📡 Mode hors ligne <span style={{ fontSize: 11, fontWeight: 800, color: '#e67e22' }}>BÊTA</span></div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Consulter ta collection sans connexion (mode avion). Lecture seule.
          </div>
        </div>
        <button type="button" onClick={toggle} disabled={busy} aria-pressed={on}
          style={{
            flexShrink: 0, minWidth: 84, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer',
            fontWeight: 800, fontSize: 13, color: '#fff', background: on ? '#27ae60' : '#7f8c8d', opacity: busy ? 0.6 : 1,
          }}>
          {on ? 'Activé' : 'Désactivé'}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10 }}>{msg}</div>}
    </div>
  )
}
