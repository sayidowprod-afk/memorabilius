'use client'
import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker, Graticule, Sphere } from 'react-simple-maps'

type GeoEntry = { code: string; visitors: number }

interface Props {
  geoCntrs: GeoEntry[]
  centroids: Record<string, [number, number]>
  onHover: (entry: GeoEntry | null) => void
  geoUsers?: { lat: number; lon: number }[]
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

export default function GeoMap({ geoCntrs, centroids, onHover, geoUsers }: Props) {
  const [view, setView] = useState<Region>(REGIONS[0])
  const [zoom, setZoom] = useState(1)

  const maxV = geoCntrs.length ? Math.max(...geoCntrs.map(c => c.visitors)) : 1
  const effectiveScale = view.scale * zoom

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        {REGIONS.map(r => (
          <button
            key={r.label}
            onClick={() => { setView(r); setZoom(1) }}
            style={{
              fontSize: 11,
              padding: '3px 9px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: view.label === r.label ? '#3b82f6' : '#cbd5e1',
              background: view.label === r.label ? '#eff6ff' : '#f8fafc',
              color: view.label === r.label ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
              fontWeight: view.label === r.label ? 600 : 400,
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

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: effectiveScale, center: view.center }}
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
                onMouseEnter={() => onHover({ code, visitors })}
                onMouseLeave={() => onHover(null)}
              />
            </Marker>
          )
        })}
        {geoUsers?.map((u, i) => (
          <Marker key={`u-${i}`} coordinates={[u.lon, u.lat]}>
            <circle r={4} fill="rgba(239,68,68,0.75)" stroke="rgba(185,28,28,0.9)" strokeWidth={1} />
          </Marker>
        ))}
      </ComposableMap>
    </div>
  )
}
