#!/usr/bin/env node
/**
 * Supprime des checkpoints les sets qui ont 0 cartes (buggés lors des CAPTCHAs),
 * et vide doneYears pour que ces années soient re-visitées.
 *
 * Usage: node scripts/cleanup-checkpoints.js
 */
const fs   = require('fs')
const path = require('path')

const CHECKPOINTS = [
  'checkpoint-all.json',
  'checkpoint-all-baseball.json',
  'checkpoint-all-hockey.json',
  'checkpoint-all-mma.json',
  'checkpoint-all-nfl.json',
  'checkpoint-all-racing.json',
  'checkpoint-all-soccer-international.json',
].map(f => path.join(__dirname, f))

const DATA_DIR = path.join(__dirname, 'year-data')

// Construit un map tcdb_id → nombre de cartes depuis les fichiers year-data
const cardCount = new Map()
for (const file of fs.readdirSync(DATA_DIR)) {
  if (!file.endsWith('.json')) continue
  try {
    const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
    const sets = Array.isArray(d.sets) ? d.sets : (Array.isArray(d) ? d : [])
    for (const s of sets) {
      const id  = s.set?.tcdb_id
      const cnt = Array.isArray(s.unique) ? s.unique.length : 0
      if (id) cardCount.set(id, (cardCount.get(id) || 0) + cnt)
    }
  } catch {}
}

for (const cpPath of CHECKPOINTS) {
  if (!fs.existsSync(cpPath)) continue
  let cp
  try { cp = JSON.parse(fs.readFileSync(cpPath, 'utf8')) }
  catch { continue }

  const before = (cp.doneTcdbIds || []).length
  // Retire les sets avec 0 cartes (présents dans year-data mais vides)
  cp.doneTcdbIds = (cp.doneTcdbIds || []).filter(id => {
    if (!cardCount.has(id)) return true   // pas de fichier → garder (jamais scrappé)
    return cardCount.get(id) > 0          // 0 cartes → retirer pour re-scraper
  })
  const removed = before - cp.doneTcdbIds.length

  // Vide doneYears pour que toutes les années soient re-visitées
  // (les sets déjà OK dans doneTcdbIds seront juste skippés rapidement)
  const yearsBefore = (cp.doneYears || []).length
  cp.doneYears = []

  fs.writeFileSync(cpPath, JSON.stringify(cp, null, 2))
  console.log(`✅ ${path.basename(cpPath)}: ${removed} sets 0-carte retirés, ${yearsBefore} années réinitialisées`)
}

console.log('\n🎯 Prêt — relance les scripts de scrape, ils re-visiteront toutes les années')
console.log('   et re-scraperront uniquement les sets qui avaient 0 cartes.')
