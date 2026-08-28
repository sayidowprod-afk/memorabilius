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

// 270s (proche de maxDuration=300) donnait un retour utilisateur trop rare
// (plusieurs minutes de silence par appel, percu comme "rien ne se passe").
// 40s : retour frequent, tout en traitant encore plusieurs pages par appel.
const DEADLINE_MS = 40_000
const PAGE_SIZE = 500
// sampleError="fetch failed" confirme que c'est le TELECHARGEMENT de l'image
// source qui echoue en masse (pas l'envoi vers R2) -- l'hebergeur des photos
// (Supabase Storage / divers hotes tiers pour les cartes importees par CSV)
// limite le debit sous forte concurrence. Redescendu fortement (15 -> 5) et
// retry avec un delai plus long.
const CONCURRENCY = 5

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

async function processUrl(url: string, results: { images: number; alreadyPresent: number; skipped: number; errors: number; sampleError?: string }) {
  const pathMatch = url.match(/\/object\/public\/(.+)$/)
  if (!pathMatch) { results.skipped++; return }
  const r2Key = `storage/${pathMatch[1]}`

  // Retries avec delai croissant : "fetch failed" en masse pointe vers un
  // rate-limit de l'hebergeur des photos source (Supabase Storage ou hote
  // tiers pour les cartes CSV) sous forte concurrence, pas un probleme R2 --
  // un delai plus long entre essais laisse la limite se lever.
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (await existsInR2(r2Key)) { results.alreadyPresent++; return }

      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`fetch ${res.status}`)

      const buf = Buffer.from(await res.arrayBuffer())
      await upload(r2Key, buf, res.headers.get('content-type') || 'image/jpeg')
      results.images++
      return
    } catch (e) {
      lastErr = e
      if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
    }
  }
  results.errors++
  // Un seul exemple garde par reponse (pas un par erreur) pour diagnostiquer
  // sans noyer le JSON. "fetch failed" (undici) est un message generique qui
  // masque la vraie cause reseau (ECONNRESET, ETIMEDOUT...) -- on l'inclut via
  // .cause quand disponible.
  if (!results.sampleError) {
    const cause = lastErr instanceof Error && 'cause' in lastErr ? (lastErr as any).cause : undefined
    const causeStr = cause ? ` (cause: ${cause?.code || cause?.message || String(cause)})` : ''
    results.sampleError = (lastErr instanceof Error ? lastErr.message : String(lastErr)) + causeStr
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

  const results: { cardsProcessed: number; images: number; alreadyPresent: number; skipped: number; errors: number; sampleError?: string } =
    { cardsProcessed: 0, images: 0, alreadyPresent: 0, skipped: 0, errors: 0 }
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
