#!/usr/bin/env node
/**
 * Reheberge sur le storage Memorabilius les cartes deja converties AVANT
 * l'ajout du rehebergement automatique dans /api/convert-csv-cards -- ces
 * cartes pointent encore vers l'hebergeur d'origine (ibb.co ou autre) au lieu
 * du storage Supabase. Retelecharge chaque image et met a jour la ligne, en
 * qualite originale (aucune compression).
 *
 * Usage:
 *   node scripts/rehost-csv-cards.js --user="Nom du collectionneur"   # simulation
 *   node scripts/rehost-csv-cards.js --user="Nom du collectionneur" --apply
 *   node scripts/rehost-csv-cards.js --all --apply                    # tous les profils concernes
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')
const ALL = process.argv.includes('--all')
const USER = (process.argv.find(a => a.startsWith('--user=')) || '').split('=').slice(1).join('=')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`
const CONCURRENCY = 6

async function resolveUserIds() {
  if (ALL) {
    const { data, error } = await admin.from('cartes_manuelles').select('user_id').not('image_recto', 'ilike', `${STORAGE_PREFIX}%`)
    if (error) throw error
    return [...new Set((data || []).map(r => r.user_id))]
  }
  if (!USER) throw new Error('Precise --user="Nom" ou --all')
  const { data, error } = await admin.from('profiles').select('id, display_name').ilike('display_name', `%${USER}%`).limit(5)
  if (error) throw error
  if (!data?.length) throw new Error(`Aucun profil ne correspond a "${USER}"`)
  if (data.length > 1) throw new Error(`Plusieurs profils correspondent : ${data.map(p => p.display_name).join(', ')} -- precise davantage`)
  console.log(`Profil : ${data[0].display_name} (${data[0].id})`)
  return [data[0].id]
}

async function fetchImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer, contentType }
  } catch { return null }
}
const extOf = ct => ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'jpg'

async function rehostForUser(userId) {
  const { data: rows, error } = await admin.from('cartes_manuelles')
    .select('id, nom, image_recto, image_verso')
    .eq('user_id', userId)
    .not('image_recto', 'ilike', `${STORAGE_PREFIX}%`)
  if (error) throw error
  if (!rows.length) { console.log(`  0 carte a reheberger`); return }
  console.log(`  ${rows.length} carte(s) a reheberger`)
  if (!APPLY) { rows.slice(0, 5).forEach(r => console.log(`    - ${r.nom}: ${r.image_recto}`)); if (rows.length > 5) console.log(`    ... et ${rows.length - 5} autres`); return }

  const urls = new Set()
  for (const r of rows) { if (r.image_recto) urls.add(r.image_recto); if (r.image_verso) urls.add(r.image_verso) }
  const resolved = new Map()
  let done = 0
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()
      const img = await fetchImage(url)
      done++
      if (!img) { console.log(`  ⚠️  echec telechargement : ${url}`); continue }
      const path = `cartes/${userId}/csv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extOf(img.contentType)}`
      const { error: upErr } = await admin.storage.from('avatars').upload(path, img.buffer, { contentType: img.contentType, upsert: true })
      if (upErr) { console.log(`  ⚠️  echec upload : ${url} (${upErr.message})`); continue }
      const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
      resolved.set(url, pub.publicUrl)
      if (done % 20 === 0) console.log(`    ${done}/${urls.size} images traitees`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  let updated = 0
  for (const r of rows) {
    const newRecto = resolved.get(r.image_recto)
    if (!newRecto) continue
    const patch = { image_recto: newRecto, image_recto_hd: newRecto }
    if (r.image_verso) { const nv = resolved.get(r.image_verso); if (nv) { patch.image_verso = nv; patch.image_verso_hd = nv } }
    const { error: updErr } = await admin.from('cartes_manuelles').update(patch).eq('id', r.id)
    if (!updErr) updated++
  }
  console.log(`  ✅ ${updated}/${rows.length} cartes mises a jour (${urls.size} images telechargees)`)
}

async function main() {
  const userIds = await resolveUserIds()
  console.log(`${userIds.length} profil(s) concerne(s)${APPLY ? '' : ' -- simulation, relance avec --apply'}`)
  for (const uid of userIds) {
    console.log(`\n👤 ${uid}`)
    await rehostForUser(uid)
  }
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1) })
