'use client'
import { useState, useRef, useEffect } from 'react'
import { ComposableMap, Geographies, Geography, Marker, Graticule, Sphere } from 'react-simple-maps'

type GeoEntry = { code: string; visitors: number }
type GeoUser  = { lat: number; lon: number; name: string; slug: string }

interface Props {
  geoCntrs:    GeoEntry[]
  centroids:   Record<string, [number, number]>
  onHover:     (entry: GeoEntry | null) => void
  geoUsers?:   GeoUser[]
  onUserHover?: (user: GeoUser | null) => void
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

export default function GeoMap({ geoCntrs, centroids, onHover, geoUsers, onUserHover }: Props) {
  const [view, setView]               = useState<Region>(REGIONS[0])
  const [zoom, setZoom]               = useState(1)
  const [centerOffset, setCenterOffset] = useState<[number, number]>([0, 0])
  const [isPanning, setIsPanning]     = useState(false)
  const lastPanPos = useRef<[number, number]>([0, 0])
  const hasMoved   = useRef(false)

  const maxV = geoCntrs.length ? Math.max(...geoCntrs.map(c => c.visitors)) : 1
  const effectiveScale  = view.scale * zoom
  const effectiveCenter: [number, number] = [
    view.center[0] + centerOffset[0],
    view.center[1] + centerOffset[1],
  ]

  // Reset offset when changing region
  useEffect(() => { setCenterOffset([0, 0]) }, [view])

  function changeView(r: Region) { setView(r); setZoom(1); setCenterOffset([0, 0]) }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function onMapMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    setIsPanning(true)
    hasMoved.current = false
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
      {/* Contrôles */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {REGIONS.map(r => (
          <button
            key={r.label}
            onClick={() => changeView(r)}
            style={{
              fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid',
              borderColor: view.label === r.label ? '#3b82f6' : '#cbd5e1',
              background: view.label === r.label ? '#eff6ff' : '#f8fafc',
              color: view.label === r.label ? '#1d4ed8' : '#475569',
              cursor: 'pointer', fontWeight: view.label === r.label ? 600 : 400,
            }}
          >
            {r.label}
          </button>
        ))}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          <button
            onClick={() => setZoom(z => Math.min(z * 1.6, 20))}
            style={{ fontSize: 16, width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >+</button>
          <button
            onClick={() => setZoom(z => Math.max(z / 1.6, 0.4))}
            style={{ fontSize: 16, width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#334155', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >−</button>
        </div>
      </div>

      {/* Carte avec drag */}
      <div
        style={{ cursor: isPanning && hasMoved.current ? 'grabbing' : 'grab', userSelect: 'none' }}
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
          <Sphere id="sphere" fill="#eef6fb" stroke="#cde4f0" strokeWidth={0.4} />
          <Graticule stroke="#cde4f0" strokeWidth={0.3} />
          <Geographies geography="/world-110m.json">
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#d4e8c0"
                  stroke="#b0cc96"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: '#c4d8b0' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Bulles pays */}
          {geoCntrs.map(({ code, visitors }) => {
            const c = centroids[code]
            if (!c) return null
            const r = Math.max(5, Math.sqrt(visitors / maxV) * 22)
            return (
              <Marker key={code} coordinates={c}>
                <circle
                  r={r}
                  fill="rgba(0,61,166,0.40)"
                  stroke="rgba(0,40,140,0.65)"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => { if (!hasMoved.current) onHover({ code, visitors }) }}
                  onMouseLeave={() => onHover(null)}
                />
              </Marker>
            )
          })}

          {/* Points utilisateurs individuels */}
          {geoUsers?.map((u, i) => (
            <Marker key={`u-${i}`} coordinates={[u.lon, u.lat]}>
              <circle
                r={5}
                fill="rgba(239,68,68,0.80)"
                stroke="rgba(185,28,28,0.95)"
                strokeWidth={1.2}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => { if (!hasMoved.current) onUserHover?.(u) }}
                onMouseLeave={() => onUserHover?.(null)}
              />
            </Marker>
          ))}
        </ComposableMap>
      </div>
    </div>
  )
}
