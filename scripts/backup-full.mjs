/**
 * Backup intégral Supabase → Cloudflare R2
 * Usage : node scripts/backup-full.mjs
 *
 * Variables d'env requises (dans .env.local ou exportées) :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CF_R2_ACCOUNT_ID
 *   CF_R2_ACCESS_KEY_ID
 *   CF_R2_SECRET_ACCESS_KEY
 *   CF_R2_BUCKET   (défaut : memorabilius-backup)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Polyfill WebSocket pour Node.js < 22 (requis par @supabase/realtime-js)
if (typeof globalThis.WebSocket === 'undefined') {
  const { default: ws } = await import('ws')
  globalThis.WebSocket = ws
}

// ── Charger .env.local si présent ──────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
  }
}

const BUCKET    = process.env.CF_R2_BUCKET || 'memorabilius-backup'
const PROGRESS  = resolve(process.cwd(), 'scripts/.backup-progress.json')
const BATCH_IMG = 4    // images en parallèle (limité pour éviter les 429)
const PAGE      = 1000 // cartes par page Supabase

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.CF_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
  },
})

// ── Cache des images déjà sauvegardées (persisté sur R2 entre les runs) ───
// Toutes les pages sont re-scannées à chaque run (nécessaire pour détecter
// les nouvelles cartes ajoutées n'importe où) ; ce cache évite juste de
// re-uploader ce qui est déjà sur R2 (uploadUrl() vérifie done + HEAD R2).
let progress = { done: new Set(), errors: [] }
if (existsSync(PROGRESS)) {
  const p = JSON.parse(readFileSync(PROGRESS, 'utf8'))
  progress.done    = new Set(p.done || [])
  progress.errors  = p.errors || []
  console.log(`↩  Reprise : ${progress.done.size} images déjà sauvegardées`)
}

function saveProgress() {
  writeFileSync(PROGRESS, JSON.stringify({
    done:   [...progress.done],
    errors: progress.errors,
  }))
}

async function existsInR2(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch { return false }
}

async function uploadUrl(url) {
  const pathMatch = url.match(/\/object\/public\/(.+)$/)
  if (!pathMatch) return 'skip'
  const r2Key = `storage/${pathMatch[1]}`

  if (progress.done.has(r2Key)) return 'cached'
  if (await existsInR2(r2Key)) { progress.done.add(r2Key); return 'exists' }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (res.status === 429 || res.status === 544) {
        if (attempt < 3) { await new Promise(r => setTimeout(r, attempt * 3000)); continue }
        throw new Error(`HTTP ${res.status}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const buf = Buffer.from(await res.arrayBuffer())
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: buf,
        ContentType: res.headers.get('content-type') || 'image/jpeg',
      }))
      progress.done.add(r2Key)
      return 'uploaded'
    } catch (e) {
      if (attempt < 3 && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        await new Promise(r => setTimeout(r, attempt * 3000))
        continue
      }
      throw e
    }
  }
}

// ── Export DB complet ──────────────────────────────────────────────────────
async function exportTable(name, query) {
  process.stdout.write(`  Export ${name}… `)
  let all = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await query.range(from, from + PAGE - 1)
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
  }
  const key = `db/full/${name}.json`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key,
    Body: JSON.stringify(all),
    ContentType: 'application/json',
  }))
  console.log(`${all.length} lignes → ${key}`)
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('=== Backup intégral Memorabilius → R2 ===\n')

// 1. DB
console.log('① Export base de données…')
await exportTable('cartes_manuelles', supabase.from('cartes_manuelles')
  .select('*'))
await exportTable('profiles', supabase.from('profiles')
  .select('id,display_name,stats_total,stats_rc,stats_auto,stats_num,stats_patch,created_at'))
await exportTable('binders', supabase.from('binders')
  .select('id,user_id,name,created_at'))
console.log()

// 2. Images
console.log('② Backup images (reprise possible avec Ctrl+C + relance)…\n')

let pageNum = 0
let totalImages = 0, uploaded = 0, skipped = 0, errors = 0

while (true) {
  const { data: cards } = await supabase
    .from('cartes_manuelles')
    .select('image_recto, image_verso')
    .range(pageNum * PAGE, pageNum * PAGE + PAGE - 1)

  if (!cards?.length) break

  const urls = [...new Set([
    ...cards.map(c => c.image_recto).filter(Boolean),
    ...cards.map(c => c.image_verso).filter(Boolean),
  ])]

  totalImages += urls.length

  for (let i = 0; i < urls.length; i += BATCH_IMG) {
    const batch = urls.slice(i, i + BATCH_IMG)
    await Promise.all(batch.map(async url => {
      try {
        const res = await uploadUrl(url)
        if (res === 'uploaded') uploaded++
        else skipped++
      } catch (e) {
        errors++
        progress.errors.push({ url, err: e.message })
        process.stdout.write('✗')
      }
    }))
    process.stdout.write(`\r  Page ${pageNum + 1} | up:${uploaded} skip:${skipped} err:${errors}   `)
  }

  saveProgress()
  pageNum++
}

// ── Retry des erreurs précédentes ─────────────────────────────────────────
if (progress.errors.length > 0) {
  console.log(`\n⟳  Retry de ${progress.errors.length} image(s) en erreur…`)
  const toRetry = [...progress.errors]
  progress.errors = []
  for (const { url } of toRetry) {
    try {
      const res = await uploadUrl(url)
      if (res === 'uploaded') { uploaded++; process.stdout.write('✓') }
      else { skipped++; process.stdout.write('.') }
    } catch (e) {
      errors++
      progress.errors.push({ url, err: e.message })
      process.stdout.write('✗')
    }
  }
  saveProgress()
  console.log()
}

// Manifest final
await s3.send(new PutObjectCommand({
  Bucket: BUCKET,
  Key: 'db/full/manifest.json',
  Body: JSON.stringify({ completedAt: new Date().toISOString(), uploaded, skipped, errors }),
  ContentType: 'application/json',
}))

console.log(`\n\n✅ Terminé — ${uploaded} uploadées, ${skipped} déjà présentes, ${errors} erreurs`)
if (errors) console.log(`   Voir scripts/.backup-progress.json pour le détail des erreurs`)
