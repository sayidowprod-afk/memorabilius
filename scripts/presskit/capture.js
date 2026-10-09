// Capture des pages publiques de memorabilius.fr pour le dossier de presse.
// Usage : node scripts/presskit/capture.js   (puppeteer-core + Chrome installe)
const puppeteer = require('puppeteer-core')
const path = require('path')
const fs = require('fs')

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.PK_BASE || 'https://www.memorabilius.fr'
const OUT = path.join(__dirname, 'work')
fs.mkdirSync(OUT, { recursive: true })

const CARD = 'https%3A%2F%2Fsnnrkzbevjhdtviizfyp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Favatars%2Fcartes%2Feb730dee-414e-4fcb-89d8-4a7b3448c218%2F1787676980797_recto.jpg'

const SHOTS = [
  { name: 'home_d', url: '/', w: 1440, h: 900 },
  { name: 'gallery_d', url: '/galerie/gknnn-cards', w: 1440, h: 1000, scrollTo: 0 },
  { name: 'gallery_grid_d', url: '/galerie/gknnn-cards', w: 1440, h: 900, scrollTo: 980 },
  { name: 'viewer_d', url: '/galerie/gknnn-cards?card=' + CARD, w: 1440, h: 900, wait: 7000 },
  { name: 'annuaire_d', url: '/annuaire', w: 1440, h: 900 },
  { name: 'setlist_d', url: '/setlist', w: 1440, h: 900 },
  { name: 'home_m', url: '/', w: 390, h: 844, mobile: true },
  { name: 'gallery_m', url: '/galerie/gknnn-cards', w: 390, h: 844, mobile: true },
  { name: 'viewer_m', url: '/galerie/gknnn-cards?card=' + CARD, w: 390, h: 844, mobile: true, wait: 7000 },
]

// masque les elements "fixed" places dans la moitie basse (banniere d'installation, barre d'inscription, bulle de chat, bouton remonter)
const CLEAN = () => {
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') {
      const r = el.getBoundingClientRect()
      const isModal = r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9
      if (!isModal && r.top > innerHeight * 0.3) el.style.setProperty('display', 'none', 'important')
    }
  })
}

;(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] })
  for (const s of SHOTS) {
    const page = await browser.newPage()
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: s.mobile ? 2 : 1.5, isMobile: !!s.mobile, hasTouch: !!s.mobile })
    try {
      await page.goto(BASE + s.url, { waitUntil: 'networkidle2', timeout: 60000 })
    } catch (e) { console.log('timeout (on continue)', s.name) }
    await new Promise(r => setTimeout(r, s.wait || 4500))
    if (s.scrollTo) { await page.evaluate(y => window.scrollTo(0, y), s.scrollTo); await new Promise(r => setTimeout(r, 1200)) }
    await page.evaluate(CLEAN)
    await page.evaluate(() => document.querySelectorAll('nextjs-portal').forEach(e => e.remove()))
    await new Promise(r => setTimeout(r, 400))
    await page.screenshot({ path: path.join(OUT, s.name + '.jpg'), type: 'jpeg', quality: 86 })
    console.log('ok', s.name)
    await page.close()
  }
  await browser.close()
})()
