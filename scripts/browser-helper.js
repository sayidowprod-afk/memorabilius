/**
 * Lance Chrome via spawn SANS --enable-automation → navigator.webdriver = false.
 * Cloudflare/TCDB ne peut pas détecter l'automatisation.
 */
const fs      = require('fs')
const path    = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-extra')

const LOCAL = process.env.LOCALAPPDATA || 'C:\\Users\\killi\\AppData\\Local'

// slot 1 = port 9223 + Chrome-Scrape (défaut)
// slot 2 = port 9224 + Chrome-Scrape-2 (parallelisme)
function slotConfig(slot = 1) {
  return {
    port: 9222 + slot,
    profileDir: path.join(LOCAL, slot === 1 ? 'Chrome-Scrape' : `Chrome-Scrape-${slot}`),
  }
}

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    LOCAL + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

const chromeProcesses = {}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function openBrowser(slot = 1) {
  const { port, profileDir } = slotConfig(slot)

  if (chromeProcesses[slot]) {
    try { chromeProcesses[slot].kill() } catch {}
    await sleep(2000)
  }

  const chromePath = findChrome()
  if (!chromePath) throw new Error('Chrome introuvable')

  chromeProcesses[slot] = spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--window-size=1280,900',
    'about:blank',
  ], { detached: false, stdio: 'ignore' })

  await sleep(3000)

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${port}`,
    defaultViewport: null,
  })

  const pages = await browser.pages()
  const page  = pages[0] || await browser.newPage()

  return { browser, page }
}

function killChrome(slot = 1) {
  const proc = chromeProcesses[slot]
  if (proc) { try { proc.kill() } catch {} delete chromeProcesses[slot] }
}

module.exports = { openBrowser, killChrome, slotConfig }
