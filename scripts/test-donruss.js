#!/usr/bin/env node
// Test ciblé: 2024-25 Donruss (sid 484153) toutes équipes + inserts
const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TCDB = 'https://www.tcdb.com'
const SID = 484153
const SET_NAME = '2024-25 Donruss'
const DELAY = 1000

const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null
const sleep = ms => new Promise(r => setTimeout(r, ms))

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

async function waitCF(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 15; i++) {
    const t = await page.title()
    if (!t.includes('instant') && !t.includes('moment')) break
    await sleep(2000)
  }
}

// Parser de lignes de carte — robuste, cherche dans toutes les cellules
function parseCardRow(tds) {
  let cardNum = null
  let playerName = null
  let team = null

  for (const td of tds) {
    const rawText = td.textContent?.trim() || ''
    const linkText = td.querySelector?.('a')?.textContent?.trim() || null

    // Numéro de carte : cellule courte qui commence par un chiffre
    if (!cardNum && /^\d+[a-zA-Z]?$/.test(rawText) && rawText.length <= 5) {
      cardNum = rawText
      continue
    }

    // Joueur : cellule avec un <a> dont le texte est alphabétique > 3 chars
    if (!playerName && linkText && linkText.length > 3 && /[a-zA-Z]/.test(linkText) && !/^\d/.test(linkText)) {
      // Ignorer les noms d'équipes (liens équipe viennent après)
      playerName = linkText
      continue
    }

    // Équipe : deuxième lien alphabétique > 3 chars (après le joueur)
    if (playerName && !team && linkText && linkText.length > 3 && /[a-zA-Z]/.test(linkText) && !/^\d/.test(linkText)) {
      team = linkText
    }
  }

  return { cardNum, playerName, team }
}

