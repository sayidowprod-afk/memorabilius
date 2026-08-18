import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import fs from 'fs'
import path from 'path'
import { computeWeeklyRecap } from '@/lib/weeklyRecap'
import { isSafeExternalUrl } from '@/lib/safeUrl'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

let LOGO_B64: string | null = null
try {
  LOGO_B64 = 'data:image/png;base64,' + fs.readFileSync(path.join(process.cwd(), 'public', 'memorabilius-logo-white.png')).toString('base64')
} catch {}

async function fetchAsB64(url: string): Promise<string | null> {
  if (!isSafeExternalUrl(url)) return null
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const ct = r.headers.get('content-type') || 'image/jpeg'
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch { return null }
}

const medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`

// Hebdo (lundi matin) : classement de la semaine (le plus de cartes ajoutées)
// + belles cartes de la semaine (le plus de likes reçus), rendu en image et
// posté sur Instagram si les identifiants sont configurés (IG_ACCESS_TOKEN +
// IG_BUSINESS_ACCOUNT_ID) — sinon envoyé par email à l'admin pour poster
// manuellement en attendant.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekEnd = new Date()
  weekEnd.setHours(0, 0, 0, 0)
  const day = weekEnd.getDay() || 7
  weekEnd.setDate(weekEnd.getDate() - day + 1) // ce lundi
  const weekStart = new Date(weekEnd)
  weekStart.setDate(weekStart.getDate() - 7) // lundi précédent

  const { topCollectors, topCards } = await computeWeeklyRecap(supabase, weekStart, weekEnd)
  if (topCollectors.length === 0 && topCards.length === 0) {
    return NextResponse.json({ skipped: 'Aucune activité cette semaine' })
  }

  const [collectorAvatars, cardImages] = await Promise.all([
    Promise.all(topCollectors.map(c => c.avatarUrl ? fetchAsB64(c.avatarUrl) : Promise.resolve(null))),
    Promise.all(topCards.map(c => fetchAsB64(c.image))),
  ])

  const BG = '#060d22'
  const ACCENT = '#003DA6'
  const weekLabel = `${weekStart.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', padding: '44px 44px 36px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          {LOGO_B64
            ? <img src={LOGO_B64} width={160} height={32} style={{ objectFit: 'contain', opacity: 0.9 }} />
            : <div style={{ color: 'white', fontWeight: 900, fontSize: 18, display: 'flex' }}>MEMORABILIUS</div>}
          <div style={{ color: 'white', fontSize: 18, fontWeight: 700, display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 18px' }}>{weekLabel}</div>
        </div>

        {topCollectors.length > 0 && (
          <>
            <div style={{ color: 'white', fontSize: 26, fontWeight: 900, display: 'flex', marginBottom: 16 }}>🏆 Classement de la semaine</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {topCollectors.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '10px 16px' }}>
                  <div style={{ display: 'flex', fontSize: 22, width: 36 }}>{medal(i)}</div>
                  {collectorAvatars[i]
                    ? <img src={collectorAvatars[i]!} width={40} height={40} style={{ borderRadius: 20, objectFit: 'cover' }} />
                    : <div style={{ width: 40, height: 40, borderRadius: 20, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900 }}>{c.name[0]?.toUpperCase()}</div>}
                  <div style={{ display: 'flex', flex: 1, color: 'white', fontWeight: 700, fontSize: 18 }}>{c.name}</div>
                  <div style={{ display: 'flex', color: '#5B9FFF', fontWeight: 900, fontSize: 18 }}>+{c.count}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {topCards.length > 0 && (
          <>
            <div style={{ color: 'white', fontSize: 26, fontWeight: 900, display: 'flex', marginBottom: 16 }}>💎 Belles cartes de la semaine</div>
            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
              {topCards.map((c, i) => (
                <div key={c.image} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ flex: 1, display: 'flex', background: '#0d1a30', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {cardImages[i] && <img src={cardImages[i]!} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                  </div>
                  <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 11, justifyContent: 'center' }}>❤️ {c.likes}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, display: 'flex' }}>memorabilius.fr</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )

  const buffer = Buffer.from(await image.arrayBuffer())
  const fileName = `weekly-recap-${weekStart.toISOString().slice(0, 10)}.png`
  const { error: uploadError } = await supabase.storage.from('social-recaps').upload(fileName, buffer, { contentType: 'image/png', upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: pub } = supabase.storage.from('social-recaps').getPublicUrl(fileName)
  const publicUrl = pub.publicUrl

  let posted = false
  if (process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ACCOUNT_ID) {
    try {
      const caption = `🏆 Classement de la semaine (${weekLabel}) et les plus belles cartes ajoutées sur Memorabilius ! 🃏\n\n#tradingcards #memorabilius`
      const containerRes = await fetch(`https://graph.facebook.com/v20.0/${process.env.IG_BUSINESS_ACCOUNT_ID}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: publicUrl, caption, access_token: process.env.IG_ACCESS_TOKEN }),
      })
      const container = await containerRes.json()
      if (container.id) {
        await fetch(`https://graph.facebook.com/v20.0/${process.env.IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: container.id, access_token: process.env.IG_ACCESS_TOKEN }),
        })
        posted = true
      }
    } catch (e) {
      console.error('[weekly-recap] Échec de la publication Instagram:', e)
    }
  }

  if (!posted && process.env.ADMIN_EMAIL) {
    await getResend().emails.send({
      from: 'Memorabilius <contact@memorabilius.fr>',
      to: process.env.ADMIN_EMAIL,
      subject: `📸 Récap de la semaine prêt à poster (${weekLabel})`,
      html: `<p>Le récap de la semaine est prêt, Instagram n'est pas encore configuré donc à poster à la main :</p><p><a href="${publicUrl}">${publicUrl}</a></p><img src="${publicUrl}" style="max-width:400px" />`,
    })
  }

  return NextResponse.json({ ok: true, posted, publicUrl })
}
