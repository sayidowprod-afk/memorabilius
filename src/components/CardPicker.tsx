'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { useLang } from '@/lib/LangContext'
import ModalCloseButton from '@/components/ModalCloseButton'
import CardTagBadges from '@/components/CardTagBadges'

export interface PickableCard {
  key: string
  img: string
  back?: string
  nom: string
  team?: string
  year?: string
  brand?: string
  variant?: string
  category?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  num?: boolean
  is_horizontal?: boolean
}

const ACCENT = '#003DA6'

// Ordre dans lequel les cartes choisies sont ajoutees (classeur) : l'ordre de selection, ou un tri automatique
type Order = 'pick' | 'year_asc' | 'year_desc' | 'name' | 'brand' | 'team'
const ORDER_LABELS: [Order, string][] = [
  ['pick', 'Ordre de sélection'], ['year_asc', 'Année croissante'], ['year_desc', 'Année décroissante'],
  ['name', 'Joueur A → Z'], ['brand', 'Marque A → Z'], ['team', 'Équipe A → Z'],
]
const byText = (a?: string, b?: string) => (a || '').localeCompare(b || '', 'fr', { numeric: true, sensitivity: 'base' })
// cartes sans la donnee triee : a la fin ; a egalite, joueur puis variation (ex. tous les Maxey d'une meme annee restent regroupes)
function makeCmp(order: Order): ((a: PickableCard, b: PickableCard) => number) | null {
  const missingLast = (fa: string | undefined, fb: string | undefined, dir: 1 | -1) => (!fa && !fb ? 0 : !fa ? 1 : !fb ? -1 : dir * byText(fa, fb))
  const tie = (a: PickableCard, b: PickableCard) => byText(a.nom, b.nom) || byText(a.variant, b.variant)
  switch (order) {
    case 'year_asc': return (a, b) => missingLast(a.year, b.year, 1) || tie(a, b)
    case 'year_desc': return (a, b) => missingLast(a.year, b.year, -1) || tie(a, b)
    case 'name': return (a, b) => byText(a.nom, b.nom) || byText(a.year, b.year) || byText(a.variant, b.variant)
    case 'brand': return (a, b) => missingLast(a.brand, b.brand, 1) || byText(a.year, b.year) || tie(a, b)
    case 'team': return (a, b) => missingLast(a.team, b.team, 1) || tie(a, b)
    default: return null
  }
}
const TAGS = [
  { key: 'rc', label: 'RC', bg: '#F97316' },
  { key: 'auto', label: 'AUTO', bg: '#3B82F6' },
  { key: 'patch', label: 'PATCH', bg: '#EF4444' },
  { key: 'num', label: '# NUM', bg: '#A855F7' },
] as const

