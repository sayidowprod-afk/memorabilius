'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Entry {
  id: number
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
  owned: boolean
  manually_checked: boolean
  completion_id: string | null
  matched_card_key: string | null
}

interface CardSet {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
}

export default function SetDetailPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params)
  const [set, setSet] = useState<CardSet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all')
  const [saving, setSaving] = useState<number | null>(null)
  const [userCards, setUserCards] = useState<{ player_name: string; year: string; brand: string }[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [])

  useEffect(() => {
    loadSet()
  }, [setId, userId])

  async function loadSet() {
    setLoading(true)

    // Récupérer le set
    const { data: setData } = await supabase
      .from('card_sets')
      .select('*')
      .eq('id', setId)
      .single()

    if (!setData) { setLoading(false); return }
    setSet(setData)

    // Récupérer les entrées du set
    const { data: entriesData } = await supabase
      .from('card_set_entries')
      .select('*')
      .eq('set_id', setId)
      .order('card_number', { ascending: true })

    if (!entriesData) { setLoading(false); return }

    if (!userId) {
      setEntries(entriesData.map(e => ({ ...e, owned: false, manually_checked: false, completion_id: null, matched_card_key: null })))
      setLoading(false)
      return
    }

    // Récupérer les completions de l'utilisateur pour ce set
    const entryIds = entriesData.map(e => e.id)
    const { data: completions } = await supabase
      .from('user_set_completion')
      .select('id, entry_id, manually_checked, matched_card_key')
      .eq('user_id', userId)
      .in('entry_id', entryIds)

    const completionMap = new Map(completions?.map(c => [c.entry_id, c]) || [])

    // Récupérer les cartes de la galerie de l'utilisateur pour le matching
    const { data: galleryCards } = await supabase
      .from('cartes_manuelles')
      .select('player_name, year, brand')
      .eq('user_id', userId)

    setUserCards(galleryCards || [])

    // Normaliser pour matching
    const normalize = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

    const mappedEntries = entriesData.map(e => {
      const comp = completionMap.get(e.id)

      // Auto-match: le joueur + l'année du set correspondent à une carte dans la galerie
      let autoMatch = false
      if (!comp && setData.year) {
        autoMatch = (galleryCards || []).some(gc => {
          const samePlayer = normalize(gc.player_name) === normalize(e.player_name)
          const sameYear = gc.year && (
            gc.year === String(setData.year) ||
            gc.year === `${setData.year - 1}-${String(setData.year).slice(2)}` || // "2023-24"
            gc.year === String(setData.year - 1)
          )
          const sameBrand = !setData.brand || normalize(gc.brand || '') === normalize(setData.brand)
          return samePlayer && sameYear && sameBrand
        })
      }

      return {
        ...e,
        owned: !!comp || autoMatch,
        manually_checked: comp?.manually_checked || false,
        completion_id: comp?.id || null,
        matched_card_key: comp?.matched_card_key || null,
      }
    })

    setEntries(mappedEntries)
    setLoading(false)
  }

  async function toggleOwned(entry: Entry) {
    if (!userId) return
    setSaving(entry.id)

    if (entry.owned && entry.completion_id) {
      // Supprimer
      await supabase.from('user_set_completion').delete().eq('id', entry.completion_id)
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, owned: false, manually_checked: false, completion_id: null } : e))
    } else {
      // Ajouter
      const { data } = await supabase.from('user_set_completion').insert({
        user_id: userId,
        entry_id: entry.id,
        manually_checked: true,
      }).select('id').single()

      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, owned: true, manually_checked: true, completion_id: data?.id || null } : e))
    }

    setSaving(null)
  }

  const filtered = entries.filter(e => {
    if (search && !e.player_name.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'owned' && !e.owned) return false
    if (filter === 'missing' && e.owned) return false
    return true
  })

  const owned = entries.filter(e => e.owned).length
  const pct = set?.total_cards ? Math.round((owned / set.total_cards) * 100) : 0

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
  if (!set) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Set introuvable.</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← Setlist NBA
        </Link>
      </div>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: 16, padding: '24px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>{set.name}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {set.year && <span style={{ fontSize: 13, color: '#888', fontWeight: 700 }}>{set.year}</span>}
          {set.brand && <span style={{ fontSize: 13, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 6, padding: '2px 8px' }}>{set.brand}</span>}
          <span style={{ fontSize: 13, color: '#aaa' }}>{set.total_cards} cartes au total</span>
        </div>

        {/* Barre de progression */}
        {userId && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{owned} / {set.total_cards} cartes possédées</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: pct === 100 ? '#2ecc71' : '#003DA6' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}
        {!userId && (
          <div style={{ fontSize: 13, color: '#888' }}>
            <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>Connectez-vous</Link> pour tracker votre complétion
          </div>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un joueur..."
          style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        {userId && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '10px 16px', border: '1.5px solid', borderColor: filter === f ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: filter === f ? '#003DA6' : 'white', color: filter === f ? 'white' : '#333' }}>
                {f === 'all' ? 'Tout' : f === 'owned' ? '✓ Possédées' : '✗ Manquantes'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info matching */}
      {userId && (
        <div style={{ background: '#f0f4ff', border: '1px solid #d0dbff', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#003DA6' }}>
          <strong>Matching automatique</strong> : les cartes sont cochées si un joueur avec le même set/année existe dans votre galerie.
          Pour les cartes non reconnues, cliquez sur le ✓ pour les cocher manuellement.
        </div>
      )}

      {/* Checklist */}
      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
        {/* Header tableau */}
        <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 120px 140px 40px', gap: 0, padding: '10px 16px', background: '#f8f9fb', borderBottom: '1px solid #eee', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#aaa', letterSpacing: '0.5px' }}>
          <span>#</span>
          <span>Joueur</span>
          <span>Équipe</span>
          <span>Variation</span>
          <span></span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aaa' }}>Aucune carte trouvée</div>
        ) : (
          filtered.map((entry, i) => (
            <div key={entry.id}
              style={{
                display: 'grid', gridTemplateColumns: '50px 1fr 120px 140px 40px', gap: 0,
                padding: '10px 16px', borderBottom: i < filtered.length - 1 ? '1px solid #f5f5f5' : 'none',
                background: entry.owned ? '#f8fff8' : 'white',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}>
              <span style={{ fontSize: 12, color: '#aaa', fontWeight: 700 }}>
                {entry.card_number || '—'}
              </span>
              <div>
                <span style={{ fontSize: 14, fontWeight: entry.owned ? 700 : 500, color: entry.owned ? '#111' : '#444' }}>
                  {entry.player_name}
                </span>
                {entry.is_rc && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px' }}>RC</span>}
                {entry.manually_checked && <span style={{ marginLeft: 4, fontSize: 10, color: '#2ecc71', fontWeight: 700 }}>✓ manuel</span>}
              </div>
              <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.team || '—'}
              </span>
              <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.variation || '—'}
              </span>
              {userId ? (
                <button
                  onClick={() => toggleOwned(entry)}
                  disabled={saving === entry.id}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                    borderColor: entry.owned ? '#2ecc71' : '#ddd',
                    background: entry.owned ? '#2ecc71' : 'white',
                    color: entry.owned ? 'white' : '#ccc',
                    fontWeight: 900, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    opacity: saving === entry.id ? 0.5 : 1,
                  }}>
                  ✓
                </button>
              ) : <span />}
            </div>
          ))
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#aaa' }}>
        {filtered.length} cartes affichées · {entries.length} total
      </div>
    </div>
  )
}
