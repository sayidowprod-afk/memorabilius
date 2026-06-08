'use client'
import { useEffect, useState, useRef, use } from 'react'
import { supabase } from '@/lib/supabase'
import Viewer3D from '@/components/Viewer3D'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export default function Galerie({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [profile, setProfile] = useState<any>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [filtered, setFiltered] = useState<Card[]>([])
  const [activeFilters, setActiveFilters] = useState({ rc: false, auto: false, num: false, patch: false })
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fYear, setFYear] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [popup, setPopup] = useState<Card | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      if (data) { setProfile(data); if (data.lien_csv) loadCSV(data.lien_csv) }
    })
  }, [userId])

  const loadCSV = async (url: string) => {
    try {
      const r = await fetch(url + '&t=' + Date.now())
      const t = await r.text()
      const rows = t.split(/\r?\n/).slice(4)
      const parsed: Card[] = rows.map(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0] || !c[0].includes('http')) return null
        return {
          f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
          n: c[2] || '', t: c[3] || '', y: c[4] || '',
          br: c[5] || '', s: c[6] || '', v: c[7] || '',
          num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
          rc: c[10]?.toLowerCase().includes('oui') || false,
          patch: c[11]?.toLowerCase().includes('oui') || false,
          g: c[12] || 'Raw'
        }
      }).filter(Boolean) as Card[]
      setCards(parsed)
      setTeams([...new Set(parsed.map(d => d.t).filter(Boolean))].sort())
      setBrands([...new Set(parsed.map(d => d.s).filter(Boolean))].sort())
      setYears([...new Set(parsed.map(d => d.y).filter(Boolean))].sort())
      setLoaded(true)
    } catch (e) { console.error('CSV error', e) }
  }

  useEffect(() => {
    const f = cards.filter(d =>
      d.n.toLowerCase().includes(search.toLowerCase()) &&
      (!fTeam || d.t === fTeam) &&
      (!fBrand || d.s === fBrand) &&
      (!fYear || d.y === fYear) &&
      (!activeFilters.rc || d.rc) &&
      (!activeFilters.auto || d.auto) &&
      (!activeFilters.patch || d.patch) &&
      (!activeFilters.num || d.num !== '')
    )
    setFiltered(f)
  }, [cards, search, fTeam, fBrand, fYear, activeFilters])

  const toggleFilter = (k: keyof typeof activeFilters) => setActiveFilters(p => ({ ...p, [k]: !p[k] }))

  const getTags = (d: Card) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 14 }}>
      {d.rc && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#fff3e0', color: '#e67e22' }}>RC</span>}
      {d.auto && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#e8f5e9', color: '#2e7d32' }}>AUTO</span>}
      {d.num && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#f5f5f5', color: '#444' }}>#{d.num}</span>}
      {d.patch && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#e3f2fd', color: '#1976d2' }}>PATCH</span>}
    </div>
  )

  const accent = profile?.couleur_bordure || '#003DA6'

  return (
    <>

      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ textAlign: 'center', fontSize: 28, fontWeight: 900, margin: '20px 0', textTransform: 'uppercase' }}>
          Galerie de {profile?.display_name || 'Collectionneur'}
        </h1>

        {profile?.lien_logo && (
          <div style={{ textAlign: 'center', marginBottom: 15 }}>
            <img src={profile.lien_logo} style={{ maxHeight: 60, objectFit: 'contain' }} alt="logo" />
          </div>
        )}

        <div style={{ background: '#fff', padding: 10, borderRadius: 8, marginBottom: 15, border: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Recherche</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Joueur..." /></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Équipe</label>
              <select value={fTeam} onChange={e => setFTeam(e.target.value)}>
                <option value="">Toutes</option>{teams.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Collection</label>
              <select value={fBrand} onChange={e => setFBrand(e.target.value)}>
                <option value="">Toutes</option>{brands.map(b => <option key={b}>{b}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Année</label>
              <select value={fYear} onChange={e => setFYear(e.target.value)}>
                <option value="">Toutes</option>{years.map(y => <option key={y}>{y}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
            {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
              <button key={k} onClick={() => toggleFilter(k)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: activeFilters[k] ? accent : '#f0f0f0', color: activeFilters[k] ? 'white' : '#333'
              }}>{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {!loaded && <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
          {profile?.lien_csv ? 'Chargement des cartes...' : 'Ce collectionneur n\'a pas encore lié sa galerie.'}
        </p>}

        <style>{`
          .card-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
          .card-item { flex: 0 0 calc(50% - 6px); max-width: calc(50% - 6px); }
          @media (min-width: 900px) { .card-item { flex: 0 0 calc(20% - 10px); max-width: calc(20% - 10px); } }
        `}</style>
        <div className="card-grid">
          {filtered.map((d, i) => (
            <div key={i} className="card-item" onClick={() => setPopup(d)} style={{
              border: `2px solid ${accent}`, borderRadius: 8, padding: 8,
              background: 'white', cursor: 'pointer', boxSizing: 'border-box',
            }}>
              <div style={{ width: '100%', aspectRatio: '2.5/3.5', marginBottom: 8, overflow: 'hidden' }}>
                <img src={d.f} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={d.n} />
              </div>
              {getTags(d)}
              <p style={{ fontWeight: 800, fontSize: 13, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</p>
              <p style={{ fontSize: 10, color: accent, fontWeight: 700, margin: '2px 0', fontStyle: 'italic' }}>{d.v}</p>
              <p style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{d.y} {d.br} {d.s}</p>
            </div>
          ))}
        </div>
      </div>

      {popup && (
        <Viewer3D popup={popup} accent={accent} onClose={() => setPopup(null)} getTags={getTags} />
      )}
    </>
  )
}
