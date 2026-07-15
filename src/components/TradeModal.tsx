'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface CardInfo {
  id: string
  nom: string
  annee: string
  marque: string
  image_recto: string | null
  rc: boolean
  auto: boolean
  patch: boolean
  isManuelle: boolean
}

interface TradeModalProps {
  targetCard: { id: string; nom: string; annee: string; marque: string; image_recto?: string }
  targetUserId: string
  targetUserName: string
  onClose: () => void
  onSuccess: () => void
}

function parseCSVCards(csvText: string): CardInfo[] {
  const rows = csvText.split(/\r?\n/).slice(4)
  const cards: CardInfo[] = []
  for (const row of rows) {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    if (!c[0] || !c[0].includes('http')) continue
    const imageUrl = c[0].trim()
    cards.push({
      id: imageUrl,
      nom: (c[2] || '').trim(),
      annee: (c[4] || '').trim(),
      marque: (c[5] || '').trim(),
      image_recto: imageUrl,
      auto: c[9]?.toLowerCase().includes('oui') || false,
      rc: c[10]?.toLowerCase().includes('oui') || false,
      patch: c[11]?.toLowerCase().includes('oui') || false,
      isManuelle: false,
    })
  }
  return cards
}

function CardGrid({
  cards, selected, onToggle, loading, emptyMsg,
}: {
  cards: CardInfo[]
  selected: Set<string>
  onToggle: (id: string) => void
  loading: boolean
  emptyMsg: string
}) {
  if (loading) return <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>Chargement…</div>
  if (cards.length === 0) return <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>{emptyMsg}</div>
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, maxHeight: 180, overflowY: 'auto', padding: 2 }}>
      {cards.map(c => {
        const isSel = selected.has(c.id)
        return (
          <button key={c.id} onClick={() => onToggle(c.id)}
            title={`${c.nom} ${c.annee} ${c.isManuelle ? '' : '(CSV)'}`}
            style={{
              border: isSel ? '2.5px solid #003DA6' : '2px solid transparent',
              borderRadius: 8, background: isSel ? '#e8f0ff' : '#f5f5f5',
              padding: 3, cursor: 'pointer', position: 'relative',
              aspectRatio: '2.5/3.5', overflow: 'hidden',
            }}
          >
            {c.image_recto
              ? <img src={c.image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🃏</div>
            }
            {isSel && (
              <div style={{ position: 'absolute', top: 3, right: 3, background: '#003DA6', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 900 }}>✓</div>
            )}
            {(c.rc || c.auto || c.patch) && (
              <div style={{ position: 'absolute', bottom: 2, left: 2, display: 'flex', gap: 2 }}>
                {c.rc && <span style={{ background: '#003DA6', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>RC</span>}
                {c.auto && <span style={{ background: '#8B0000', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>AU</span>}
                {c.patch && <span style={{ background: '#4a2c00', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>PA</span>}
              </div>
            )}
            {!c.isManuelle && (
              <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 6, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>CSV</div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function TradeModal({ targetCard, targetUserId, targetUserName, onClose, onSuccess }: TradeModalProps) {
  const router = useRouter()

  // Cartes du destinataire — initialisé avec la carte cliquée pour qu'elle soit
  // disponible immédiatement même si le fetch n'est pas encore terminé.
  const [targetCards, setTargetCards] = useState<CardInfo[]>([{
    id: targetCard.id, nom: targetCard.nom, annee: targetCard.annee, marque: targetCard.marque,
    image_recto: targetCard.image_recto || null, rc: false, auto: false, patch: false, isManuelle: true,
  }])
  const [targetSelected, setTargetSelected] = useState<Set<string>>(new Set([targetCard.id]))
  const [targetSearch, setTargetSearch] = useState('')
  const [targetLoading, setTargetLoading] = useState(true)

  // Mes cartes
  const [myCards, setMyCards] = useState<CardInfo[]>([])
  const [mySelected, setMySelected] = useState<Set<string>>(new Set())
  const [mySearch, setMySearch] = useState('')
  const [myLoading, setMyLoading] = useState(true)

  const [filterRC, setFilterRC] = useState(false)
  const [filterAuto, setFilterAuto] = useState(false)
  const [filterPatch, setFilterPatch] = useState(false)

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const fetchTargetCards = useCallback(async () => {
    const [{ data: manuelles }, { data: profile }] = await Promise.all([
      supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, rc, auto, patch')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('lien_csv').eq('id', targetUserId).single(),
    ])
    const manuelCards: CardInfo[] = (manuelles || []).map(c => ({ ...c, isManuelle: true }))
    let csvCards: CardInfo[] = []
    if (profile?.lien_csv) {
      try {
        const res = await fetch(profile.lien_csv + '&t=' + Date.now())
        if (res.ok) csvCards = parseCSVCards(await res.text())
      } catch { }
    }
    setTargetCards([...manuelCards, ...csvCards])
    setTargetLoading(false)
  }, [targetUserId])

  const fetchMyCards = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [{ data: manuelles }, { data: profile }] = await Promise.all([
      supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, rc, auto, patch')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('lien_csv').eq('id', session.user.id).single(),
    ])
    const manuelCards: CardInfo[] = (manuelles || []).map(c => ({ ...c, isManuelle: true }))
    let csvCards: CardInfo[] = []
    if (profile?.lien_csv) {
      try {
        const res = await fetch(profile.lien_csv + '&t=' + Date.now())
        if (res.ok) csvCards = parseCSVCards(await res.text())
      } catch { }
    }
    setMyCards([...manuelCards, ...csvCards])
    setMyLoading(false)
  }, [])

  useEffect(() => { fetchTargetCards(); fetchMyCards() }, [fetchTargetCards, fetchMyCards])

  const toggleTarget = (id: string) => setTargetSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleMy = (id: string) => setMySelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const filteredTarget = targetCards.filter(c => {
    if (!targetSearch.trim()) return true
    const q = targetSearch.toLowerCase()
    return c.nom.toLowerCase().includes(q) || c.annee.includes(q) || c.marque.toLowerCase().includes(q)
  })

  const filteredMy = myCards.filter(c => {
    if (filterRC && !c.rc) return false
    if (filterAuto && !c.auto) return false
    if (filterPatch && !c.patch) return false
    if (mySearch.trim()) {
      const q = mySearch.toLowerCase()
      return c.nom.toLowerCase().includes(q) || c.annee.includes(q) || c.marque.toLowerCase().includes(q)
    }
    return true
  })

  const submit = async () => {
    if (targetSelected.size === 0) { setError('Sélectionne au moins une carte à demander'); return }
    if (mySelected.size === 0) { setError('Sélectionne au moins une carte à offrir'); return }
    setSending(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expirée'); setSending(false); return }

    const requestedCards = [...targetSelected].map(id => {
      const card = targetCards.find(c => c.id === id)
      if (!card) return { id, isManuelle: true }
      return card.isManuelle
        ? { id, isManuelle: true }
        : { id, isManuelle: false, nom: card.nom, annee: card.annee, marque: card.marque, image: card.image_recto }
    })

    const offeredCards = [...mySelected].map(id => {
      const card = myCards.find(c => c.id === id)!
      return card.isManuelle
        ? { id, isManuelle: true }
        : { id, isManuelle: false, nom: card.nom, annee: card.annee, marque: card.marque, image: card.image_recto }
    })

    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ receiverId: targetUserId, offeredCards, requestedCards, message: message.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Erreur'); setSending(false); return }
      onSuccess()
      router.push(`/messages?to=${targetUserId}`)
    } catch {
      setError('Erreur réseau, réessaie')
      setSending(false)
    }
  }

  const FilterBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button onClick={onClick} style={{
      border: active ? 'none' : '1.5px solid #ddd', borderRadius: 20, padding: '5px 12px',
      fontSize: 11, fontWeight: 800, cursor: 'pointer',
      background: active ? '#003DA6' : '#fff', color: active ? '#fff' : '#666',
    }}>{label}</button>
  )

  const sectionLabel = (label: string, count: number) => (
    <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#888' }}>
      {label} <span style={{ color: '#003DA6' }}>({count} sélectionnée{count > 1 ? 's' : ''})</span>
    </div>
  )

  const modal = (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>🔄 Proposer un échange</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* Section : cartes du destinataire */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectionLabel(`Cartes de ${targetUserName} à demander`, targetSelected.size)}
          <input
            type="text" placeholder="Rechercher…" value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            style={{ border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <CardGrid cards={filteredTarget} selected={targetSelected} onToggle={toggleTarget} loading={targetLoading} emptyMsg={`${targetUserName} n'a pas de cartes`} />
        </div>

        <div style={{ height: 1, background: '#f0f0f0' }} />

        {/* Section : mes cartes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sectionLabel('Tes cartes à offrir', mySelected.size)}
          <input
            type="text" placeholder="Rechercher par nom, année, marque…" value={mySearch}
            onChange={e => setMySearch(e.target.value)}
            style={{ border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FilterBtn label="RC" active={filterRC} onClick={() => setFilterRC(v => !v)} />
            <FilterBtn label="Auto" active={filterAuto} onClick={() => setFilterAuto(v => !v)} />
            <FilterBtn label="Patch" active={filterPatch} onClick={() => setFilterPatch(v => !v)} />
            {(filterRC || filterAuto || filterPatch || mySearch) && (
              <button onClick={() => { setFilterRC(false); setFilterAuto(false); setFilterPatch(false); setMySearch('') }}
                style={{ border: 'none', background: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer', padding: '5px 6px' }}>
                Tout effacer
              </button>
            )}
          </div>
          <CardGrid cards={filteredMy} selected={mySelected} onToggle={toggleMy} loading={myLoading} emptyMsg="Ta collection est vide" />
        </div>

        {/* Message */}
        <textarea
          placeholder="Message (optionnel)"
          value={message} onChange={e => setMessage(e.target.value)}
          maxLength={300} rows={2}
          style={{ resize: 'none', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
        />

        {error && <div style={{ color: '#c00', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <button onClick={submit} disabled={sending || targetSelected.size === 0 || mySelected.size === 0}
          style={{
            background: (sending || targetSelected.size === 0 || mySelected.size === 0) ? '#ccc' : '#003DA6',
            color: '#fff', border: 'none', borderRadius: 50, padding: '13px 24px',
            fontWeight: 800, fontSize: 15, cursor: (sending || targetSelected.size === 0 || mySelected.size === 0) ? 'default' : 'pointer',
          }}
        >
          {sending ? 'Envoi…' : `Envoyer l'offre${targetSelected.size > 1 || mySelected.size > 1 ? ` (${targetSelected.size}↔${mySelected.size})` : ''}`}
        </button>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
