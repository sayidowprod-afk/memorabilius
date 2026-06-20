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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
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
    // Init Cloudflare
    await waitCF(page, TCDB)
    await sleep(2000)
    console.log('✓ Cloudflare OK\n')

    // 1. Récupérer la liste des équipes
    console.log('📂 Récupération des équipes...')
    await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${SID}/2024-25-Donruss`)
    await sleep(800)

    const teams = await page.evaluate((tcdb) => {
      const results = []
      document.querySelectorAll('a[href*="/team/"]').forEach(a => {
        const href = a.getAttribute('href') || ''
        const m = href.match(/\/team\/(\d+)\/(.+)/)
        if (!m) return
        results.push({
          teamId: m[1],
          teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')),
          href: href.startsWith('http') ? href : tcdb + href,
        })
      })
      return results
    }, TCDB)

    console.log(`   ${teams.length} équipes trouvées:`)
    teams.forEach(t => console.log(`   - ${t.teamName} (id:${t.teamId})`))

    if (teams.length === 0) {
      // Afficher la page pour debug
      const text = await page.evaluate(() => document.body.innerText.substring(0, 500))
      console.log('HTML:', text)
      await browser.close()
      return
    }

    // 2. Pour chaque équipe: ViewTeamsIns
    const allCards = []

    for (let i = 0; i < teams.length; i++) {
      const { teamId, teamName } = teams[i]
      const encoded = encodeURIComponent(teamName)
      const url = `${TCDB}/ViewTeamsIns.cfm/sid/${SID}/team/${teamId}/${encoded}`
      process.stdout.write(`[${i+1}/${teams.length}] ${teamName}... `)

      await waitCF(page, url)
      await sleep(600)

      // Trouver le lien "Printable View" dans le dropdown Options
      const printUrl = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'))
        const printLink = links.find(a => /printable view/i.test(a.textContent))
        return printLink?.href || null
      })

      if (!printUrl) {
        console.log('⚠️  Printable View non trouvé')
        await sleep(DELAY)
        continue
      }

      // Naviguer vers la page Printable View (formulaire d'options)
      await waitCF(page, printUrl)
      await sleep(800)

      // Vérifier si on a un formulaire à soumettre ou si les cartes sont déjà là
      const pageInfo = await page.evaluate(() => {
        const form = document.querySelector('form')
        const submitBtn = form?.querySelector('input[type=submit], button[type=submit], button')
        const tds = document.querySelectorAll('td')
        return {
          hasForm: !!form,
          formAction: form?.action || '',
          submitText: submitBtn?.value || submitBtn?.textContent || '',
          tdCount: tds.length,
          url: window.location.href,
          title: document.title,
        }
      })
      console.log(`   [debug] ${pageInfo.title} | tds:${pageInfo.tdCount} | form:${pageInfo.hasForm} action:${pageInfo.formAction}`)

      if (pageInfo.hasForm && pageInfo.tdCount < 50) {
        // Soumettre le formulaire et attendre la navigation
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          page.evaluate(() => {
            const form = document.querySelector('form')
            const btn = form?.querySelector('input[type=submit], button[type=submit], button')
            if (btn) btn.click(); else form?.submit()
          })
        ])
        await sleep(1000)
        const afterInfo = await page.evaluate(() => ({ url: window.location.href, tdCount: document.querySelectorAll('td').length, title: document.title }))
        console.log(`   [after submit] ${afterInfo.title} | tds:${afterInfo.tdCount}`)
      }

      const cards = await page.evaluate(() => {
        const cards = []
        let currentVariation = null

        // Sur la page printable, la structure est plus simple:
        // h3 ou strong = nom de section/insert
        // tr avec td[0]=numéro, td[1]=joueur, td[2]=équipe
        document.querySelectorAll('h3, h4, strong, tr').forEach(el => {
          const tag = el.tagName
          const text = el.textContent?.trim() || ''

          if (['H3','H4'].includes(tag)) {
            if (/^base cards?$/i.test(text)) currentVariation = null
            else if (text && text.length < 100 && !/inserts and related/i.test(text) && !/record/i.test(text)) currentVariation = text
            return
          }

          if (tag === 'STRONG') {
            if (text && text.length < 100 && !/record/i.test(text) && !/base cards/i.test(text)) {
              currentVariation = text
            }
            return
          }

          if (tag === 'TR') {
            const tds = el.querySelectorAll('td')
            if (tds.length < 2) return

            const cardNum = tds[0]?.textContent?.trim() || ''
            if (!cardNum || !/^\d/.test(cardNum)) return

            const playerName = tds[1]?.querySelector('a')?.textContent?.trim()
              || tds[1]?.textContent?.trim().replace(/\s+(RC|RR|AU|SN\d+).*/g, '').trim()
            if (!playerName || playerName.length < 2) return

            const team = tds[2]?.querySelector('a')?.textContent?.trim()
              || tds[2]?.textContent?.trim() || null

            const rawPlayer = tds[1]?.textContent?.trim() || ''
            const isRc = /\bRC\b/.test(rawPlayer)
            const isAuto = /\bAU\b/.test(rawPlayer)

            cards.push({ card_number: cardNum, player_name: playerName, team: team || null, variation: currentVariation || null, is_rc: isRc, is_auto: isAuto })
          }
        })

        return cards
      })

      allCards.push(...cards)
      console.log(`${cards.length} cartes`)
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
      console.log(`  #${c.card_number || '?'} ${c.player_name} | ${c.team || '?'} | ${c.variation || 'Base'}`)
    )

    // Variations trouvées
    const variations = [...new Set(unique.map(c => c.variation || 'Base'))].sort()
    console.log(`\n${variations.length} variations/inserts:`)
    variations.forEach(v => {
      const count = unique.filter(c => (c.variation || 'Base') === v).length
      console.log(`  ${v}: ${count} cartes`)
    })

    // Insérer en base
    const answer = process.argv.includes('--save')
    if (!answer) {
      console.log('\n💡 Ajoutez --save pour insérer en base de données')
      await browser.close()
      return
    }

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
