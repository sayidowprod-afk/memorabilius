'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface PC {
  id: string
  player_name: string
}

interface Card {
  id: string
  nom: string
  image_recto: string | null
  annee: string
  marque: string
  collection: string
  variation: string
}

interface AvailableCard extends Card {
  owner_id: string
  owner_name: string
  owner_avatar: string | null
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchesPlayer(cardName: string, playerName: string): boolean {
  const cn = normalize(cardName)
  const pn = normalize(playerName)
  return cn.includes(pn) || pn.includes(cn)
}

export default function PCTracker({ userId, isOwner, accent }: { userId: string; isOwner: boolean; accent: string }) {
  const [pcs, setPcs] = useState<PC[]>([])
  const [myCards, setMyCards] = useState<Card[]>([])
  const [available, setAvailable] = useState<AvailableCard[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
  }, [userId])

  async function load() {
    setLoading(true)
    const [{ data: pcData }, { data: cardsData }, { data: availData }] = await Promise.all([
      supabase.from('pc_targets').select('id, player_name').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('cartes_manuelles').select('id, nom, image_recto, annee, marque, collection, variation').eq('user_id', userId).not('image_recto', 'is', null),
      supabase.from('cartes_manuelles')
        .select('id, nom, image_recto, annee, marque, collection, variation, user_id, profiles(display_name, avatar_url)')
        .eq('disponible_vente', true)
        .neq('user_id', userId)
        .not('image_recto', 'is', null),
    ])
    setPcs(pcData || [])
    setMyCards(cardsData || [])
    setAvailable((availData || []).map((c: any) => ({
      id: c.id, nom: c.nom, image_recto: c.image_recto,
      annee: c.annee, marque: c.marque, collection: c.collection, variation: c.variation,
      owner_id: c.user_id,
      owner_name: c.profiles?.display_name || '?',
      owner_avatar: c.profiles?.avatar_url || null,
    })))
    setLoading(false)
  }

  async function addPC() {
    const name = input.trim()
    if (!name) return
    const { data, error } = await supabase.from('pc_targets').insert({ user_id: userId, player_name: name }).select().single()
    if (!error && data) {
      setPcs(prev => [data, ...prev])
      setInput('')
      setExpanded(data.id)
    }
    setAdding(false)
  }

  async function removePC(id: string) {
    await supabase.from('pc_targets').delete().eq('id', id)
    setPcs(prev => prev.filter(p => p.id !== id))
    if (expanded === id) setExpanded(null)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chargement…</div>

  const cardsForPC = (pc: PC) => myCards.filter(c => matchesPlayer(c.nom || '', pc.player_name))
  const availableForPC = (pc: PC) => available.filter(c => matchesPlayer(c.nom || '', pc.player_name))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {isOwner && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {adding ? (
            <>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addPC(); if (e.key === 'Escape') { setAdding(false); setInput('') } }}
                placeholder="Nom du joueur, ex: Joel Embiid"
                autoFocus
                style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: `1.5px solid ${accent}`, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={addPC} style={{ background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Ajouter</button>
              <button onClick={() => { setAdding(false); setInput('') }} style={{ background: 'none', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontSize: 14, color: '#888' }}>Annuler</button>
            </>
          ) : (
            <button onClick={() => setAdding(true)} style={{ background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              + Ajouter un joueur
            </button>
          )}
          {pcs.length > 0 && <span style={{ fontSize: 12, color: '#999' }}>{pcs.length} PC{pcs.length > 1 ? 's' : ''}</span>}
        </div>
      )}

      {pcs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            {isOwner ? 'Aucun PC configuré' : 'Aucun PC public'}
          </div>
          {isOwner && <div style={{ fontSize: 13 }}>Ajoute les joueurs que tu collectionnes pour suivre tes cartes.</div>}
        </div>
      )}

      {pcs.map(pc => {
        const mine = cardsForPC(pc)
        const avail = availableForPC(pc)
        const isOpen = expanded === pc.id

        return (
          <div key={pc.id} style={{ border: '1.5px solid #eee', borderRadius: 14, overflow: 'hidden', transition: '0.15s' }}>
            {/* Header */}
            <div
              onClick={() => setExpanded(isOpen ? null : pc.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', background: isOpen ? '#fafafa' : 'white', gap: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#121212', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pc.player_name}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>
                  {mine.length} carte{mine.length > 1 ? 's' : ''}
                </span>
                {avail.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#e74c3c', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                    🔔 {avail.length} dispo
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isOwner && (
                  <button onClick={e => { e.stopPropagation(); removePC(pc.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: 4, lineHeight: 1 }}
                    title="Supprimer ce PC">✕</button>
                )}
                <span style={{ color: '#ccc', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Contenu dépliable */}
            {isOpen && (
              <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Mes cartes */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#999', letterSpacing: 0.5, marginBottom: 10 }}>
                    Mes cartes ({mine.length})
                  </div>
                  {mine.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#bbb', fontStyle: 'italic' }}>Aucune carte dans ta collection</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                      {mine.map(c => (
                        <div key={c.id} title={[c.nom, c.annee, c.marque, c.variation].filter(Boolean).join(' · ')}
                          style={{ borderRadius: 8, overflow: 'hidden', background: '#f4f4f4', aspectRatio: '2.5/3.5' }}>
                          <img src={c.image_recto!} alt={c.nom} loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Disponibles chez d'autres */}
                {avail.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#e74c3c', letterSpacing: 0.5, marginBottom: 10 }}>
                      Disponibles chez d'autres ({avail.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {avail.slice(0, 6).map(c => (
                        <a key={c.id} href={`/galerie/${c.owner_id}`} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: '#fff8f8', borderRadius: 10, padding: '8px 12px', border: '1px solid #fde8e8' }}>
                          <div style={{ width: 40, height: 56, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#f0f0f0' }}>
                            <img src={c.image_recto!} alt={c.nom} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#121212', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[c.annee, c.marque, c.collection, c.variation].filter(Boolean).join(' · ') || c.nom}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              {c.owner_avatar
                                ? <img src={c.owner_avatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                                : <div style={{ width: 16, height: 16, borderRadius: '50%', background: accent, fontSize: 8, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{c.owner_name[0]}</div>
                              }
                              <span style={{ fontSize: 12, color: '#888' }}>{c.owner_name}</span>
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: accent, fontWeight: 700, whiteSpace: 'nowrap' }}>Voir →</span>
                        </a>
                      ))}
                      {avail.length > 6 && (
                        <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '4px 0' }}>
                          + {avail.length - 6} autres disponibles
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