// Sélecteur de carte parmi la collection du user (manuelles + CSV), dédupliquées par image.
// Mode simple : onSelect(carte). Mode multi : sélection multiple → onSelectMany(cartes[]).
export default function CardPicker({ userId, onSelect, onSelectMany, onClose, excludeKeys, multi }: {
  userId: string
  onSelect?: (card: PickableCard) => void
  onSelectMany?: (cards: PickableCard[]) => void
  onClose: () => void
  excludeKeys?: Set<string>
  multi?: boolean
}) {
  const { t } = useLang()
  const [cards, setCards] = useState<PickableCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fYear, setFYear] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fTags, setFTags] = useState({ rc: false, auto: false, patch: false, num: false })
  const [fCategory, setFCategory] = useState('')
  const [picked, setPicked] = useState<PickableCard[]>([])
  const [order, setOrder] = useState<Order>('pick')
  const cmp = makeCmp(order)
  // rang final de chaque carte choisie dans le classeur (1, 2, 3...) : celui de la selection, ou celui du tri automatique choisi
  const rankOf = new Map<string, number>((cmp ? [...picked].sort(cmp) : picked).map((c, i) => [c.key, i + 1]))
  const pickedKeys = new Set(picked.map(p => p.key))

  useEffect(() => {
    (async () => {
      // Pagination pour bypasser le max_rows=1000 de Supabase — sans ça, les
      // collections de plus de 1000 cartes manuelles voient leurs cartes au-delà
      // de la limite disparaître silencieusement du picker (invisibles pour
      // n'importe quel classeur, pas seulement celui d'origine).
      const fetchAllManuelles = async () => {
        const all: any[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase
            .from('cartes_manuelles')
            .select('nom, image_recto, image_verso, equipe, annee, marque, variation, collection_tag, rc, auto, patch, num, format, is_horizontal')
            .eq('user_id', userId).not('image_recto', 'is', null)
            .order('created_at', { ascending: true })
            .range(from, from + 999)
          if (error || !data || data.length === 0) break
          all.push(...data)
          if (data.length < 1000) break
        }
        return all
      }
      const [manuelles, { data: profile }] = await Promise.all([
        fetchAllManuelles(),
        supabase.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').eq('id', userId).single(),
      ])
      const seen = new Set<string>()
      const list: PickableCard[] = []
      for (const m of (manuelles || []) as any[]) {
        if (!m.image_recto || seen.has(m.image_recto)) continue
        seen.add(m.image_recto)
        list.push({
          key: m.image_recto, img: m.image_recto, back: m.image_verso || undefined, nom: m.nom || '',
          team: m.equipe || '', year: (m.annee || '').toString(), brand: m.marque || '', variant: m.variation || '', category: m.collection_tag || '',
          rc: !!m.rc, auto: !!m.auto, patch: !!m.patch, num: !!(m.num && String(m.num).trim()),
          is_horizontal: m.format === 'horizontal' || (!m.format && !!m.is_horizontal),
        })
      }
      if (profile?.lien_csv) {
        const csvCards = await fetchCsvCardsForProfiles([profile])
        for (const c of csvCards) {
          if (!c.img || seen.has(c.img)) continue
          seen.add(c.img)
          list.push({
            key: c.img, img: c.img, back: c.back || undefined, nom: c.name || '',
            team: c.team || '', year: c.year || '', brand: c.brand || '', variant: c.variant || '',
            rc: !!c.rc, auto: !!c.auto, patch: !!c.patch, num: !!(c.num && String(c.num).trim()),
          })
        }
      }
      setCards(list)
      setLoading(false)
    })()
  }, [userId])

  const teams = useMemo(() => [...new Set(cards.map(c => c.team).filter(Boolean) as string[])].sort(), [cards])
  const years = useMemo(() => [...new Set(cards.map(c => c.year).filter(Boolean) as string[])].sort().reverse(), [cards])
  const brands = useMemo(() => [...new Set(cards.map(c => c.brand).filter(Boolean) as string[])].sort(), [cards])
  const categories = useMemo(() => [...new Set(cards.map(c => c.category).filter(Boolean) as string[])].sort(), [cards])

  const filteredRaw = cards
    .filter(c => !excludeKeys?.has(c.key))
    .filter(c => !search || c.nom.toLowerCase().includes(search.toLowerCase()) || (c.variant || '').toLowerCase().includes(search.toLowerCase()))
    .filter(c => !fTeam || c.team === fTeam)
    .filter(c => !fYear || c.year === fYear)
    .filter(c => !fBrand || c.brand === fBrand)
    .filter(c => !fCategory || c.category === fCategory)
    .filter(c => !fTags.rc || c.rc)
    .filter(c => !fTags.auto || c.auto)
    .filter(c => !fTags.patch || c.patch)
    .filter(c => !fTags.num || c.num)
  // la grille suit l'ordre choisi : on voit dans quel ordre les cartes seront rangees
  const filtered = cmp ? [...filteredRaw].sort(cmp) : filteredRaw

  const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border, #e0e0e0)', fontSize: 12, background: 'var(--card-bg, #fff)', color: 'var(--text, #121212)', cursor: 'pointer' }

  return createPortal(
    <div onClick={onClose} className="modal-glass-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--text, #121212)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 600, maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🃏 {multi ? t('picker_title_multi') : t('gallery_choose_card')}</h3>
          <ModalCloseButton onClick={onClose} />
        </div>

        {/* Recherche + filtres */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('gallery_search')} autoFocus />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={fTeam} onChange={e => setFTeam(e.target.value)} style={{ ...selectStyle, borderColor: fTeam ? ACCENT : '#e0e0e0' }}>
            <option value="">{t('gallery_team')}</option>
            {teams.map(tm => <option key={tm} value={tm}>{tm}</option>)}
          </select>
          <select value={fYear} onChange={e => setFYear(e.target.value)} style={{ ...selectStyle, borderColor: fYear ? ACCENT : '#e0e0e0' }}>
            <option value="">{t('gallery_year')}</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={{ ...selectStyle, borderColor: fBrand ? ACCENT : '#e0e0e0' }}>
            <option value="">{t('picker_brand')}</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {categories.length > 0 && (
            <select value={fCategory} onChange={e => setFCategory(e.target.value)} style={{ ...selectStyle, borderColor: fCategory ? ACCENT : '#e0e0e0' }}>
              <option value="">{t('picker_category')}</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TAGS.map(t => {
            const on = fTags[t.key]
            return (
              <button key={t.key} onClick={() => setFTags(prev => ({ ...prev, [t.key]: !prev[t.key] }))} style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11,
                background: on ? t.bg : 'var(--bg3, #f0f0f0)', color: on ? 'white' : 'var(--text2, #555)',
              }}>{t.label}</button>
            )
          })}
          {(fTeam || fYear || fBrand || fCategory || search || fTags.rc || fTags.auto || fTags.patch || fTags.num) && (
            <button onClick={() => { setSearch(''); setFTeam(''); setFYear(''); setFBrand(''); setFCategory(''); setFTags({ rc: false, auto: false, patch: false, num: false }) }}
              style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border, #e0e0e0)', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: 'var(--card-bg, #fff)', color: 'var(--text2, #888)' }}>
              {t('picker_reset')}
            </button>
          )}
        </div>

        {multi && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, color: 'var(--text3, #999)', textTransform: 'uppercase', letterSpacing: .4 }}>
            Ranger dans le classeur par
            <select value={order} onChange={e => setOrder(e.target.value as Order)} style={{ ...selectStyle, borderColor: order !== 'pick' ? ACCENT : '#e0e0e0', flex: 1 }}>
              {ORDER_LABELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text3, #999)' }}>{filtered.length} {filtered.length > 1 ? t('picker_card_plural') : t('picker_card_singular')}{multi && picked.length ? ` · ${picked.length} ${picked.length > 1 ? t('picker_selected_plural') : t('picker_selected')}` : ''}</span>
          {multi && filtered.length > 0 && (() => {
            const allSel = filtered.every(c => pickedKeys.has(c.key))
            return (
              <button onClick={() => {
                if (allSel) { const fk = new Set(filtered.map(c => c.key)); setPicked(prev => prev.filter(p => !fk.has(p.key))) }
                else setPicked(prev => { const have = new Set(prev.map(p => p.key)); return [...prev, ...filtered.filter(c => !have.has(c.key))] })
              }} style={{ padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${ACCENT}`, background: allSel ? ACCENT : 'var(--card-bg, #fff)', color: allSel ? 'white' : ACCENT, cursor: 'pointer', fontWeight: 800, fontSize: 11 }}>
                {allSel ? t('picker_deselect_all') : `${t('picker_select_all')} (${filtered.length})`}
              </button>
            )
          })()}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: 10, alignContent: 'start' }}>
          {loading ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text3, #999)', padding: 20 }}>{t('setlist_loading')}</p>
          ) : filtered.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text3, #999)', padding: 20 }}>{t('picker_no_cards')}</p>
          ) : filtered.map(c => {
            const sel = pickedKeys.has(c.key)
            return (
              <div key={c.key}
                onClick={() => {
                  if (multi) setPicked(prev => sel ? prev.filter(p => p.key !== c.key) : [...prev, c])
                  else onSelect?.(c)
                }}
                style={{ cursor: 'pointer', borderRadius: 8, border: sel ? `2px solid ${ACCENT}` : '1px solid var(--border, #eee)', transition: '0.15s', position: 'relative', background: 'var(--bg3, #f4f4f4)' }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = ACCENT }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = 'var(--border, #eee)' }}
              >
                <img src={c.img} alt={c.nom} loading="lazy"
                  style={{ width: '100%', height: 140, objectFit: 'contain', display: 'block', borderRadius: '6px 6px 0 0' }} />
                {(c.rc || c.auto || c.patch) && (
                  <div style={{ position: 'absolute', top: 3, left: 3, display: 'flex', gap: 2 }}>
                    <CardTagBadges rc={c.rc} auto={c.auto} patch={c.patch} size="xs" />
                  </div>
                )}
                {multi && sel && (
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: '50%', background: ACCENT, color: 'white', boxShadow: '0 1px 4px rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: rankOf.get(c.key)! > 99 ? 9 : rankOf.get(c.key)! > 9 ? 11 : 12, fontWeight: 900 }}>{rankOf.get(c.key)}</div>
                )}
                <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
              </div>
            )
          })}
        </div>

        {multi && (
          <button onClick={() => { if (picked.length) onSelectMany?.(cmp ? [...picked].sort(cmp) : picked) }} disabled={!picked.length}
            className="btn-main btn-primary" style={{ opacity: picked.length ? 1 : 0.5 }}>
            {t('gallery_add')} {picked.length > 0 ? `(${picked.length})` : ''}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
