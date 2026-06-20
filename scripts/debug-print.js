#!/usr/bin/env node
// Debug: trouver et afficher la page Printable View pour Atlanta Hawks
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

  await page.goto('https://www.tcdb.com/ViewTeamsIns.cfm/sid/484153/team/64/Atlanta%20Hawks', { waitUntil: 'domcontentloaded' })
  await sleep(1500)

  // Trouver TOUS les liens Printable View
  const printLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .filter(a => /printable view/i.test(a.textContent))
      .map(a => ({ text: a.textContent.trim(), href: a.href }))
  })
  console.log('Liens Printable View trouvés:', printLinks)

  if (printLinks.length === 0) {
    console.log('Aucun lien Printable View!')
    // Afficher tous les liens dropdown
    const dropLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.dropdown-menu a')).map(a => ({ text: a.textContent.trim(), href: a.href }))
    )
    console.log('Dropdown links:', dropLinks)
    await browser.close()
    return
  }

  // Prendre le dernier lien Printable View (= section Inserts, le plus complet)
  const printUrl = printLinks[printLinks.length - 1].href
  console.log('\nNavigation vers:', printUrl)

  await page.goto(printUrl, { waitUntil: 'domcontentloaded' })
  await sleep(1500)

  console.log('URL finale:', page.url())
  console.log('Titre:', await page.title())

  // Afficher la structure de la page printable
  const structure = await page.evaluate(() => {
    const results = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
    let count = 0
    while (walker.nextNode() && count < 150) {
      const el = walker.currentNode
      const tag = el.tagName.toLowerCase()
      if (['script','style','svg','path','img','head'].includes(tag)) continue
      if (el.children.length > 8) continue
      const text = el.textContent?.trim().substring(0, 60) || ''
      if (!text) continue
      const cls = el.className?.toString().substring(0, 30) || ''
      results.push({ tag, cls, text })
      count++
    }
    return results
  })

  console.log('\nStructure page Printable View:')
  structure.forEach(el => {
    if (['h1','h2','h3','h4','h5','h6'].includes(el.tag)) {
      console.log(`\n=== ${el.tag.toUpperCase()}: "${el.text}" ===`)
    } else if (el.tag === 'tr') {
      console.log(`  [TR] "${el.text}"`)
    } else if (el.tag === 'td') {
      console.log(`    [TD] "${el.text}"`)
    } else if (el.tag === 'strong' || el.tag === 'b') {
      console.log(`  <${el.tag}> "${el.text}"`)
    } else if (el.text.length > 3) {
      console.log(`  (${el.tag}.${el.cls}) "${el.text}"`)
    }
  })

  await browser.close()
})()
