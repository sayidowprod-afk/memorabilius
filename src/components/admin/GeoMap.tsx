'use client'
import { useState, useRef, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, Marker, Graticule, Sphere } from 'react-simple-maps'

type GeoEntry = { code: string; visitors: number }
type GeoUser  = { lat: number; lon: number; name: string; slug: string }

interface Props {
  geoCntrs:     GeoEntry[]
  centroids:    Record<string, [number, number]>
  onHover:      (entry: GeoEntry | null) => void
  geoUsers?:    GeoUser[]
  onUserHover?: (user: GeoUser | null) => void
  period?:      string
}

type Region = { label: string; scale: number; center: [number, number] }

const REGIONS: Region[] = [
  { label: '🌍 Monde',     scale: 153,  center: [10,  10]  },
  { label: '🇪🇺 Europe',   scale: 620,  center: [15,  52]  },
  { label: '🌎 Amériques', scale: 280,  center: [-75, 15]  },
  { label: '🌏 Asie',      scale: 300,  center: [95,  38]  },
  { label: '🌍 Afrique',   scale: 380,  center: [20,  5]   },
  { label: '🌊 Océanie',   scale: 430,  center: [140, -25] },
]

const CLUSTER_ZOOM = 2.5
const ACCENT = '#3b82f6'

