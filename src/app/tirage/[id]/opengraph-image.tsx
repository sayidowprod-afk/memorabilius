import { ImageResponse } from 'next/og'
import { loadSharedPull } from '@/lib/packShare'

export const runtime = 'nodejs'
export const alt = 'Un beau tirage sur Memorabilius'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await loadSharedPull(id)
  if (!c) {
    return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07143a', color: '#fff', fontSize: 64, fontWeight: 900 }}>Memorabilius</div>, { ...size })
  }
  const tags = [c.rc && 'RC', c.auto && 'AUTO', c.patch && 'PATCH', c.run && `/${c.run}`].filter(Boolean) as string[]
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #0d2257 0%, #030816 100%)', fontFamily: 'sans-serif', padding: '0 70px' }}>
        <div style={{ display: 'flex', width: 360, height: 504, border: `8px solid ${c.color}`, background: '#060f2c', boxShadow: `0 0 60px ${c.color}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 64, flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: c.color, textTransform: 'uppercase', letterSpacing: 3 }}>{`${c.pseudo} a tiré une carte ${c.rarityName}`}</div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 900, color: '#fff', lineHeight: 1, marginTop: 18 }}>{c.player}</div>
          <div style={{ display: 'flex', fontSize: 30, color: 'rgba(255,255,255,.75)', marginTop: 16 }}>{[c.team, [c.year, c.set].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', marginTop: 24 }}>
              {tags.map(t => <div key={t} style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: '#fff', border: '3px solid rgba(255,255,255,.5)', padding: '4px 14px', marginRight: 12 }}>{t}</div>)}
            </div>
          )}
          <div style={{ display: 'flex', fontSize: 26, color: '#fdb927', fontWeight: 800, marginTop: 40 }}>Un pack gratuit toutes les heures · memorabilius.fr</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
