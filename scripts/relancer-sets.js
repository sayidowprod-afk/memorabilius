#!/usr/bin/env node
/**
 * Relance plusieurs sets TCDB d'un coup (page admin « Santé des sets » → « Tout relancer d'un coup »).
 *   node scripts/relancer-sets.js 2517 4108 4120 ...        (numéros TCDB, séparés par des espaces)
 *   node scripts/relancer-sets.js --fichier liste.txt        (un numéro ou une adresse TCDB par ligne)
 * Chaque set passe par ajouter-set-tcdb.js (même lecture, même import) : jamais destructif, seules les cartes qui manquent sont ajoutées.
 * UN SEUL Chrome pour toute la série (la même fenêtre, la même page) : le captcha de TCDB n'est à résoudre qu'une fois.
 * Aucune question n'est posée. Un set en échec est noté puis on passe au suivant.
 */
const fs = require('fs')
process.env.RELANCE_AUTO = '1'
process.env.SHOW_BROWSER = '1'
const { openBrowser, killChrome } = require('./browser-helper')
const { main } = require('./ajouter-set-tcdb.js')

let args = process.argv.slice(2)
const fi = args.indexOf('--fichier')
if (fi >= 0) { args = [...args.slice(0, fi), ...fs.readFileSync(args[fi + 1], 'utf8').split(/\r?\n/), ...args.slice(fi + 2)] }
const ids = [...new Set(args.map(a => String(a).trim()).filter(Boolean).map(a => (a.match(/sid\/(\d+)/) || a.match(/^(\d+)$/) || [])[1]).filter(Boolean))]
if (!ids.length) { console.error('Aucun numéro de set TCDB. Exemple : node scripts/relancer-sets.js 2517 4108'); process.exit(1) }

;(async () => {
  console.log('\nOuverture de Chrome (UNE seule fenêtre pour tous les sets : ne la ferme pas)...')
  const { page } = await openBrowser(1)
  const ok = [], ko = []
  const t0 = Date.now()
  try {
    for (let i = 0; i < ids.length; i++) {
      console.log(`\n========== [${i + 1}/${ids.length}] set TCDB ${ids[i]} ==========`)
      process.exitCode = 0
      try { await main('https://www.tcdb.com/ViewSet.cfm/sid/' + ids[i], page) } catch (e) { console.error('❌ ' + e.message); process.exitCode = 1 }
      if (process.exitCode) ko.push(ids[i]); else ok.push(ids[i])
    }
  } finally { try { killChrome(1) } catch { /* déjà fermé */ } }
  process.exitCode = 0
  console.log(`\n========== Terminé en ${Math.round((Date.now() - t0) / 60000)} min : ${ok.length} relancé(s) sans erreur, ${ko.length} en erreur ==========`)
  if (ko.length) console.log('En erreur (à relancer plus tard) : node scripts/relancer-sets.js ' + ko.join(' '))
  process.exit(0)
})()
