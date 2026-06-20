#!/usr/bin/env node
// Debug: tester le lien Checklist sur une page set TCDB
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

  // Donruss 2024-25
  const SID = 484153
  await page.goto(`https://www.tcdb.com`, { waitUntil: 'domcontentloaded' })
  await sleep(2000)

  await page.goto(`https://www.tcdb.com/ViewSet.cfm/sid/${SID}`, { waitUntil: 'domcontentloaded' })
  await sleep(2000)

  // Lister tous les liens de la nav du set
  const navLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent.trim(),
      href: a.href
    })).filter(l => l.text && l.href.includes('tcdb'))
      .slice(0, 40)
  )
  console.log('Liens nav du set:')
  navLinks.forEach(l => console.log(` "${l.text}" → ${l.href}`))

  // Trouver le lien Checklist
  const checklistHref = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a')).find(a =>
      /checklist/i.test(a.textContent) || /checklist/i.test(a.href)
    )
    return a?.href || null
  })
  console.log('\nLien Checklist:', checklistHref)

  if (checklistHref) {
    await page.goto(checklistHref, { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    console.log('URL checklist:', page.url())

    // Compter les cartes
    const count = await page.evaluate(() =>
      document.querySelectorAll('table tr td').length
    )
    console.log('Cellules table:', count)

    // Afficher le texte de la page
    const text = await page.evaluate(() => document.body.innerText.substring(0, 1000))
    console.log('\nTexte page checklist:')
    console.log(text)
  }

  await browser.close()
})()
