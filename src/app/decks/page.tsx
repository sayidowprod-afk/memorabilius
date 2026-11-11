'use client'
// Mes decks : on colle la liste d'un deck, le site la compare avec la galerie et indique les cartes manquantes.
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { TCG_GAMES } from '@/lib/tcgGames'
import { parseDeck, compareDeck } from '@/lib/tcgDeck'

interface Deck { id: string; nom: string; jeu: string | null; liste: string }
interface Owned { nom: string; quantite: number | null }

export default function DecksPage() {
  const { user } = useAuth()
  const uid = user?.id
  const [decks, setDecks] = useState<Deck[] | null>(null)
  const [owned, setOwned] = useState<Owned[]>([])
  const [nom, setNom] = useState('')
  const [jeu, setJeu] = useState('')
  const [liste, setListe] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!uid) return
    const [d, o] = await Promise.all([
      supabase.from('tcg_decks').select('id, nom, jeu, liste').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('cartes_manuelles').select('nom, quantite').eq('user_id', uid).not('jeu', 'is', null).limit(5000),
    ])
    if (d.error) { setMsg('Cette fonction n’est pas encore disponible (la mise à jour de la base n’est pas appliquée).'); setDecks([]) } else setDecks((d.data || []) as Deck[])
    setOwned(((o.data || []) as Owned[]))
  }, [uid])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!uid || !nom.trim() || !liste.trim()) return
    setMsg('')
    const { error } = await supabase.from('tcg_decks').insert({ user_id: uid, nom: nom.trim().slice(0, 80), jeu: jeu || null, liste: liste.slice(0, 8000) })
    if (error) { setMsg('Enregistrement impossible : ' + error.message); return }
    setNom(''); setListe(''); await load()
  }
  const remove = async (id: string) => {
    if (!window.confirm('Supprimer ce deck ?')) return
    await supabase.from('tcg_decks').delete().eq('id', id)
    await load()
  }

  const rowsOf = useMemo(() => {
    const m = new Map<string, ReturnType<typeof compareDeck>>()
    for (const d of decks || []) m.set(d.id, compareDeck(parseDeck(d.liste), owned))
    return m
  }, [decks, owned])

  const box: React.CSSProperties = { border: '1px solid rgba(128,128,128,0.3)', borderRadius: 12, padding: 14, marginBottom: 14 }
  if (!user) return <main style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}><p>Connecte-toi pour gérer tes decks. <Link href="/connexion">Connexion</Link></p></main>

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 60px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>🃏 Mes decks</h1>
      <p style={{ opacity: 0.8, fontSize: 14 }}>Colle la liste d’un deck (une carte par ligne : « 4 Dracaufeu ex »). Le site la compare avec les cartes à jouer de ta galerie et te dit ce qu’il te manque.</p>

      <div style={box}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du deck" maxLength={80} style={{ flex: '1 1 200px' }} />
          <select value={jeu} onChange={e => setJeu(e.target.value)}>
            <option value="">Jeu (facultatif)</option>
            {TCG_GAMES.map(g => <option key={g.id} value={g.id}>{g.emoji} {g.label}</option>)}
          </select>
        </div>
        <textarea value={liste} onChange={e => setListe(e.target.value)} rows={8} placeholder={'4 Dracaufeu ex\n3 Rare Candy\n1 Lightning Bolt'} style={{ width: '100%', boxSizing: 'border-box' }} />
        <button type="button" onClick={save} disabled={!nom.trim() || !liste.trim()} className="btn-main btn-primary" style={{ marginTop: 8 }}>Enregistrer le deck</button>
        {msg && <p style={{ color: '#c0392b', fontSize: 13 }}>{msg}</p>}
      </div>

      {decks === null && <p>Chargement…</p>}
      {decks?.map(d => {
        const rows = rowsOf.get(d.id) || []
        const totalMissing = rows.reduce((a, r) => a + r.missing, 0)
        const diff = rows.filter(r => r.missing > 0).length
        const missingText = rows.filter(r => r.missing > 0).map(r => `${r.missing} ${r.name}`).join('\n')
        return (
          <div key={d.id} style={box}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16, color: 'inherit', textAlign: 'left' }}>
                {open === d.id ? '▾' : '▸'} {d.nom}
              </button>
              <span style={{ fontWeight: 800, fontSize: 13, color: totalMissing === 0 ? '#1e9e57' : '#c0392b', whiteSpace: 'nowrap' }}>
                {totalMissing === 0 ? 'Deck complet ✓' : `Il te manque ${totalMissing} carte${totalMissing > 1 ? 's' : ''} (${diff} différente${diff > 1 ? 's' : ''})`}
              </span>
            </div>
            {open === d.id && (
              <div style={{ marginTop: 10 }}>
                {rows.map(r => (
                  <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0', borderBottom: '1px solid rgba(128,128,128,0.15)' }}>
                    <span>{r.need} × {r.name}</span>
                    <span style={{ fontWeight: 800, color: r.missing ? '#c0392b' : '#1e9e57' }}>{r.missing ? `manque ${r.missing}` : '✓'}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {totalMissing > 0 && <button type="button" onClick={() => { void navigator.clipboard?.writeText(missingText).catch(() => {}) }} className="btn-main">Copier la liste des manquantes</button>}
                  <button type="button" onClick={() => remove(d.id)} className="btn-main">Supprimer</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