export default function GeoMap({ geoCntrs, centroids, onHover, geoUsers, onUserHover, period }: Props) {
  const [view, setView]                 = useState<Region>(REGIONS[0])
  const [zoom, setZoom]                 = useState(1)
  const [centerOffset, setCenterOffset] = useState<[number, number]>([0, 0])
  const [isPanning, setIsPanning]       = useState(false)
  const lastPanPos = useRef<[number, number]>([0, 0])
  const hasMoved   = useRef(false)
  const mapWrapRef = useRef<HTMLDivElement>(null)

  const maxV = geoCntrs.length ? Math.max(...geoCntrs.map(c => c.visitors)) : 1
  const effectiveScale: number = view.scale * zoom
  const effectiveCenter: [number, number] = [
    view.center[0] + centerOffset[0],
    view.center[1] + centerOffset[1],
  ]

  const inClusterMode = zoom < CLUSTER_ZOOM || period === 'live'
  const hasUsers = (geoUsers?.length ?? 0) > 0

  useEffect(() => { setCenterOffset([0, 0]) }, [view])

  // Wheel zoom with passive:false so we can preventDefault (stops page scroll)
  useEffect(() => {
    const el = mapWrapRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1.25 : 0.8
      setZoom(z => Math.max(0.4, Math.min(20, z * delta)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  function changeView(r: Region) { setView(r); setZoom(1); setCenterOffset([0, 0]) }

  function onMapMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    setIsPanning(true); hasMoved.current = false
    lastPanPos.current = [e.clientX, e.clientY]
    e.preventDefault()
  }

  function onMapMouseMove(e: React.MouseEvent) {
    if (!isPanning) return
    const dx = e.clientX - lastPanPos.current[0]
    const dy = e.clientY - lastPanPos.current[1]
    if (!hasMoved.current && Math.abs(dx) + Math.abs(dy) > 2) hasMoved.current = true
    if (!hasMoved.current) return
    lastPanPos.current = [e.clientX, e.clientY]
    const factor = 60 / effectiveScale
    setCenterOffset(prev => [prev[0] - dx * factor, prev[1] + dy * factor])
  }

  function onMapMouseUp() { setIsPanning(false) }

  return (
    <div>
      {/* Région + zoom — scrollable horizontalement sur mobile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as never, paddingBottom: 2 }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {REGIONS.map(r => (
            <button key={r.label} onClick={() => changeView(r)} style={{
              fontSize: 10, padding: '3px 7px', borderRadius: 6, border: '1px solid',
              borderColor: view.label === r.label ? ACCENT : '#cbd5e1',
              background:  view.label === r.label ? '#eff6ff' : '#f8fafc',
              color:       view.label === r.label ? '#1d4ed8' : '#475569',
              cursor: 'pointer', fontWeight: view.label === r.label ? 600 : 400,
              transition: 'all .12s', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {r.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center', flexShrink: 0 }}>
          {hasUsers && period !== 'live' && (
            <span style={{
              fontSize: 10, color: inClusterMode ? ACCENT : '#ef4444',
              background: inClusterMode ? '#eff6ff' : '#fef2f2',
              borderRadius: 4, padding: '2px 6px', fontWeight: 600, transition: 'all .2s', whiteSpace: 'nowrap',
            }}>
              {inClusterMode ? '🗺 pays' : '📍 précis'}
            </span>
          )}
          <button onClick={() => setZoom(z => Math.min(z * 1.6, 20))}
            style={{ fontSize: 16, width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            +
          </button>
          <button onClick={() => setZoom(z => Math.max(z / 1.6, 0.4))}
            style={{ fontSize: 16, width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            −
          </button>
        </div>
      </div>

      {/* Hint */}
      {hasUsers && period !== 'live' && (
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textAlign: 'right' }}>
          {inClusterMode
            ? `Zoomez pour voir les ${geoUsers!.length} comptes`
            : `Dézoomez pour revenir aux bulles · roulette souris supportée`}
        </div>
      )}

      {/* Carte */}
      <div
        ref={mapWrapRef}
        style={{ cursor: isPanning && hasMoved.current ? 'grabbing' : 'grab', userSelect: 'none', position: 'relative', touchAction: 'none' }}
        onMouseDown={onMapMouseDown}
        onMouseMove={onMapMouseMove}
        onMouseUp={onMapMouseUp}
        onMouseLeave={onMapMouseUp}
      >
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: effectiveScale, center: effectiveCenter }}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Océan bleu doux */}
          <Sphere id="sphere" fill="#eff6ff" stroke="#bfdbfe" strokeWidth={0.5} />
          <Graticule stroke="#dbeafe" strokeWidth={0.3} />
          <Geographies geography="/world-110m.json">
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#dbeafe"
                  stroke="#93c5fd"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: '#bfdbfe' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Mode cluster : bulles par pays */}
          {inClusterMode && geoCntrs.map(({ code, visitors }) => {
            const c = centroids[code]
            if (!c) return null
            const r = Math.max(2.5, Math.sqrt(visitors / maxV) * 12)
            const showLabel = r >= 7
            return (
              <Marker key={code} coordinates={c}>
                <circle
                  r={r}
                  fill="rgba(59,130,246,0.38)"
                  stroke="rgba(29,78,216,0.65)"
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => { if (!hasMoved.current) onHover({ code, visitors }) }}
                  onMouseLeave={() => onHover(null)}
                />
                {showLabel && (
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={r * 0.65}
                    fill="rgba(30,58,138,0.9)"
                    fontWeight="700"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {visitors >= 1000 ? `${(visitors / 1000).toFixed(1)}k` : visitors}
                  </text>
                )}
              </Marker>
            )
          })}

          {/* Mode précis : points individuels */}
          {!inClusterMode && geoUsers?.map((u, i) => (
            <Marker key={`u-${i}`} coordinates={[u.lon, u.lat]}>
              <circle
                r={2.5}
                fill="rgba(239,68,68,0.72)"
                stroke="rgba(185,28,28,0.88)"
                strokeWidth={0.7}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => { if (!hasMoved.current) onUserHover?.(u) }}
                onMouseLeave={() => onUserHover?.(null)}
              />
            </Marker>
          ))}
        </ComposableMap>

        {/* Légende interne */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: 'rgba(255,255,255,0.90)', borderRadius: 6, padding: '3px 10px',
          fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(2px)',
        }}>
          {inClusterMode ? (
            <>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(59,130,246,0.38)', border: '1px solid rgba(29,78,216,0.65)', flexShrink: 0 }} />
              Comptes par pays · taille proportionnelle
            </>
          ) : (
            <>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(239,68,68,0.72)', border: '1px solid rgba(185,28,28,0.88)', flexShrink: 0 }} />
              1 point = 1 compte localisé
            </>
          )}
        </div>
      </div>
    </div>
  )
}
