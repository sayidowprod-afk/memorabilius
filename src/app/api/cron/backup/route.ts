import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    },
  })
}

async function upload(key: string, body: Buffer | string, contentType = 'application/octet-stream') {
  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.CF_R2_BUCKET || 'memorabilius-backup',
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.CF_R2_ACCOUNT_ID || !process.env.CF_R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 credentials not configured' }, { status: 503 })
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const since = new Date(Date.now() - 26 * 3600 * 1000).toISOString()
  const results = { images: 0, skipped: 0, errors: 0, db: 0 }

  // ── 1. Images modifiées dans les dernières 26h ──────────────────────────
  const { data: cards } = await supabase
    .from('cartes_manuelles')
    .select('image_recto, image_verso')
    .gte('updated_at', since)
    .limit(1500)

  const urls = [...new Set([
    ...(cards || []).map(c => c.image_recto).filter(Boolean),
    ...(cards || []).map(c => c.image_verso).filter(Boolean),
  ])] as string[]

  const BATCH = 12
  for (let i = 0; i < urls.length; i += BATCH) {
    await Promise.all(urls.slice(i, i + BATCH).map(async (url) => {
      try {
        const pathMatch = url.match(/\/object\/public\/(.+)$/)
        if (!pathMatch) { results.skipped++; return }
        const r2Key = `storage/${pathMatch[1]}`

        const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
        if (!res.ok) { results.errors++; return }

        const buf = Buffer.from(await res.arrayBuffer())
        await upload(r2Key, buf, res.headers.get('content-type') || 'image/jpeg')
        results.images++
      } catch {
        results.errors++
      }
    }))
  }

  // ── 2. Export DB — métadonnées cartes ──────────────────────────────────
  try {
    let allCards: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: batch } = await supabase
        .from('cartes_manuelles')
        .select('id, user_id, nom, annee, marque, collection, variation, rc, auto, patch, num, item_type, created_at, updated_at')
        .range(from, from + 999)
      if (!batch?.length) break
      allCards.push(...batch)
      if (batch.length < 1000) break
    }
    await upload(`db/${dateStr}/cartes_manuelles.json`, JSON.stringify(allCards), 'application/json')
    results.db++
  } catch { results.errors++ }

  // ── 3. Export DB — profils (sans données sensibles) ────────────────────
  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, stats_total, stats_rc, stats_auto, stats_num, stats_patch, created_at')
      .limit(10000)
    await upload(`db/${dateStr}/profiles.json`, JSON.stringify(profiles), 'application/json')
    results.db++
  } catch { results.errors++ }

  // ── 4. Export DB — classeurs ────────────────────────────────────────────
  try {
    const { data: classeurs } = await supabase
      .from('classeurs')
      .select('id, user_id, nom, description, created_at')
      .limit(10000)
    await upload(`db/${dateStr}/classeurs.json`, JSON.stringify(classeurs), 'application/json')
    results.db++
  } catch { results.errors++ }

  // ── 5. Fichier de contrôle (permet de savoir que le backup s'est bien passé) ─
  await upload(
    `db/${dateStr}/manifest.json`,
    JSON.stringify({ date: dateStr, completedAt: new Date().toISOString(), ...results }),
    'application/json'
  ).catch(() => {})

  return NextResponse.json({ ok: true, date: dateStr, ...results })
}
