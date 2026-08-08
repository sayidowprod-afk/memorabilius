'use client'
import { ComposableMap, Geographies, Geography, Marker, Graticule, Sphere } from 'react-simple-maps'

type GeoEntry = { code: string; visitors: number }

interface Props {
  geoCntrs: GeoEntry[]
  centroids: Record<string, [number, number]>
  onHover: (entry: GeoEntry | null) => void
}

export default function GeoMap({ geoCntrs, centroids, onHover }: Props) {
  const maxV = geoCntrs.length ? Math.max(...geoCntrs.map(c => c.visitors)) : 1

  return (
    <ComposableMap
      projection="geoNaturalEarth1"
      projectionConfig={{ scale: 153, center: [10, 10] }}
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
    </ComposableMap>
  )
}
