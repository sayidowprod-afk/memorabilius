'use client'
import { useEffect, useState, use, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { playerSlug } from '@/lib/playerSlug'
import { useTheme } from '@/lib/ThemeContext'

const normStr = (s: string) =>
  s?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '') || ''

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
}

interface VariationMeta {
  name: string
  count: number
  owned: number
  loaded: boolean
  entries: Entry[]
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
  const { dark } = useTheme()
  const { setId } = use(params)
  const [set, setSet] = useState<CardSet | null>(null)
  const [variations, setVariations] = useState<VariationMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all')
  const [filterTeam, setFilterTeam] = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [checkingAll, setCheckingAll] = useState<string | null>(null)
  const [openVariations, setOpenVariations] = useState<Set<string>>(new Set(['Base']))
  const [totalOwned, setTotalOwned] = useState(0)
  const [communityImages, setCommunityImages] = useState<Map<number, string>>(new Map())
  const [filterRc, setFilterRc] = useState(false)
  const [mySetCards, setMySetCards] = useState<{ id: string; image: string; nom: string; variation: string }[]>([])
  const [previewCard, setPreviewCard] = useState<{ image: string; nom: string; variation: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const playerToImgRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user?.id || null))
  }, [])

  useEffect(() => { loadSet() }, [setId, userId])

  async function loadSet() {
    setLoading(true)
    const { data: setData } = await supabase.from('card_sets').select('*').eq('id', setId).single()
    if (!setData) { setLoading(false); return }
    setSet(setData)

    // Charger les counts par variation via RPC (évite la limite max_rows)
    const { data: varData } = await supabase.rpc('get_set_variations', { p_set_id: parseInt(setId) })
    if (!varData) { setLoading(false); return }

    const counts = new Map<string, number>()
    for (const row of varData) {
      const v = row.variation ?? 'Base'
      counts.set(v, Number(row.cnt))
    }

    let completedEntryIds = new Set<number>()
    let completionDetails = new Map<number, { id: string; manually_checked: boolean }>()

    if (userId) {
      // Charger les cartes galerie (Supabase + CSV) pour le matching
      type GalleryCard = { id?: string; nom: string; annee: string; marque: string; collection: string; collection_tag: string; variation: string; image_recto?: string | null }
      const { data: gc } = await supabase
        .from('cartes_manuelles')
        .select('id, nom, annee, marque, collection, collection_tag, variation, image_recto')
        .eq('user_id', userId)
      let galleryCards: GalleryCard[] = gc || []

      // CSV optionnel
      const { data: profileData } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
      if (profileData?.lien_csv) {
        try {
          const r = await fetch(profileData.lien_csv + '&t=' + Date.now())
          const text = await r.text()
          galleryCards = [
            ...galleryCards,
            ...text.split(/\r?\n/).slice(4).flatMap(row => {
              const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
              if (!c[0] || !c[0].includes('http')) return []
              return [{ nom: c[2]?.trim() || '', annee: c[4]?.trim() || '', marque: c[5]?.trim() || '', collection: c[6]?.trim() || '', collection_tag: '', variation: c[7]?.trim() || '' }]
            })
          ]
        } catch { /* CSV indisponible */ }
      }

      // Construire playerToImg côté client (évite d'envoyer les images au serveur)
      const pToImg = new Map<string, string>()
      for (const card of galleryCards) {
        if (card.image_recto && !pToImg.has(normStr(card.nom))) {
          pToImg.set(normStr(card.nom), card.image_recto)
        }
      }
      playerToImgRef.current = pToImg

      // Un seul appel API pour completions + auto-matching (images en map compacte, pas dans galleryCards)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        try {
          const res = await fetch('/api/set-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({
              setId: parseInt(setId),
              setYear: setData.year,
              setBrand: setData.brand,
              setName: setData.name,
              // image_recto inclus pour que set-sync stocke l'image exacte matchée
              galleryCards: galleryCards.map(({ id: _id, ...rest }) => rest),
              // Fallback player→image pour les entrées cochées manuellement
              playerImages: Object.fromEntries(
                galleryCards
                  .filter(c => c.image_recto)
                  .map(c => [normStr(c.nom), c.image_recto])
                  .filter((e): e is [string, string] => Boolean(e[1]))
              ),
            }),
          })
          if (res.ok) {
            const { completedEntryIds: ids, completionDetails: dets, ownedPlayerNorms } = await res.json()
            completedEntryIds = new Set<number>(ids)
            for (const [k, v] of Object.entries(dets as Record<string, { id: string; manually_checked: boolean }>)) {
              completionDetails.set(parseInt(k), v)
            }
            // "Mes cartes" depuis les norms propriétaires + galerie locale
            const ownedNorms = new Set<string>(ownedPlayerNorms as string[])
            setMySetCards(
              galleryCards
                .filter(c => c.image_recto && ownedNorms.has(normStr(c.nom)))
                .map(c => ({ id: c.id || '', image: c.image_recto!, nom: c.nom, variation: c.variation || '' }))
            )
          }
        } catch { /* si set-sync échoue, on continue sans completions */ }
      }

      setTotalOwned(completedEntryIds.size)
    }

    // Construire les variations meta (sans les cartes)
    const varNames = ['Base', ...Array.from(counts.keys()).filter(v => v !== 'Base').sort()]
    const varMetas: VariationMeta[] = varNames.map(name => ({
      name,
      count: counts.get(name) || 0,
      owned: 0,
      loaded: false,
      entries: [],
    }))

    setVariations(varMetas)
    setLoading(false)

    // Charger la variation Base immédiatement
    loadVariation('Base', varMetas, setData, completedEntryIds, completionDetails)
  }

  async function loadVariation(
    varName: string,
    currentVariations?: VariationMeta[],
    currentSet?: CardSet | null,
    completedIds?: Set<number>,
    completionDets?: Map<number, { id: string; manually_checked: boolean }>
  ) {
    const vars = currentVariations || variations
    const setInfo = currentSet || set
    const v = vars.find(v => v.name === varName)
    if (!v || v.loaded) return

    const isBase = varName === 'Base'
    const allPages: any[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const q = isBase
        ? supabase.from('card_set_entries').select('*').eq('set_id', setId).is('variation', null).range(from, from + PAGE - 1)
        : supabase.from('card_set_entries').select('*').eq('set_id', setId).eq('variation', varName).range(from, from + PAGE - 1)
      const { data: page } = await q
      if (!page?.length) break
      allPages.push(...page)
      if (page.length < PAGE) break
    }
    const finalData = allPages

    if (!finalData.length && !isBase) return

    const usedIds = completedIds || new Set<number>()
    const usedDets = completionDets || new Map<number, { id: string; manually_checked: boolean }>()

    const entries: Entry[] = finalData
      .sort((a, b) => {
        const na = parseInt(a.card_number || '9999')
        const nb = parseInt(b.card_number || '9999')
        return na - nb
      })
      .map(e => {
        const det = usedDets.get(e.id)
        return {
          ...e,
          owned: usedIds.has(e.id),
          manually_checked: det?.manually_checked || false,
          completion_id: det?.id || null,
        }
      })

    const ownedCount = entries.filter(e => e.owned).length

    // Charger les images communauté via API JS (matching strict : année + variation + collection)
    const entryIds = finalData.map((e: any) => e.id)
    if (entryIds.length > 0 && setInfo) {
      fetch('/api/setlist-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setId: parseInt(setId),
          setYear: setInfo.year,
          setBrand: setInfo.brand,
          setName: setInfo.name,
          entryIds,
        }),
      })
        .then(r => r.ok ? r.json() : [])
        .then((imgRows: { entry_id: number; image_url: string }[]) => {
          if (imgRows.length > 0) {
            setCommunityImages(prev => {
              const next = new Map(prev)
              for (const row of imgRows) next.set(row.entry_id, row.image_url)
              return next
            })
          }
        })
        .catch(() => {})
    }

    setVariations(prev => prev.map(v =>
      v.name === varName ? { ...v, loaded: true, entries, owned: ownedCount } : v
    ))
  }

  async function checkAllVariation(varName: string, ev: React.MouseEvent) {
    ev.stopPropagation()
    if (!userId) return
    setCheckingAll(varName)

    const isBase = varName === 'Base'
    const allEntryIds: number[] = []
    const PAGE = 1000
    for (let from = 0; ; from += PAGE) {
      const q = isBase
        ? supabase.from('card_set_entries').select('id').eq('set_id', setId).is('variation', null).range(from, from + PAGE - 1)
        : supabase.from('card_set_entries').select('id').eq('set_id', setId).eq('variation', varName).range(from, from + PAGE - 1)
      const { data: page } = await q
      if (!page?.length) break
      allEntryIds.push(...(page as any[]).map(e => e.id))
      if (page.length < PAGE) break
    }

    if (!allEntryIds.length) { setCheckingAll(null); return }

    const existingCompletions: { id: string; entry_id: number }[] = []
    for (let i = 0; i < allEntryIds.length; i += 500) {
      const { data } = await supabase.from('user_set_completion')
        .select('id, entry_id').eq('user_id', userId).in('entry_id', allEntryIds.slice(i, i + 500))
      if (data) existingCompletions.push(...(data as any[]))
    }

    const ownedSet = new Set(existingCompletions.map(c => c.entry_id))
    const allOwned = allEntryIds.every(id => ownedSet.has(id))

    if (allOwned) {
      const completionIds = existingCompletions.map(c => c.id)
      for (let i = 0; i < completionIds.length; i += 500)
        await supabase.from('user_set_completion').delete().in('id', completionIds.slice(i, i + 500))
      setTotalOwned(p => p - existingCompletions.length)
      setVariations(prev => prev.map(v =>
        v.name === varName ? { ...v, owned: 0, entries: v.entries.map(e => ({ ...e, owned: false, completion_id: null })) } : v
      ))
    } else {
      const missingIds = allEntryIds.filter(id => !ownedSet.has(id))
      const rows = missingIds.map(id => ({ user_id: userId, entry_id: id, manually_checked: true }))
      const newCompletions: { id: string; entry_id: number }[] = []
      for (let i = 0; i < rows.length; i += 500) {
        const { data } = await supabase.from('user_set_completion')
          .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,entry_id' }).select('id, entry_id')
        if (data) newCompletions.push(...(data as any[]))
      }
      const newIds = new Map(newCompletions.map(c => [c.entry_id, c.id]))
      setTotalOwned(p => p + missingIds.length)
      setVariations(prev => prev.map(v =>
        v.name === varName ? {
          ...v, owned: allEntryIds.length,
          entries: v.entries.map(e => ({ ...e, owned: true, manually_checked: true, completion_id: newIds.get(e.id) || e.completion_id }))
        } : v
      ))
    }
    setCheckingAll(null)
  }

  async function toggleVariation(varName: string) {
    const isOpen = openVariations.has(varName)
    setOpenVariations(prev => {
      const next = new Set(prev)
      isOpen ? next.delete(varName) : next.add(varName)
      return next
    })
    if (!isOpen) {
      const v = variations.find(v => v.name === varName)
      if (v && !v.loaded) loadVariation(varName)
    }
  }

  async function toggleOwned(entry: Entry, varName: string) {
    if (!userId) return
    setSaving(entry.id)

    if (entry.owned && entry.completion_id) {
      await supabase.from('user_set_completion').delete().eq('id', entry.completion_id)
      setVariations(prev => prev.map(v =>
        v.name === varName ? {
          ...v,
          owned: v.owned - 1,
          entries: v.entries.map(e => e.id === entry.id ? { ...e, owned: false, completion_id: null } : e)
        } : v
      ))
      setTotalOwned(p => p - 1)
    } else {
      const { data } = await supabase.from('user_set_completion')
        .insert({ user_id: userId, entry_id: entry.id, manually_checked: true })
        .select('id').single()
      setVariations(prev => prev.map(v =>
        v.name === varName ? {
          ...v,
          owned: v.owned + 1,
          entries: v.entries.map(e => e.id === entry.id ? { ...e, owned: true, manually_checked: true, completion_id: data?.id || null } : e)
        } : v
      ))
      setTotalOwned(p => p + 1)
    }
    setSaving(null)
  }

  const pct = set?.total_cards ? Math.round((totalOwned / set.total_cards) * 100) : 0

  // Équipes disponibles depuis toutes les variations chargées
  const allTeams = Array.from(new Set(
    variations.flatMap(v => v.entries.map(e => e.team)).filter(Boolean) as string[]
  )).sort()

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
  if (!set) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Set introuvable.</div>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← Setlist {set.sport === 'nba' ? 'NBA' : set.sport === 'nfl' ? 'NFL' : set.sport === 'baseball' ? 'Baseball' : set.sport === 'hockey' ? 'Hockey' : set.sport === 'pokemon' ? 'Pokémon' : 'MTG'}
        </Link>
      </div>

      {/* Header */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: '24px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>{set.name}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: userId ? 16 : 0 }}>
          {set.year && <span style={{ fontSize: 13, color: '#888', fontWeight: 700 }}>{set.year}</span>}
          {set.brand && <span style={{ fontSize: 13, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 6, padding: '2px 8px' }}>{set.brand}</span>}
          <span style={{ fontSize: 13, color: '#aaa' }}>{set.total_cards.toLocaleString()} cartes · {variations.length} variations</span>
        </div>
        {userId ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{totalOwned} / {set.total_cards.toLocaleString()} possédées</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: pct === 100 ? '#2ecc71' : '#003DA6' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: dark ? '#333' : '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#888' }}>
            <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>Connectez-vous</Link> pour tracker votre complétion
          </div>
        )}
      </div>

      {/* Mes cartes dans ce set */}
      {userId && mySetCards.length > 0 && (
        <div style={{ background: dark ? '#111d33' : '#f0f4ff', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, color: dark ? '#7aabf7' : '#003DA6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🃏 Mes cartes · {mySetCards.length}
          </div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {mySetCards.map((card, i) => (
              <div key={i} onClick={() => setPreviewCard(card)} style={{ flexShrink: 0, cursor: 'pointer', width: 64, textAlign: 'center' }}>
                <img src={card.image} alt={card.nom}
                  style={{ width: 64, height: 90, objectFit: 'cover', borderRadius: 8, display: 'block', boxShadow: '0 3px 10px rgba(0,0,0,0.25)', transition: 'transform 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.07) translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                />
                <div style={{ fontSize: 10, fontWeight: 700, marginTop: 5, color: dark ? '#eee' : '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.nom.split(' ').pop()}
                </div>
                {card.variation && (
                  <div style={{ fontSize: 9, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.variation}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal preview carte galerie — portal pour échapper au stacking context */}
      {previewCard && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreviewCard(null)}>
          <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 22, padding: '28px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <img src={previewCard.image} alt={previewCard.nom}
              style={{ width: '72%', borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,0.3)', display: 'block', margin: '0 auto 18px' }} />
            <div style={{ fontWeight: 900, fontSize: 20, color: dark ? '#eee' : '#111', marginBottom: 4 }}>{previewCard.nom}</div>
            {previewCard.variation && (
              <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>{previewCard.variation}</div>
            )}
            <button onClick={() => setPreviewCard(null)}
              style={{ padding: '10px 24px', borderRadius: 10, border: `1.5px solid ${dark ? '#444' : '#ddd'}`, background: 'none', color: dark ? '#ccc' : '#666', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              Fermer
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur ou #..."
          style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: `1.5px solid ${search ? '#003DA6' : (dark ? '#444' : '#e0e0e0')}`, borderRadius: 8, fontSize: 14, outline: 'none', background: dark ? '#2a2a2a' : 'white', color: dark ? '#eee' : '#111' }} />
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          style={{ padding: '10px 14px', border: `1.5px solid ${filterTeam ? '#003DA6' : (dark ? '#444' : '#e0e0e0')}`, borderRadius: 8, fontSize: 13, background: dark ? '#2a2a2a' : 'white', cursor: 'pointer', fontWeight: filterTeam ? 700 : 400, color: filterTeam ? '#003DA6' : (dark ? '#bbb' : '#666'), minWidth: 160 }}>
          <option value="">Toutes les équipes</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {userId && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '10px 16px', border: '1.5px solid', borderColor: filter === f ? '#003DA6' : (dark ? '#444' : '#e0e0e0'), borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: filter === f ? '#003DA6' : (dark ? '#2a2a2a' : 'white'), color: filter === f ? 'white' : (dark ? '#eee' : '#333') }}>
                {f === 'all' ? 'Tout' : f === 'owned' ? '✓ Possédées' : '✗ Manquantes'}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setFilterRc(v => !v)}
          style={{ padding: '10px 16px', border: `1.5px solid ${filterRc ? '#e67e22' : (dark ? '#444' : '#e0e0e0')}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: filterRc ? '#e67e22' : (dark ? '#2a2a2a' : 'white'), color: filterRc ? 'white' : (dark ? '#eee' : '#333'), whiteSpace: 'nowrap' }}>
          RC
        </button>
        {userId && filter === 'missing' && (
          <button onClick={() => {
            const missing = variations.flatMap(v => v.entries.filter(e => !e.owned)).map(e => `#${e.card_number || '?'} ${e.player_name}${e.team ? ` (${e.team})` : ''}`)
            navigator.clipboard.writeText(missing.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
          }}
            style={{ padding: '10px 16px', border: `1.5px solid ${copied ? '#2ecc71' : (dark ? '#444' : '#e0e0e0')}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: copied ? '#2ecc71' : (dark ? '#2a2a2a' : 'white'), color: copied ? 'white' : (dark ? '#eee' : '#333'), whiteSpace: 'nowrap' }}>
            {copied ? '✓ Copié !' : '📋 Copier la liste'}
          </button>
        )}
      </div>

      {/* Variations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {variations.map(variation => {
          const isOpen = openVariations.has(variation.name)
          const varPct = variation.count ? Math.round((variation.owned / variation.count) * 100) : 0

          const displayEntries = variation.loaded
            ? variation.entries.filter(e => {
                if (search && !e.player_name.toLowerCase().includes(search.toLowerCase()) && !(e.card_number || '').toLowerCase().includes(search.toLowerCase())) return false
                if (filterTeam && e.team !== filterTeam) return false
                if (filter === 'owned' && !e.owned) return false
                if (filter === 'missing' && e.owned) return false
                if (filterRc && !e.is_rc) return false
                return true
              })
            : []

          if ((filter !== 'all' || search || filterTeam) && variation.loaded && displayEntries.length === 0) return null

          return (
            <div key={variation.name} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
              <div onClick={() => toggleVariation(variation.name)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111', flex: 1 }}>{variation.name}</span>
                <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{variation.count} cartes</span>
                {userId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: dark ? '#333' : '#f0f0f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${varPct}%`, background: varPct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: varPct === 100 ? '#2ecc71' : '#003DA6', minWidth: 32, textAlign: 'right' }}>{varPct}%</span>
                  </div>
                )}
                {userId && (
                  <button
                    onClick={ev => checkAllVariation(variation.name, ev)}
                    disabled={checkingAll === variation.name}
                    title={varPct === 100 ? 'Tout décocher' : 'Tout cocher'}
                    style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 6, border: '1.5px solid', borderColor: varPct === 100 ? '#2ecc71' : '#003DA6', background: dark ? '#1e1e1e' : 'white', color: varPct === 100 ? '#2ecc71' : '#003DA6', cursor: checkingAll === variation.name ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: checkingAll === variation.name ? 0.5 : 1, flexShrink: 0 }}
                  >
                    {checkingAll === variation.name ? '…' : varPct === 100 ? '✗ Tout' : '✓ Tout'}
                  </button>
                )}
                <span style={{ fontSize: 11, color: '#ccc', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` }}>
                  {!variation.loaded ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>Chargement...</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '52px 44px 1fr 140px 36px', padding: '8px 18px', background: dark ? '#252525' : '#fafafa', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#bbb', letterSpacing: '0.5px' }}>
                        <span>#</span><span></span><span>Joueur</span><span>Équipe</span><span></span>
                      </div>
                      {displayEntries.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>Aucune carte</div>
                      ) : displayEntries.map(entry => {
                        const communityImg = communityImages.get(entry.id)
                        return (
                        <div key={entry.id}
                          style={{ display: 'grid', gridTemplateColumns: '52px 44px 1fr 140px 36px', padding: '6px 18px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, background: entry.owned ? (dark ? '#0d2e1a' : '#f5fff7') : (dark ? '#1e1e1e' : 'white'), alignItems: 'center', minHeight: 50 }}>
                          <span style={{ fontSize: 12, color: '#bbb', fontWeight: 700 }}>{entry.card_number || '—'}</span>
                          <div style={{ width: 36, height: 50, flexShrink: 0 }}>
                            {communityImg ? (
                              <img src={communityImg} alt="" onClick={ev => { ev.stopPropagation(); setPreviewCard({ image: communityImg, nom: entry.player_name, variation: entry.variation || '' }) }}
                                style={{ width: 36, height: 50, objectFit: 'cover', borderRadius: 3, display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.18)', cursor: 'zoom-in' }} />
                            ) : (
                              <div title="Carte pas encore sur le site" style={{ width: 36, height: 50, background: dark ? '#2a2a2a' : '#f0f0f0', border: `1px dashed ${dark ? '#444' : '#d8d8d8'}`, borderRadius: 3 }} />
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <Link href={`/joueur/${playerSlug(entry.player_name)}`} style={{ fontSize: 14, fontWeight: entry.owned ? 700 : 400, color: entry.owned ? (dark ? '#eee' : '#111') : (dark ? '#999' : '#444'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{entry.player_name}</Link>
                            {entry.is_rc && <span style={{ fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>RC</span>}
                            {entry.manually_checked && <span style={{ fontSize: 10, color: '#2ecc71', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.team || '—'}</span>
                          {userId ? (
                            <button onClick={() => toggleOwned(entry, variation.name)} disabled={saving === entry.id}
                              style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid', borderColor: entry.owned ? '#2ecc71' : (dark ? '#444' : '#ddd'), background: entry.owned ? '#2ecc71' : (dark ? '#2a2a2a' : 'white'), color: entry.owned ? 'white' : '#ccc', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving === entry.id ? 0.5 : 1 }}>
                              ✓
                            </button>
                          ) : <span />}
                        </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#aaa' }}>
        {set.total_cards.toLocaleString()} cartes · {variations.length} variations
      </div>
    </div>
  )
}
