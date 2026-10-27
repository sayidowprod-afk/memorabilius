'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { uploadGuideImage } from '@/lib/guideUpload'
import { generateGuideFromSet, rehostGuideImages, type SetRow } from '@/lib/guideGenerator'
import { renderGuideCover, W, H } from '@/lib/guideCover'

// Generateur de guides par lots : on coche plusieurs sets, chacun devient un guide
// independant (brouillon non publie) avec sa couverture. Meme moteur que l'editeur
// (generateGuideFromSet + GuideCoverMaker), simplement enchaine set par set.
type Status = { step: 'run' | 'ok' | 'skip' | 'err'; msg: string; guideId?: number }

export default function GuidesLotPage() {
  const router = useRouter()
  const { dark } = useTheme()
  const [checking, setChecking] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SetRow[]>([])
  const [picked, setPicked] = useState<Map<number, SetRow>>(new Map())
  const [boxes, setBoxes] = useState<Record<number, string>>({})
  const [status, setStatus] = useState<Record<number, Status>>({})
  const [running, setRunning] = useState(false)
  const boxRefs = useRef<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      setChecking(false)
    })
    return () => { boxRefs.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [router])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('card_sets').select('id, name, year, brand, sport, total_cards')
        .ilike('name', `%${q.replace(/[%_,()]/g, ' ')}%`).order('total_cards', { ascending: false }).limit(30)
      setResults((data || []) as SetRow[])
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const toggle = (s: SetRow) => setPicked(prev => {
    const n = new Map(prev)
    if (n.has(s.id)) n.delete(s.id); else n.set(s.id, s)
    return n
  })

  const setBox = (id: number, file?: File) => {
    if (!file) return
    const u = URL.createObjectURL(file)
    boxRefs.current.push(u)
    setBoxes(b => ({ ...b, [id]: u }))
  }

  const put = (id: number, st: Status) => setStatus(s => ({ ...s, [id]: st }))

  const makeOne = async (set: SetRow) => {
    put(set.id, { step: 'run', msg: 'Lecture de la checklist…' })
    const g = await generateGuideFromSet(set.id)
    const { data: dup } = await supabase.from('guides').select('id').eq('slug', g.slug).maybeSingle()
    if (dup) { put(set.id, { step: 'skip', msg: 'Un guide existe déjà pour ce set', guideId: dup.id }); return }

    put(set.id, { step: 'run', msg: 'Copie des photos…' })
    const blocks = await rehostGuideImages(g.blocks, (d, t) => put(set.id, { step: 'run', msg: `Copie des photos ${d}/${t}…` }))

    // Couverture : cartes variees du guide (une famille ne revient pas cinq fois), boite si fournie.
    put(set.id, { step: 'run', msg: 'Couverture…' })
    const pool: string[] = []
    for (const b of blocks) {
      if (b.type === 'insert_grid') b.cards.forEach(c => { if (c.image) pool.push(c.image) })
      else if (b.type === 'pyramid') b.rows.forEach(r => { if (r.cardImage) pool.push(r.cardImage) })
    }
    const uniq = [...new Set(pool)]
    const step = Math.max(1, Math.floor(uniq.length / 5))
    const cards: string[] = []
    for (let i = 0; i < uniq.length && cards.length < 5; i++) { const u = uniq[(i * step) % uniq.length]; if (!cards.includes(u)) cards.push(u) }

    let cover: string | null = null
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    await renderGuideCover(cv, { name: set.name, boxUrl: boxes[set.id] || null, picked: cards })
    const blob: Blob | null = await new Promise(res => { try { cv.toBlob(b => res(b), 'image/jpeg', 0.92) } catch { res(null) } })
    if (blob) cover = await uploadGuideImage(new File([blob], 'cover.jpg', { type: 'image/jpeg' }), 'covers/')

    put(set.id, { step: 'run', msg: 'Enregistrement…' })
    const now = new Date().toISOString()
    const { data: created, error } = await supabase.from('guides').insert({
      title: g.title, slug: g.slug, excerpt: g.excerpt || null, category: g.category || null,
      cover_image: cover, content: '', blocks, published: false, published_at: now, updated_at: now,
    }).select('id').single()
    if (error) throw new Error(error.message)
    put(set.id, { step: 'ok', msg: `Brouillon créé${cover ? '' : ' (sans couverture : image bloquée)'} · ${g.warnings.length} avertissement(s)`, guideId: created.id })
  }

  const run = async () => {
    setRunning(true)
    for (const set of picked.values()) {
      const s = status[set.id]?.step
      if (s === 'ok' || s === 'skip') continue
      try { await makeOne(set) } catch (e) { put(set.id, { step: 'err', msg: e instanceof Error ? e.message : 'Erreur' }) }
    }
    setRunning(false)
  }

  if (checking) return null
  const border = dark ? '#2a2a2a' : '#dde3ee'
  const card = dark ? '#1e1e1e' : '#fff'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box' }
  const color = (s?: Status) => s?.step === 'ok' ? '#27ae60' : s?.step === 'err' ? '#e74c3c' : s?.step === 'skip' ? '#e67e22' : sub

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#121212' : '#f7f8fa', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', color: text }}>
        <Link href="/admin/guides" style={{ color: sub, fontSize: 13, textDecoration: 'none' }}>← Guides</Link>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: '8px 0 6px' }}>Générer plusieurs guides</h1>
        <p style={{ color: sub, fontSize: 14, margin: '0 0 20px' }}>
          Coche des sets : chacun devient un guide indépendant (brouillon, non publié) avec sa couverture. Tu retrouves ensuite chaque guide dans la liste pour ajouter tirages, odds et visuels, puis le publier.
        </p>

        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Chercher un set : Mosaic 2023, Prizm, Select…" style={inp} autoFocus />
        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {results.map(r => (
              <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: `1px solid ${border}`, background: card, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r)} disabled={running} />
                <span>{r.name} <span style={{ color: sub, fontWeight: 600 }}>· {r.sport.toUpperCase()} · {r.total_cards.toLocaleString('fr-FR')} cartes</span></span>
              </label>
            ))}
          </div>
        )}

        {picked.size > 0 && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 10px' }}>{picked.size} set{picked.size > 1 ? 's' : ''} sélectionné{picked.size > 1 ? 's' : ''}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...picked.values()].map(s => {
                const st = status[s.id]
                return (
                  <div key={s.id} style={{ border: `1px solid ${border}`, background: card, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <b style={{ fontSize: 14 }}>{s.name}</b>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <label style={{ fontSize: 12, color: sub }}>
                          {boxes[s.id] ? '✓ Boîte ajoutée' : 'Photo de la boîte (optionnel) :'}{' '}
                          <input type="file" accept="image/png,image/webp,image/jpeg" disabled={running} onChange={e => setBox(s.id, e.target.files?.[0])} style={{ maxWidth: 190 }} />
                        </label>
                        {!running && !st && <button type="button" onClick={() => toggle(s)} style={{ border: 'none', background: 'transparent', color: sub, cursor: 'pointer', fontSize: 18 }} aria-label="Retirer">×</button>}
                      </div>
                    </div>
                    {st && (
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: color(st) }}>
                        {st.step === 'ok' ? '✓ ' : st.step === 'err' ? '✗ ' : st.step === 'skip' ? '↷ ' : '… '}{st.msg}
                        {st.guideId && <> · <Link href={`/admin/guides/${st.guideId}`} style={{ color: '#003DA6' }}>Ouvrir</Link></>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={run} disabled={running}
              style={{ marginTop: 16, padding: '12px 22px', borderRadius: 8, border: 'none', background: '#003DA6', color: '#fff', fontWeight: 800, fontSize: 15, cursor: running ? 'default' : 'pointer', opacity: running ? 0.6 : 1 }}>
              {running ? 'Génération en cours… ne ferme pas cet onglet' : `✨ Générer ${picked.size} guide${picked.size > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
