import { NextRequest, NextResponse } from 'next/server'
import { rateLimited } from '@/lib/publicRateLimit'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()

const SKIP = /^\/(admin|api|_next|favicon)/

export async function POST(req: NextRequest) {
  if (rateLimited(req, 'track-view', 120, 60000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  try {
    const { path, token, src, referrer } = await req.json() as { path?: string; token?: string; src?: string; referrer?: string }
    const cleanSrc = src ? String(src).replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 60) : null
    const cleanRef = referrer ? String(referrer).slice(0, 120) : null
    const country = (req.headers.get('x-vercel-ip-country') || 'XX').slice(0, 2).toUpperCase()

    if (path && !SKIP.test(path)) {
      // colonnes src / referrer ajoutées par la migration 20261123 : tant qu'elle manque, on enregistre comme avant
      const { error: e1 } = await admin.from('page_views').insert({ path: path.slice(0, 255), country, ...(cleanSrc ? { src: cleanSrc, referrer: cleanRef } : {}) })
      if (e1 && cleanSrc) await admin.from('page_views').insert({ path: path.slice(0, 255), country })
    }

    if (token && country !== 'XX') {
      const { data: { user } } = await admin.auth.getUser(token)
      if (user?.id) {
        // première source du membre (jamais écrasée)
        if (cleanSrc) await admin.from('user_sources').upsert({ user_id: user.id, src: cleanSrc, referrer: cleanRef, landing: path ? path.slice(0, 120) : null }, { onConflict: 'user_id', ignoreDuplicates: true })
        const latRaw = req.headers.get('x-vercel-ip-latitude')
        const lonRaw = req.headers.get('x-vercel-ip-longitude')
        const lat = latRaw ? parseFloat(latRaw) : null
        const lon = lonRaw ? parseFloat(lonRaw) : null
        await admin.from('user_countries').upsert(
          { user_id: user.id, country, lat, lon, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      }
    }
  } catch {}
  return NextResponse.json({ ok: true })
}
