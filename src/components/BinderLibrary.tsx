'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false })

interface Binder {
  id: number
  name: string
  subtitle: string | null
  layout: number
  color: string | null
  cover_img: string | null
  page_count: number
  position: number
}

interface Slot {
  page_number: number
  slot_index: number
  card_key: string
  img: string
  nom: string | null
}

const LAYOUTS = [4, 6, 9, 12, 16]
const COLS: Record<number, number> = { 4: 2, 6: 2, 9: 3, 12: 3, 16: 4 }
const BINDER_COLORS = ['#c0392b', '#e2b13c', '#1a1a1a', '#e8dcc4', '#1f3a5f', '#2c2c2c', '#6b2737', '#3d5a3d']
const SHELF_ROW_SIZE = 12
const PAGE_MAX_W = 230
const PAGE_RATIO = 310 / 230 // hauteur / largeur d'une page
const FLIP_MS = 500

function slotKey(page: number, idx: number) { return `${page}:${idx}` }

// Effet feuille plastique : léger reflet diagonal, comme les vraies pochettes brillantes
function PlasticSheen() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
      background: 'linear-gradient(115deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.22) 100%)',
    }} />
  )
}

export default function BinderLibrary({ userId, isOwner, accent, pendingCard, onPlaced, onOpenCard }: {
  userId: string; isOwner: boolean; accent: string
  pendingCard?: PickableCard | null
  onPlaced?: () => void
  onOpenCard?: (img: string) => boolean
}) {
  const [binders, setBinders] = useState<Binder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Binder | null>(null)
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map())
  const [pageIndex, setPageIndex] = useState(0)
  const [pickerTarget, setPickerTarget] = useState<{ page: number; idx: number } | null>(null)
  const [justInserted, setJustInserted] = useState<string | null>(null)
  const [viewerSlot, setViewerSlot] = useState<Slot | null>(null)

  // Formulaire création/édition partagé. null = fermé, 'create' = nouveau, number = id à éditer
  const [formOpen, setFormOpen] = useState<null | 'create' | number>(null)
  const [fName, setFName] = useState('')
  const [fSubtitle, setFSubtitle] = useState('')
  const [fLayout, setFLayout] = useState(9)
  const [fColor, setFColor] = useState(BINDER_COLORS[0])
  const [fCover, setFCover] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [pageW, setPageW] = useState(PAGE_MAX_W)
  const stageRef = useRef<HTMLDivElement>(null)
  const pageH = Math.round(pageW * PAGE_RATIO)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth - 32
      setPageW(Math.max(120, Math.min(PAGE_MAX_W, Math.floor(avail / 2))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selected])

  const [flip, setFlip] = useState<{ dir: 'next' | 'prev'; angle: number; contentPage: number; anim: boolean } | null>(null)
  const dragRef = useRef<{ dir: 'next' | 'prev'; startX: number; active: boolean; angle: number; pointerId: number; el: HTMLElement } | null>(null)
  const spreadRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBinders() }, [userId])

  const loadBinders = async () => {
    const { data } = await supabase.from('binders').select('*').eq('user_id', userId).order('position').order('id')
    setBinders(data || [])
    setLoading(false)
  }

  const openBinder = async (binder: Binder) => {
    setSelected(binder)
    setPageIndex(0)
    const { data } = await supabase.from('binder_slots').select('*').eq('binder_id', binder.id)
    const map = new Map<string, Slot>()
    for (const s of data || []) map.set(slotKey(s.page_number, s.slot_index), s)
    setSlots(map)
  }

  const openCreateForm = () => {
    setFName(''); setFSubtitle(''); setFLayout(9); setFColor(BINDER_COLORS[0]); setFCover(null)
    setFormOpen('create')
  }
  const openEditForm = (b: Binder) => {
    setFName(b.name); setFSubtitle(b.subtitle || ''); setFLayout(b.layout); setFColor(b.color || BINDER_COLORS[0]); setFCover(b.cover_img)
    setFormOpen(b.id)
  }

  const uploadCover = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) { alert('Image trop lourde (max 4 Mo)'); return }
    setUploadingCover(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `binders/${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Erreur upload : ' + error.message); setUploadingCover(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setFCover(data.publicUrl)
    setUploadingCover(false)
  }

  const saveForm = async () => {
    if (!fName.trim()) return
    const payload = { name: fName.trim(), subtitle: fSubtitle.trim() || null, color: fColor, cover_img: fCover }
    if (formOpen === 'create') {
      const { data, error } = await supabase.from('binders').insert({
        user_id: userId, layout: fLayout, position: binders.length, ...payload,
      }).select().single()
      if (error) { alert('Erreur : ' + error.message); return }
      setBinders(prev => [...prev, data])
      setFormOpen(null)
      openBinder(data)
    } else {
      const id = formOpen as number
      const { error } = await supabase.from('binders').update(payload).eq('id', id)
      if (error) { alert('Erreur : ' + error.message); return }
      setBinders(prev => prev.map(b => b.id === id ? { ...b, ...payload } : b))
      setSelected(s => s && s.id === id ? { ...s, ...payload } : s)
      setFormOpen(null)
    }
  }

  const deleteBinder = async (id: number) => {
    if (!confirm('Supprimer définitivement ce classeur et son contenu ?')) return
    await supabase.from('binders').delete().eq('id', id)
    setBinders(prev => prev.filter(b => b.id !== id))
    setSelected(null)
  }

  const placeCard = async (page: number, idx: number, card: PickableCard) => {
    if (!selected) return
    const { error } = await supabase.from('binder_slots').insert({
      binder_id: selected.id, page_number: page, slot_index: idx,
      card_key: card.key, img: card.img, nom: card.nom,
    })
    if (error) { alert('Erreur : ' + error.message); return }
    const k = slotKey(page, idx)
    setSlots(prev => new Map(prev).set(k, { page_number: page, slot_index: idx, card_key: card.key, img: card.img, nom: card.nom }))
    setJustInserted(k)
    setTimeout(() => setJustInserted(null), 550)
    setPickerTarget(null)
  }

  const removeCard = async (page: number, idx: number) => {
    if (!selected) return
    await supabase.from('binder_slots').delete().eq('binder_id', selected.id).eq('page_number', page).eq('slot_index', idx)
    const k = slotKey(page, idx)
    setSlots(prev => { const m = new Map(prev); m.delete(k); return m })
  }

  const addPage = async () => {
    if (!selected) return
    const newCount = selected.page_count + 1
    await supabase.from('binders').update({ page_count: newCount }).eq('id', selected.id)
    setSelected(s => s ? { ...s, page_count: newCount } : s)
    setBinders(prev => prev.map(b => b.id === selected.id ? { ...b, page_count: newCount } : b))
  }

  // Bornes de navigation (page 0 = couverture avant, page_count+1 = couverture arrière)
  const coverBack = selected ? selected.page_count + 1 : 0
  const canNext = selected ? pageIndex < selected.page_count : false
  const canPrev = pageIndex > 0

  const finishFlip = (dir: 'next' | 'prev') => {
    if (!selected) return
    const midAngle = dir === 'next' ? -90 : 90
    const farAngle = dir === 'next' ? -179 : 179
    setFlip({ dir, angle: midAngle, contentPage: dir === 'next' ? pageIndex + 1 : pageIndex, anim: true })
    requestAnimationFrame(() => setFlip(s => s && { ...s, angle: farAngle }))
    setTimeout(() => {
      const newContentPage = dir === 'next' ? pageIndex + 2 : pageIndex - 1
      setFlip({ dir, angle: midAngle, contentPage: newContentPage, anim: false })
      requestAnimationFrame(() => setFlip(s => s && { ...s, angle: 0, anim: true }))
      setTimeout(() => {
        setPageIndex(p => dir === 'next' ? p + 2 : Math.max(0, p - 2))
        setFlip(null)
      }, FLIP_MS / 2)
    }, FLIP_MS / 2)
  }

  const cancelFlip = () => {
    setFlip(s => s && { ...s, angle: 0, anim: true })
    setTimeout(() => setFlip(null), FLIP_MS / 2)
  }

  const clickFlip = (dir: 'next' | 'prev') => {
    if (!selected || flip) return
    if (dir === 'next' && !canNext) return
    if (dir === 'prev' && !canPrev) return
    finishFlip(dir)
  }

  const beginDrag = (dir: 'next' | 'prev') => (e: React.PointerEvent) => {
    if (!selected || flip) return
    if (dir === 'next' && !canNext) return
    if (dir === 'prev' && !canPrev) return
    dragRef.current = { dir, startX: e.clientX, active: false, angle: 0, pointerId: e.pointerId, el: e.currentTarget as HTMLElement }
  }

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.active) {
      if (Math.abs(dx) < 6) return
      d.active = true
      try { d.el.setPointerCapture(d.pointerId) } catch {}
      setFlip({ dir: d.dir, angle: 0, contentPage: d.dir === 'next' ? pageIndex + 1 : pageIndex, anim: false })
    }
    const progress = Math.max(0, Math.min(1, (d.dir === 'next' ? -dx : dx) / pageW))
    d.angle = (d.dir === 'next' ? -90 : 90) * progress
    setFlip(s => s && { ...s, angle: d.angle })
  }

  const endDrag = () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    if (!d.active) return
    if (Math.abs(d.angle) / 90 > 0.3) finishFlip(d.dir)
    else cancelFlip()
  }

  // ── Rendu d'une page : couverture avant/arrière ou grille de pochettes ──
  const renderCover = (kind: 'front' | 'back') => {
    const b = selected!
    const col = b.color || accent
    const small = pageW < 180
    return (
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden' }}>
        {b.cover_img
          ? <img src={b.cover_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: col }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.55))' }} />
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: '13%', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', maxWidth: '92%', background: 'rgba(255,255,255,0.95)', color: '#111', borderRadius: 6, padding: small ? '6px 10px' : '10px 14px', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            <div style={{ fontWeight: 900, fontSize: small ? 13 : 17, lineHeight: 1.15, wordBreak: 'break-word' }}>{b.name}</div>
            {b.subtitle && <div style={{ fontSize: small ? 10 : 12, color: '#666', marginTop: 2 }}>{b.subtitle}</div>}
          </div>
        </div>
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 9, letterSpacing: '0.18em', fontWeight: 700 }}>
          {kind === 'front' ? 'MEMORABILIUS' : ''}
        </div>
        <PlasticSheen />
      </div>
    )
  }

  const renderPage = (num: number) => {
    if (!selected) return null
    if (num === 0 || num === coverBack) return renderCover(num === 0 ? 'front' : 'back')
    return renderPocketGrid(num)
  }

  const renderPocketGrid = (page: number) => {
    if (!selected) return null
    if (page < 1 || page > selected.page_count) return <div style={{ visibility: 'hidden' }} />
    const n = selected.layout
    const cols = COLS[n] || 3
    const small = pageW < 180
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: small ? 4 : 7, height: '100%', paddingTop: small ? 6 : 14 }}>
        {Array.from({ length: n }).map((_, idx) => {
          const k = slotKey(page, idx)
          const slot = slots.get(k)
          if (slot) {
            return (
              <div key={idx} className={`binder-slot-card${justInserted === k ? ' binder-slot-card-enter' : ''}`}
                style={{ aspectRatio: '2.5/3.5', borderRadius: 4, overflow: 'hidden' }}
                onClick={() => { if (!onOpenCard || !onOpenCard(slot.img)) setViewerSlot(slot) }}
                title={slot.nom || ''}
              >
                <img src={slot.img} alt={slot.nom || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }} />
                <PlasticSheen />
                {isOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); removeCard(page, idx) }}
                    title="Retirer du classeur"
                    style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', fontSize: 11, lineHeight: 1,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0,
                    }}
                    className="binder-slot-remove"
                  >✕</button>
                )}
              </div>
            )
          }
          return (
            <div key={idx}
              onClick={async () => {
                if (!isOwner) return
                if (pendingCard) { await placeCard(page, idx, pendingCard); onPlaced?.() }
                else setPickerTarget({ page, idx })
              }}
              style={{
                aspectRatio: '2.5/3.5', borderRadius: 4, background: '#fafafa',
                border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isOwner ? 'pointer' : 'default', color: '#bbb', fontSize: 18,
              }}
            >
              {isOwner ? '+' : ''}
            </div>
          )
        })}
      </div>
    )
  }

  const pageShellStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    width: pageW, height: pageH, background: 'white',
    border: '1px solid #e5e5e5', boxSizing: 'border-box', padding: pageW < 180 ? 8 : 12,
    borderRadius: side === 'left' ? '10px 0 0 10px' : '0 10px 10px 0',
    position: 'relative', overflow: 'hidden',
  })

  // ── Formulaire création / édition (partagé) ──
  const binderForm = formOpen !== null && (
    <div onClick={() => setFormOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>📔 {formOpen === 'create' ? 'Nouveau classeur' : 'Modifier le classeur'}</h3>

        {/* Aperçu couverture */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
          <div style={{ width: 90, height: 122, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: fColor, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {fCover && <img src={fCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.5))' }} />
            <div style={{ position: 'absolute', left: 4, right: 4, bottom: 6, textAlign: 'center' }}>
              <span style={{ display: 'inline-block', maxWidth: '92%', background: 'rgba(255,255,255,0.95)', color: '#111', borderRadius: 4, padding: '3px 5px', fontSize: 9, fontWeight: 900, lineHeight: 1.1, wordBreak: 'break-word' }}>{fName || 'Nom'}</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => coverInputRef.current?.click()} className="btn-main btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}>
              {uploadingCover ? '...' : fCover ? '🖼️ Changer la couverture' : '🖼️ Ajouter une couverture'}
            </button>
            {fCover && (
              <button onClick={() => setFCover(null)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>Retirer l'image</button>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Nom</label>
          <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex : Rookies 2024" autoFocus />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Sous-titre (optionnel)</label>
          <input value={fSubtitle} onChange={e => setFSubtitle(e.target.value)} placeholder="Ex : Panini Prizm" />
        </div>

        {formOpen === 'create' && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Pochettes par page</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {LAYOUTS.map(n => (
                <button key={n} onClick={() => setFLayout(n)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                  border: fLayout === n ? `2px solid ${accent}` : '2px solid #e0e0e0',
                  background: fLayout === n ? accent : 'white', color: fLayout === n ? 'white' : '#333',
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Couleur</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BINDER_COLORS.map(c => (
              <button key={c} onClick={() => setFColor(c)} style={{
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: c,
                border: fColor === c ? `3px solid ${accent}` : '3px solid transparent',
                boxShadow: fColor === c ? 'none' : '0 0 0 1px #ddd',
              }} />
            ))}
          </div>
        </div>

        <button onClick={saveForm} disabled={!fName.trim()} className="btn-main btn-primary">
          {formOpen === 'create' ? 'Créer' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chargement...</p>

  // ── Vue étagère ──
  if (!selected) {
    const items: (Binder | 'new')[] = [...binders]
    if (isOwner) items.push('new')
    const rows: (Binder | 'new')[][] = []
    for (let i = 0; i < items.length; i += SHELF_ROW_SIZE) rows.push(items.slice(i, i + SHELF_ROW_SIZE))
    if (rows.length === 0) rows.push([])
    return (
      <div>
        {pendingCard && (
          <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Choisis un classeur pour ranger « {pendingCard.nom} »</span>
          </div>
        )}
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '22px 16px 8px' }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{
              display: 'flex', alignItems: 'flex-end', gap: 3, paddingBottom: 12,
              borderBottom: '6px solid #ece9e2', marginBottom: 18,
              overflowX: 'auto', WebkitOverflowScrolling: 'touch',
            }}>
              {row.map(b => b === 'new' ? (
                <div key="new" onClick={openCreateForm} title="Nouveau classeur" style={{
                  width: 36, height: 178, cursor: 'pointer', border: '1.5px dashed #d5d0c6', borderRadius: '4px 4px 0 0',
                  background: '#faf9f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: '#b8b2a4', fontSize: 18,
                }}>+</div>
              ) : (
                <div key={b.id} onClick={() => openBinder(b)} title={`${b.name} — ${b.layout} pochettes, ${b.page_count} pages`} style={{
                  width: 36, height: 178, cursor: 'pointer', flexShrink: 0,
                  background: b.color || accent, borderRadius: '4px 4px 0 0',
                  boxShadow: 'inset 3px 0 0 rgba(255,255,255,0.18), inset -3px 0 0 rgba(0,0,0,0.22), 1px 0 3px rgba(0,0,0,0.25)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  transition: 'transform 0.15s', position: 'relative', overflow: 'hidden',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-10px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {b.cover_img && (
                    <div style={{ width: '100%', height: 42, flexShrink: 0, overflow: 'hidden', borderBottom: '1px solid rgba(0,0,0,0.15)' }}>
                      <img src={b.cover_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  {/* étiquette blanche imprimée comme sur les vrais classeurs */}
                  <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 2, margin: '0 3px 12px', padding: '8px 2px', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', maxHeight: 118 }}>
                    <span style={{
                      writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9, fontWeight: 800,
                      color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxHeight: 100, letterSpacing: '0.02em',
                    }}>{b.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {binders.length === 0 && !isOwner && (
          <p style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>Aucun classeur pour l'instant.</p>
        )}

        {binderForm}
      </div>
    )
  }

  // ── Vue classeur ouvert ──
  const flippingLeft = flip?.dir === 'prev'
  const flippingRight = flip?.dir === 'next'
  const shadowOpacity = flip ? Math.min(1, Math.abs(flip.angle) / 90) : 0

  const spreadLabel = () => {
    const L = pageIndex, R = pageIndex + 1
    const part = (num: number) => num === 0 ? 'Couv.' : num === coverBack ? 'Dos' : (num >= 1 && num <= selected.page_count) ? String(num) : ''
    return [part(L), part(R)].filter(Boolean).join(' – ')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setSelected(null)} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
          ← Retour {pendingCard ? 'aux classeurs' : 'à la bibliothèque'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>{selected.name}</span>
          {isOwner && !pendingCard && (
            <>
              <button onClick={() => openEditForm(selected)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✏️ Modifier</button>
              <button onClick={() => deleteBinder(selected.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
            </>
          )}
        </div>
      </div>

      {pendingCard && (
        <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Clique une pochette vide pour ranger « {pendingCard.nom} »</span>
        </div>
      )}

      <div ref={stageRef} style={{ background: 'linear-gradient(180deg, #efefef, #e6e6e6)', borderRadius: 16, padding: '30px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={spreadRef} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerLeave={endDrag}
          style={{ display: 'flex', position: 'relative', perspective: 1800, touchAction: 'pan-y', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.18))' }}>
          <div style={pageShellStyle('left')} onPointerDown={beginDrag('prev')}>
            {renderPage(flippingLeft ? pageIndex - 2 : pageIndex)}
          </div>

          <div style={{ width: 0, position: 'relative', zIndex: 20 }}>
            <div style={{ position: 'absolute', top: -10, bottom: -10, left: -2, width: 4, background: 'linear-gradient(90deg, #bbb, #ddd, #bbb)', borderRadius: 2 }} />
          </div>

          <div style={pageShellStyle('right')} onPointerDown={beginDrag('next')}>
            {renderPage(flippingRight ? pageIndex + 3 : pageIndex + 1)}
          </div>

          {flip && (
            <div style={{
              position: 'absolute', top: 0,
              left: flip.dir === 'next' ? pageW : 0,
              width: pageW, height: pageH,
              transformOrigin: flip.dir === 'next' ? 'left center' : 'right center',
              transform: `rotateY(${flip.angle}deg)`,
              transition: flip.anim ? `transform ${FLIP_MS / 2}ms cubic-bezier(0.45,0.05,0.55,0.95)` : 'none',
              zIndex: 30,
            }}>
              <div style={{ ...pageShellStyle(flip.dir === 'next' ? 'right' : 'left'), width: '100%', height: '100%' }}>
                {renderPage(flip.contentPage)}
                <div style={{
                  position: 'absolute', inset: 0, background: flip.dir === 'next' ? 'linear-gradient(to left, rgba(0,0,0,0.3), transparent 60%)' : 'linear-gradient(to right, rgba(0,0,0,0.3), transparent 60%)',
                  opacity: shadowOpacity, pointerEvents: 'none',
                }} />
              </div>
            </div>
          )}

          {flip && (
            <div style={{
              position: 'absolute', top: 0,
              left: flip.dir === 'next' ? 0 : pageW, width: pageW, height: pageH,
              background: flip.dir === 'next' ? 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.25))' : 'linear-gradient(to left, transparent 60%, rgba(0,0,0,0.25))',
              opacity: shadowOpacity, pointerEvents: 'none', borderRadius: flip.dir === 'next' ? '10px 0 0 10px' : '0 10px 10px 0',
            }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button onClick={() => clickFlip('prev')} disabled={!canPrev || !!flip} className="btn-main btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13, opacity: !canPrev ? 0.4 : 1 }} aria-label="Page précédente">
          ←<span className="binder-nav-label"> Page précédente</span>
        </button>
        <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>{spreadLabel()}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isOwner && pageIndex >= selected.page_count && (
            <button onClick={addPage} className="btn-main btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} aria-label="Ajouter une page">
              +<span className="binder-nav-label"> Ajouter une page</span>
            </button>
          )}
          <button onClick={() => clickFlip('next')} disabled={!canNext || !!flip} className="btn-main btn-primary"
            style={{ padding: '8px 14px', fontSize: 13, opacity: !canNext ? 0.4 : 1 }} aria-label="Page suivante">
            <span className="binder-nav-label">Page suivante </span>→
          </button>
        </div>
      </div>

      {pickerTarget && (
        <CardPicker
          userId={userId}
          excludeKeys={new Set([...slots.values()].map(s => s.card_key))}
          onClose={() => setPickerTarget(null)}
          onSelect={card => placeCard(pickerTarget.page, pickerTarget.idx, card)}
        />
      )}

      {viewerSlot && (
        <Viewer3D
          popup={{
            f: viewerSlot.img, b: viewerSlot.img, n: viewerSlot.nom || '', t: '', y: '',
            br: '', s: '', v: '', num: '', auto: false, rc: false, patch: false, g: 'Raw',
          }}
          accent={accent}
          onClose={() => setViewerSlot(null)}
          getTags={() => null}
        />
      )}

      {binderForm}
    </div>
  )
}
