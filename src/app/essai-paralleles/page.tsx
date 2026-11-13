'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Viewer3D from '@/components/Viewer3D'
import { toViewerCard } from '@/lib/viewerCard'

// ESSAI : la section « Parallèles » telle qu'elle sera dans le VRAI viewer 3D (même composant que la galerie).
// 1) « Activer » la section sur cet appareil  2) choisis une de tes cartes : elle s'ouvre dans le viewer, la section est sous les étiquettes.
// Tes cartes en couleur avec ✓, celles qui te manquent avec la photo de la communauté (comme les setlists), et la progression Rainbow. Rien n'est écrit.
type ViewerCard = React.ComponentProps<typeof Viewer3D>['popup']
type Row = Record<string, unknown> & { id: string; nom: string; image_recto: string | null; image_recto_thumb: string | null }


export default function EssaiParalleles() {
  const [uid, setUid] = useState<string | null | undefined>(undefined)
  const [on, setOn] = useState(false)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [open, setOpen] = useState<ViewerCard | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id || null))
    try { setOn(localStorage.getItem('viewer-paralleles') === '1') } catch { /* stockage indisponible */ }
  }, [])
  const toggle = () => { const v = !on; setOn(v); try { localStorage.setItem('viewer-paralleles', v ? '1' : '0') } catch { /* stockage indisponible */ } }

  useEffect(() => {
    if (!uid) return
    const t = setTimeout(async () => {
      let qb = supabase.from('cartes_manuelles').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30)
      if (q.trim().length >= 2) qb = qb.ilike('nom', '%' + q.trim().replace(/[%,()]/g, ' ') + '%')
      const { data } = await qb
      setRows((data || []) as Row[])
    }, 250)
    return () => clearTimeout(t)
  }, [uid, q])

  return (
    <div style={{ minHeight: '100vh', background: '#050912', color: '#fff', font: '14px system-ui', padding: '20px 16px 70px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Essai : les parallèles dans le viewer 3D</h1>
      <p style={{ margin: 0, maxWidth: 560, color: '#aab3d1', fontSize: 13, lineHeight: 1.5, textAlign: 'center' }}>
        Ouvre une de tes cartes dans le vrai viewer : sous ses étiquettes, la section « Parallèles » liste toutes ses déclinaisons. Les tiennes en couleur avec ✓, celles qui te manquent avec la photo de la communauté, grisée.
      </p>
      {uid === null && <div style={{ border: '2px solid #243063', background: '#0e1530', padding: 12 }}>Connecte-toi pour essayer (la page lit tes cartes).</div>}
      {uid && (
        <div style={{ width: 'min(94vw, 600px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button type="button" onClick={toggle} aria-pressed={on} style={{ padding: 12, border: '2px solid ' + (on ? '#1e9e57' : '#fff'), background: on ? '#1e9e57' : 'transparent', color: '#fff', font: '800 13px system-ui', letterSpacing: '.05em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {on ? '✓ Section « Parallèles » activée dans le viewer (sur cet appareil)' : 'Activer la section « Parallèles » dans le viewer'}
          </button>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher dans mes cartes (ex : Maxey)" style={{ background: '#17214a', border: '2px solid #243063', color: '#fff', padding: '10px 12px', fontSize: 16, outline: 'none' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 8 }}>
            {rows.map(r => (
              <button key={r.id} type="button" onClick={() => setOpen(toViewerCard(r))} style={{ background: 'none', border: '2px solid #243063', padding: 3, cursor: 'pointer', color: '#fff', textAlign: 'left' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.image_recto_thumb || r.image_recto ? <img src={(r.image_recto_thumb || r.image_recto) as string} alt="" style={{ width: '100%', aspectRatio: '5 / 7', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '5 / 7', background: '#17214a' }} />}
                <div style={{ font: '700 9px system-ui', marginTop: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{r.nom as string}</div>
                <div style={{ font: '400 9px system-ui', color: '#aab3d1', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{[r.annee, r.collection, r.variation].filter(Boolean).join(' · ') as string}</div>
              </button>
            ))}
            {rows.length === 0 && <span style={{ color: '#7f8aa8' }}>Aucune carte trouvée.</span>}
          </div>
        </div>
      )}
      {open && uid && (
        <Viewer3D popup={open} accent="#003DA6" onClose={() => setOpen(null)} getTags={() => null} userId={uid} currentUserId={uid} isOwner />
      )}
    </div>
  )
}