async function main() {
  console.log(`🏀 Test: ${SET_NAME} — toutes équipes + inserts`)

  const browser = await puppeteerExtra.launch({
    executablePath: findChrome(),
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--window-size=1280,900'],
  })
  const page = await browser.newPage()

  try {
    await waitCF(page, TCDB)
    await sleep(2000)
    console.log('✓ Cloudflare OK\n')

    // 1. Récupérer la liste des équipes
    console.log('📂 Récupération des équipes...')
    await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${SID}/2024-25-Donruss`)
    await sleep(800)

    // Équipes NBA actives uniquement (pas les anciennes franchises ni équipes college)
    const NBA_TEAMS = new Set([
      'Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets','Chicago Bulls',
      'Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons',
      'Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers',
      'Los Angeles Lakers','Memphis Grizzlies','Miami Heat','Milwaukee Bucks',
      'Minnesota Timberwolves','New Orleans Pelicans','New York Knicks',
      'Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns',
      'Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors',
      'Utah Jazz','Washington Wizards',
    ])

    const teams = await page.evaluate((tcdb) => {
      const results = []
      const seen = new Set()
      document.querySelectorAll('a[href*="/team/"]').forEach(a => {
        const href = a.getAttribute('href') || ''
        const m = href.match(/\/team\/(\d+)\/(.+)/)
        if (!m || seen.has(m[1])) return
        seen.add(m[1])
        results.push({
          teamId: m[1],
          teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')),
        })
      })
      return results
    }, TCDB)

    const filteredTeams = teams.filter(t => NBA_TEAMS.has(t.teamName))
    console.log(`   ${teams.length} équipes trouvées, ${filteredTeams.length} équipes NBA retenues\n`)

    console.log(`   ${teams.length} équipes trouvées\n`)
    if (!filteredTeams.length) { await browser.close(); return }

    // 2. Pour chaque équipe, parser ViewTeamsIns
    const allCards = []

    for (let i = 0; i < filteredTeams.length; i++) {
      const { teamId, teamName } = filteredTeams[i]
      const encoded = encodeURIComponent(teamName)
      const url = `${TCDB}/ViewTeamsIns.cfm/sid/${SID}/team/${teamId}/${encoded}`
      process.stdout.write(`[${i+1}/${filteredTeams.length}] ${teamName}... `)

      await waitCF(page, url)
      await sleep(600)

      const cards = await page.evaluate(() => {
        const cards = []
        let currentVariation = null
        let inInserts = false

        // Parcourir tous les éléments dans l'ordre du DOM
        // On utilise TreeWalker pour respecter l'ordre document
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode(node) {
              const tag = node.tagName
              if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
              if (['H3','H2','STRONG','TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
              return NodeFilter.FILTER_SKIP
            }
          }
        )

        while (walker.nextNode()) {
          const el = walker.currentNode
          const tag = el.tagName
          const text = el.textContent?.trim() || ''

          // H3 = section principale
          if (tag === 'H3' || tag === 'H2') {
            if (/^base cards?$/i.test(text)) {
              currentVariation = null
              inInserts = false
            } else if (/^inserts and related/i.test(text)) {
              inInserts = true
              currentVariation = null
            }
            continue
          }

          // STRONG dans la section inserts = nom du sous-set
          if (tag === 'STRONG' && inInserts) {
            if (text && text.length < 100 && !/^\d+\s*record/i.test(text)) {
              currentVariation = text
            }
            continue
          }

          // TR = potentielle ligne de carte
          if (tag === 'TR') {
            const tds = Array.from(el.querySelectorAll('td'))
            if (tds.length < 2) continue

            // Chercher numéro, joueur, équipe dans les cellules
            let cardNum = null
            let playerName = null
            let team = null

            for (const td of tds) {
              const rawText = td.textContent?.trim() || ''
              const linkEl = td.querySelector('a')
              const linkText = linkEl?.textContent?.trim() || null

              // Numéro : court, commence par chiffre
              if (!cardNum && /^\d+[a-zA-Z]?$/.test(rawText) && rawText.length <= 6) {
                cardNum = rawText
                continue
              }
              // Joueur : premier lien alphanumérique non-chiffre > 3 chars
              if (!playerName && linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText)) {
                playerName = linkText
                continue
              }
              // Équipe : deuxième lien similaire
              if (playerName && !team && linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText)) {
                team = linkText
              }
            }

            if (!cardNum || !playerName) continue

            // Flags RC / Auto dans le texte brut du row
            const rowText = el.textContent || ''
            const isRc = /\bRC\b/.test(rowText)
            const isAuto = /\bAU\b/.test(rowText)

            cards.push({
              card_number: cardNum,
              player_name: playerName,
              team: team || null,
              variation: currentVariation || null,
              is_rc: isRc,
              is_auto: isAuto,
            })
          }
        }

        return cards
      })

      allCards.push(...cards)
      const base = cards.filter(c => !c.variation).length
      const inserts = cards.filter(c => c.variation).length
      console.log(`${cards.length} cartes (${base} base, ${inserts} inserts)`)
      await sleep(DELAY)
    }

    console.log(`\n📊 Total brut: ${allCards.length} entrées`)

    // Dédupliquer
    const seen = new Set()
    const unique = allCards.filter(c => {
      const k = `${c.card_number}|${c.player_name}|${c.variation || ''}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    console.log(`   Après dédup: ${unique.length} cartes uniques`)

    // Aperçu
    console.log('\nAperçu (20 premières):')
    unique.slice(0, 20).forEach(c =>
      console.log(`  #${c.card_number} ${c.player_name} | ${c.team || '?'} | ${c.variation || 'Base'}${c.is_rc ? ' [RC]' : ''}`)
    )

    // Variations trouvées
    const variations = [...new Set(unique.map(c => c.variation || 'Base'))].sort()
    console.log(`\n${variations.length} variations/inserts:`)
    variations.forEach(v => {
      const count = unique.filter(c => (c.variation || 'Base') === v).length
      console.log(`  ${v}: ${count} cartes`)
    })

    // Insérer en base
    if (!process.argv.includes('--save')) {
      console.log('\n💡 Ajoutez --save pour insérer en base de données')
      await browser.close()
      return
    }

    if (!supabase) { console.log('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants'); await browser.close(); return }
    console.log('\n💾 Insertion en base...')
    const { data: setData, error: setErr } = await supabase
      .from('card_sets')
      .upsert({ tcdb_id: SID, name: SET_NAME, year: 2024, brand: 'Panini', sport: 'nba', total_cards: unique.length }, { onConflict: 'tcdb_id' })
      .select('id').single()
    if (setErr) throw new Error(setErr.message)

    await supabase.from('card_set_entries').delete().eq('set_id', setData.id)

    for (let i = 0; i < unique.length; i += 500) {
      const batch = unique.slice(i, i + 500).map(c => ({ set_id: setData.id, ...c }))
      const { error } = await supabase.from('card_set_entries').insert(batch)
      if (error) throw new Error(error.message)
    }

    console.log(`✅ ${unique.length} cartes insérées (set id: ${setData.id})`)

  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
