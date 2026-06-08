'use client'
import { useEffect, useState, useRef, use } from 'react'
import { supabase } from '@/lib/supabase'
import Script from 'next/script'

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
  const curX = useRef(0), curY = useRef(0), curScale = useRef(1)

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

  const updateTransform = () => {
    const canv = document.getElementById('canv3D') as HTMLElement
    const wrap = document.getElementById('zoomWrapper') as HTMLElement
    if (canv) canv.style.transform = `scale(0.5) rotateX(${curY.current}deg) rotateY(${curX.current}deg)`
    if (wrap) wrap.style.transform = `scale(${curScale.current})`
  }

  const accent = profile?.couleur_bordure || '#003DA6'

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js" onLoad={() => {
        const area = document.getElementById('dragZone')
        if (!area || !(window as any).Hammer) return
        const mc = new (window as any).Hammer.Manager(area)
        mc.add(new (window as any).Hammer.Pan({ threshold: 0, pointers: 0 }))
        mc.add(new (window as any).Hammer.Pinch({ enable: true }))
        let sX = 0, sY = 0, sS = 1
        mc.on('panstart', () => { sX = curX.current; sY = curY.current })
        mc.on('panmove', (e: any) => { curX.current = sX + e.deltaX * 0.6; curY.current = sY + e.deltaY * -0.6; updateTransform() })
        mc.on('pinchstart', () => { sS = curScale.current })
        mc.on('pinchmove', (e: any) => { curScale.current = Math.min(Math.max(sS * e.scale, 0.5), 3); updateTransform() })
      }} />

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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#fff', zIndex: 9999999, display: 'flex', flexDirection: 'column' }}>
          <button onClick={() => setPopup(null)} style={{
            position: 'absolute', top: 20, right: 20, fontSize: 28, cursor: 'pointer',
            background: '#fff', width: 40, height: 40, borderRadius: '50%',
            border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001
          }}>×</button>
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div id="dragZone" style={{ flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f8', perspective: 2000, touchAction: 'none' }}
              onWheel={e => { e.preventDefault(); curScale.current = Math.min(Math.max(0.5, curScale.current + e.deltaY * -0.001), 4); updateTransform() }}
              onMouseMove={e => { if (e.buttons !== 1) return; curX.current += e.movementX * 0.5; curY.current -= e.movementY * 0.5; updateTransform() }}>
              <div id="zoomWrapper" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.1s ease-out', willChange: 'transform' }}>
                <div id="canv3D" style={{ width: 520, height: 728, position: 'relative', transformStyle: 'preserve-3d' }}>
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                    <img src={popup.f} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={popup.n} />
                  </div>
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                    <img src={popup.b} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={popup.n} />
                  </div>
                </div>
              </div>
            </div>
            <div style={{ flex: 0.8, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'white', overflowY: 'auto' }}>
              <div style={{ color: accent, fontWeight: 900, fontSize: 11, textTransform: 'uppercase' }}>{popup.t}</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '5px 0' }}>{popup.n}</h2>
              <div style={{ fontSize: '1.1rem', color: accent, fontWeight: 700, marginBottom: 10, fontStyle: 'italic' }}>{popup.v}</div>
              {getTags(popup)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, borderTop: '1px solid #eee', marginTop: 15, paddingTop: 15 }}>
                {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
                  <div key={l}>
                    <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>{l}</label>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
