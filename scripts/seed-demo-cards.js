#!/usr/bin/env node
// Peuple le compte demo (salons de cartes, /admin/demo) avec un echantillon
// de ~500 cartes prises dans de nombreuses galeries reelles, pour donner un
// aperçu varie et impressionnant de la plateforme. Exclut :
// - les cartes marquees privees par leur proprietaire (table cartes_privees)
// - les profils sans display_name (comptes non etablis)
// - le compte demo lui-meme
// Limite le nombre de cartes prises par utilisateur source pour repartir sur
// "beaucoup de galeries" plutot que vider une seule collection.
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DEMO_EMAIL = 'demo@memorabilius.fr'
const TARGET_TOTAL = 500
const MAX_PER_USER = 6
const MIN_SPECIAL_RATIO = 0.5 // auto, patch ou num

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(url, key)

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

async function main() {
  const { data: demoProfile } = await admin.from('profiles').select('id').eq('is_demo', true).single()
  if (!demoProfile) { console.error('Compte demo introuvable -- lance create-demo-account.js d\'abord.'); process.exit(1) }
  const demoId = demoProfile.id
  console.log('Compte demo:', demoId)

  // Nettoie les cartes demo existantes pour permettre de relancer le script proprement.
  const { error: delErr } = await admin.from('cartes_manuelles').delete().eq('user_id', demoId)
  if (delErr) console.error('Erreur nettoyage prealable:', delErr.message)

  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .not('display_name', 'is', null)
    .neq('display_name', '')
    .eq('is_demo', false)
  const realUserIds = new Set((profiles || []).map(p => p.id))
  console.log('Profils reels eligibles:', realUserIds.size)

  const { data: privees } = await admin.from('cartes_privees').select('user_id, card_key')
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
  console.log('Cartes privees exclues:', privateSet.size)

  const COLUMNS = 'id, user_id, nom, equipe, annee, collection, variation, num, rc, auto, patch, image_recto, image_verso, marque, position, collection_tag, is_horizontal, format, card_number, image_recto_hd, image_verso_hd'

  const special = []
  const normal = []
  const perUserCount = new Map()
  const pageSize = 1000
  let from = 0
  // Pagine sur toute la table pour avoir un vrai echantillon large, pas
  // seulement les 1000 premieres lignes (ordre non garanti utile ici).
  for (let page = 0; page < 20; page++) {
    const { data: batch, error } = await admin
      .from('cartes_manuelles')
      .select(COLUMNS)
      .not('image_recto', 'is', null)
      .range(from, from + pageSize - 1)
    if (error) { console.error('Erreur lecture cartes_manuelles:', error.message); break }
    if (!batch || batch.length === 0) break
    for (const c of batch) {
      if (!realUserIds.has(c.user_id)) continue
      if (privateSet.has(`${c.user_id}::${c.image_recto}`)) continue
      const count = perUserCount.get(c.user_id) || 0
      if (count >= MAX_PER_USER) continue
      perUserCount.set(c.user_id, count + 1)
      const isSpecial = c.auto || c.patch || (c.num && String(c.num).trim() !== '')
      ;(isSpecial ? special : normal).push(c)
    }
    from += pageSize
    if (batch.length < pageSize) break
  }
  console.log(`Candidats: ${special.length} speciales, ${normal.length} normales`)

  shuffle(special)
  shuffle(normal)

  const targetSpecial = Math.ceil(TARGET_TOTAL * MIN_SPECIAL_RATIO)
  const chosenSpecial = special.slice(0, targetSpecial)
  const remaining = TARGET_TOTAL - chosenSpecial.length
  const chosenNormal = normal.slice(0, remaining)
  const chosen = shuffle([...chosenSpecial, ...chosenNormal])

  console.log(`Selection finale: ${chosen.length} cartes (${chosenSpecial.length} speciales)`)

  const rows = chosen.map(c => ({
    user_id: demoId,
    nom: c.nom,
    equipe: c.equipe,
    annee: c.annee,
    collection: c.collection,
    variation: c.variation,
    num: c.num,
    rc: c.rc,
    auto: c.auto,
    patch: c.patch,
    image_recto: c.image_recto,
    image_verso: c.image_verso,
    marque: c.marque,
    position: c.position,
    is_horizontal: c.is_horizontal,
    format: c.format,
    card_number: c.card_number,
    image_recto_hd: c.image_recto_hd,
    image_verso_hd: c.image_verso_hd,
    // collection_tag / valeur / liens de vente / storage_* volontairement
    // omis : specifiques au proprietaire d'origine, sans sens pour la demo.
  }))

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const { error } = await admin.from('cartes_manuelles').insert(slice)
    if (error) { console.error('Erreur insertion:', error.message); process.exit(1) }
    console.log(`Insere ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }

  console.log('Termine.')
}

main()
