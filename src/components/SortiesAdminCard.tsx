'use client'
// Carte de la page Administration : état du calendrier des sorties + bouton « Actualiser maintenant ».
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Info = { count: number; lastUpdate: string | null; next: { name: string; date: string } | null } | 'missing' | null

export default function SortiesAdminCard() {
  const [info, setInfo] = useState<Info>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [{ count, error }, { data: last }, { data: next }] = await Promise.all([
      supabase.from('card_releases').select('*', { count: 'exact', head: true }),
      supabase.from('card_releases').select('updated_at').order('updated_at', { ascending: false }).limit(1),
      supabase.from('card_releases').select('name, release_date').gte('release_date', today).order('release_date').limit(1),
    ])
    if (error) { setInfo('missing'); return }
    setInfo({ count: count ?? 0, lastUpdate: last?.[0]?.updated_at ?? null, next: next?.[0] ? { name: next[0].name, date: next[0].release_date } : null })
  }, [])

  useEffect(() => { const t = window.setTimeout(() => { load() }, 0); return () => window.clearTimeout(t) }, [load])

  const refresh = async () => {
    setBusy(true); setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMsg({ ok: false, text: 'Session expirée : reconnecte-toi.' }); return }
      const res = await fetch('/api/admin/sorties-refresh', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } })
      const d = await res.json().catch(() => ({}))
      if (res.ok) { setMsg({ ok: true, text: `${d.read} sortie${d.read > 1 ? 's' : ''} lue${d.read > 1 ? 's' : ''} et enregistrée${d.read > 1 ? 's' : ''}.` }); await load() }
      else setMsg({ ok: false, text: d.error || `Échec (${res.status}).` })
    } catch { setMsg({ ok: false, text: 'Échec de la connexion, réessaie.' }) }
    finally { setBusy(false) }
  }

  const fmt = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const fmtDay = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  return (
    <div style={{ padding: '16px 18px', borderRadius: 14, border: '1px solid #eee', background: 'white', maxWidth: 520 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>📅 Calendrier des sorties</div>
          <div style={{ fontSize: 12.5, color: '#888', lineHeight: 1.4, marginTop: 3 }}>
            Mis à jour tout seul chaque lundi. Ce bouton relit la source maintenant (par exemple si une date vient de changer).
          </div>
        </div>
        <button type="button" onClick={refresh} disabled={busy || info === 'missing'}
          style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: info === 'missing' ? '#ccc' : '#003DA6', color: 'white', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
          {busy ? 'Actualisation…' : '🔄 Actualiser maintenant'}
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: '#555', lineHeight: 1.5 }}>
        {info === null && 'Chargement de l’état…'}
        {info === 'missing' && <span style={{ color: '#b42318' }}>La table du calendrier n’existe pas encore : lance d’abord la migration « 20261107_sorties_produits » dans Supabase.</span>}
        {info && info !== 'missing' && (
          <>
            <div>{info.count} sortie{info.count > 1 ? 's' : ''} enregistrée{info.count > 1 ? 's' : ''}{info.lastUpdate ? ` · dernière mise à jour le ${fmt(info.lastUpdate)}` : ' · jamais mis à jour'}</div>
            {info.next && <div>Prochaine : <b>{info.next.name}</b> ({fmtDay(info.next.date)})</div>}
          </>
        )}
        {msg && <div role="status" style={{ marginTop: 6, fontWeight: 700, color: msg.ok ? '#1f9d55' : '#b42318' }}>{msg.ok ? '✅ ' : '⚠ '}{msg.text}</div>}
      </div>
      <div style={{ marginTop: 8, fontSize: 12.5 }}><Link href="/sorties" style={{ textDecoration: 'underline', color: '#003DA6' }}>Voir la page publique →</Link></div>
    </div>
  )
}
