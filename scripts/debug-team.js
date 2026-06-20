#!/usr/bin/env node
// Debug: afficher la structure HTML d'une page équipe TCDB
const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const fs = require('fs')

const CHROME = (() => {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
})()

const sleep = ms => new Promise(r => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteerExtra.launch({ executablePath: CHROME, headless: false, defaultViewport: null, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  await page.goto('https://www.tcdb.com', { waitUntil: 'domcontentloaded' })
  await sleep(2000)

  // Atlanta Hawks avec inserts
  await page.goto('https://www.tcdb.com/ViewTeamsIns.cfm/sid/484153/team/64/Atlanta%20Hawks', { waitUntil: 'domcontentloaded' })
  await sleep(1500)

  // Afficher les 50 premiers éléments significatifs avec leur tag et texte
  const structure = await page.evaluate(() => {
    const results = []
    const content = document.querySelector('#content, .container-fluid, main') || document.body
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_ELEMENT)

    let count = 0
    while (walker.nextNode() && count < 200) {
      const el = walker.currentNode
      const tag = el.tagName.toLowerCase()
      const text = el.textContent?.trim().substring(0, 80) || ''
      const cls = el.className?.toString().substring(0, 40) || ''
      const id = el.id || ''

      // N'afficher que les éléments intéressants
      if (!text || el.children.length > 5) continue
      if (['script','style','svg','path','img'].includes(tag)) continue

      results.push({ tag, id, cls, text })
      count++
    }
    return results
  })

  console.log('Structure de la page ViewTeamsIns (Atlanta Hawks):')
  structure.forEach(el => {
    if (['h1','h2','h3','h4','h5','h6'].includes(el.tag)) {
      console.log(`\n=== ${el.tag.toUpperCase()}: "${el.text}" ===`)
    } else if (el.tag === 'tr' || el.tag === 'td') {
      console.log(`  [${el.tag}] "${el.text}"`)
    } else if (el.tag === 'a') {
      console.log(`  <a> "${el.text}"`)
    } else if (el.text.length > 5) {
      console.log(`  (${el.tag}.${el.cls}) "${el.text}"`)
    }
  })

  await browser.close()
})()
