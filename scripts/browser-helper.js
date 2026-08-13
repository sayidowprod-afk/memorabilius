/**
 * Lance Chrome via spawn SANS --enable-automation → navigator.webdriver = false.
 * Cloudflare/TCDB ne peut pas détecter l'automatisation.
 */
const fs      = require('fs')
const path    = require('path')
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-extra')

const DEBUG_PORT  = 9223
const PROFILE_DIR = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\killi\\AppData\\Local', 'Chrome-Scrape')

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

let chromeProcess = null

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function openBrowser() {
  if (chromeProcess) {
    try { chromeProcess.kill() } catch {}
    await sleep(2000)
  }

  const chromePath = findChrome()
  if (!chromePath) throw new Error('Chrome introuvable')

  chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-apps',
    '--window-size=1280,900',
    'about:blank',
  ], { detached: false, stdio: 'ignore' })

  await sleep(3000)

  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${DEBUG_PORT}`,
    defaultViewport: null,
  })

  const pages = await browser.pages()
  const page  = pages[0] || await browser.newPage()

  return { browser, page }
}

function killChrome() {
  if (chromeProcess) { try { chromeProcess.kill() } catch {} chromeProcess = null }
}

module.exports = { openBrowser, killChrome }
