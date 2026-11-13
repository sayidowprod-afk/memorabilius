#!/usr/bin/env node
/**
 * Résumé d'un passage de « nouveaux sets » (scrape-checklistinsider.js --new-only) : lit le journal, liste les sets créés et envoie le résultat sur Discord.
 *   node scripts/resume-nouveaux-sets.js journal.txt            (affiche seulement)
 *   DISCORD_WEBHOOK_URL=... node scripts/resume-nouveaux-sets.js journal.txt
 */
const fs = require('fs')
const log = fs.readFileSync(process.argv[2] || 'nouveaux-sets.log', 'utf8').split(/\r?\n/)

const created = []
let current = null
for (const raw of log) {
  const line = raw.replace(/\r/g, '')
  const m = line.match(/^\s+(.+?) \[([^,\]]+), (\d{4})\] — (\d+) cartes/)
  if (m) { current = { name: m[1], sport: m[2], year: m[3], cards: parseInt(m[4]) }; continue }
  const c = line.match(/set créé \(id (\d+)\)/)
  if (c && current) { created.push({ ...current, id: c[1] }); current = null }
}
const errors = log.filter(l => /❌|Fatal/.test(l)).length

const lines = created.length
  ? ['📚 **Nouveaux sets ajoutés cette semaine : ' + created.length + '**', ...created.slice(0, 25).map(s => '• ' + s.name + ' (' + s.sport + ') · ' + s.cards + ' cartes · memorabilius.fr/setlist/' + s.id)]
  : ['📚 Nouveaux sets : rien de nouveau cette semaine.']
if (created.length > 25) lines.push('… et ' + (created.length - 25) + ' autres.')
if (errors) lines.push('⚠️ ' + errors + ' erreur(s) pendant le passage : à regarder dans le journal de l’exécution.')
const text = lines.join('\n')
console.log(text)

const hook = process.env.DISCORD_WEBHOOK_URL
if (hook) {
  fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900) }) })
    .then(r => { if (!r.ok) console.error('Discord : ' + r.status) })
    .catch(e => console.error('Discord : ' + e.message))
}
