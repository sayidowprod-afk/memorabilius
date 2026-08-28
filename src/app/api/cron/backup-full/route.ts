import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// Rattrapage ponctuel (a appeler a la main, pas un cron planifie) : le backup
// quotidien (/api/cron/backup) ne regardait que les dernieres 26h et a eu un
// bug qui l'a empeche de sauvegarder la moindre image depuis sa creation --
// cette route balaie TOUTE la table par lots resumables et ne re-televerse
// que ce qui manque encore sur R2 (HeadObject avant PutObject). Pas de
// backfill possible pour les snapshots quotidiens de metadonnees (l'etat
// passe jour par jour n'existe plus, seul l'etat actuel est disponible) --
// seules les images, dont l'URL source est toujours valide, sont rattrapables.
//
// Boucle en interne sur plusieurs pages jusqu'a une deadline (au lieu de
// traiter UNE page par appel HTTP) : avec des dizaines de milliers de cartes,
// faire boucler le CLIENT (curl/PowerShell) sur chaque page etait fragile
// (encodage d'URL du curseur, oubli de relancer...) pour un gain nul --
// autant faire tout le travail resumable ici, un seul appel suffit dans la
// grande majorite des cas, et sinon rappeler avec nextCursor termine le reste.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const DEADLINE_MS = 270_000 // marge sous maxDuration=300 pour finir proprement
const PAGE_SIZE = 500
const CONCURRENCY = 40

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

async function existsInR2(key: string): Promise<boolean> {
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: process.env.CF_R2_BUCKET || 'memorabilius-backup', Key: key }))
    return true
  } catch {
    return false
  }
}

async function upload(key: string, body: Buffer, contentType = 'application/octet-stream') {
  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.CF_R2_BUCKET || 'memorabilius-backup',
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

async function processUrl(url: string, results: { images: number; alreadyPresent: number; skipped: number; errors: number }) {
  try {
    const pathMatch = url.match(/\/object\/public\/(.+)$/)
    if (!pathMatch) { results.skipped++; return }
    const r2Key = `storage/${pathMatch[1]}`

    if (await existsInR2(r2Key)) { results.alreadyPresent++; return }

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) { results.errors++; return }

    const buf = Buffer.from(await res.arrayBuffer())
    await upload(r2Key, buf, res.headers.get('content-type') || 'image/jpeg')
    results.images++
  } catch {
    results.errors++
  }
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.CF_R2_ACCOUNT_ID || !process.env.CF_R2_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'R2 credentials not configured' }, { status: 503 })
  }

  let cursor = req.nextUrl.searchParams.get('cursor') || '1970-01-01T00:00:00.000Z'
  const start = Date.now()

  const results = { cardsProcessed: 0, images: 0, alreadyPresent: 0, skipped: 0, errors: 0 }
  let done = false

  while (Date.now() - start < DEADLINE_MS) {
    const { data: batch } = await supabase
      .from('cartes_manuelles')
      .select('id, created_at, image_recto, image_verso')
      .gt('created_at', cursor)
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE)

    if (!batch?.length) { done = true; break }

    const urls = [...new Set([
      ...batch.map(c => c.image_recto).filter(Boolean),
      ...batch.map(c => c.image_verso).filter(Boolean),
    ])] as string[]

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      await Promise.all(urls.slice(i, i + CONCURRENCY).map(url => processUrl(url, results)))
    }

    results.cardsProcessed += batch.length
    cursor = batch[batch.length - 1].created_at

    if (batch.length < PAGE_SIZE) { done = true; break }
  }

  return NextResponse.json({ done, ...results, nextCursor: done ? null : cursor })
}
