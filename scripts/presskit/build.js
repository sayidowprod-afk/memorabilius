// Fabrique les ELEMENTS du dossier de presse dynamique :
//   - public/presskit/bg-XX.jpg   : fond de chaque page (degrades, captures, logos, QR...) SANS aucun texte traduisible
//   - src/lib/presskit/layout.json : position / style de chaque texte (extrait du rendu HTML francais)
// Le PDF final est genere a la demande par src/lib/presskit/generate.ts (/api/presskit?lang=xx) avec les chiffres du jour.
// Usage : node scripts/presskit/capture.js  puis  node scripts/presskit/build.js
const puppeteer = require('puppeteer-core')
const QRCode = require('qrcode')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..', '..')
const WORK = path.join(__dirname, 'work')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/presskit/strings.json'), 'utf8')).fr
const u = p => pathToFileURL(path.join(ROOT, p)).href
const w = n => pathToFileURL(path.join(WORK, n + '.jpg')).href
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const CARD_A = SB + '1787763372857_recto.jpg'
const CARD_B = SB + '1781875894817_recto.jpg'
const CARD_C = SB + 'csv_1790632470730_4f41x1.jpg'

// ── helpers de balisage : data-t = texte traduisible (position extraite, texte redessine a la generation) ──
const T = (key, tag = 'div', style = '') => `<${tag} data-t="${key}" style="${style}">${esc(S[key])}</${tag}>`
const EYE = key => `<span class="eyebrow" data-t="${key}" data-box="1">${esc(S[key])}</span>`
const CHIPS = (keys, style = '') => `<div class="chips" data-chips="${keys.join(',')}" style="${style}">${keys.map(k => `<span class="chip">${esc(S[k])}</span>`).join('')}</div>`
const NUM = (name, label) => `<div><div class="num" data-num="${name}">0</div>${T(label, 'div', '')}</div>`

const css = `
@font-face{font-family:'Surfquest';src:url('${u('public/Surfquest-NoSlash.otf')}') format('opentype')}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#fff}
.pg{width:1600px;height:900px;position:relative;overflow:hidden;padding:76px 96px;
  background:linear-gradient(135deg,#050912 0%,#08153b 55%,#003da6 135%)}
.pg.light{background:#f3f5fa;color:#0a1228}
.sd{font-family:'Surfquest',Impact,sans-serif;text-transform:uppercase;font-weight:400;letter-spacing:.01em}
[data-t]{display:block;white-space:pre-line}
.eyebrow{display:inline-block !important;position:relative;border:3px solid currentColor;padding:8px 20px;font:800 20px 'Segoe UI',sans-serif;letter-spacing:.16em;text-transform:uppercase;margin-bottom:34px}
.eyebrow::after{content:'';position:absolute;inset:3px;border:1.5px solid currentColor;pointer-events:none}
h2{font-family:'Surfquest',Impact,sans-serif;text-transform:uppercase;font-weight:400;font-size:92px;line-height:.95;margin-bottom:24px}
p{font-size:26px;line-height:1.5;color:rgba(255,255,255,.82)}
.light p{color:rgba(10,18,40,.78)}
.foot{position:absolute;left:96px;right:96px;bottom:34px;display:flex;justify-content:space-between;font:700 15px 'Segoe UI',sans-serif;letter-spacing:.16em;text-transform:uppercase;opacity:.55}
.foot [data-t]{display:inline-block}
.logo{height:46px;display:block}
.shot{border:3px solid rgba(255,255,255,.35);box-shadow:0 30px 70px rgba(0,0,0,.5);display:block}
.cols{display:flex;gap:64px;align-items:center;height:calc(100% - 150px)}
.cols>*{min-width:0}
.chips{display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-block;border:2px solid rgba(255,255,255,.7);padding:8px 18px;font:800 19px 'Segoe UI',sans-serif;letter-spacing:.12em;text-transform:uppercase}
.card{position:absolute;box-shadow:0 36px 70px rgba(0,0,0,.6);display:block}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
.feat{border:3px solid rgba(255,255,255,.28);padding:30px 30px 26px;background:rgba(255,255,255,.05);min-height:210px}
.feat b{display:block;font:900 27px 'Segoe UI',sans-serif;margin-bottom:10px}
.feat p{font-size:21px;line-height:1.45}
.feat i{display:block;width:46px;height:6px;margin-bottom:20px}
.num{font-family:'Surfquest',Impact,sans-serif;font-size:190px;line-height:.9}
.lab{font:800 22px 'Segoe UI',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-top:10px}
.phone{width:300px;border:10px solid #04060d;border-radius:44px;overflow:hidden;box-shadow:0 36px 70px rgba(0,0,0,.55);background:#04060d}
.phone img{display:block;width:100%}
.sw{height:96px;border:3px solid rgba(10,18,40,.25);margin-bottom:8px}
.cn{font:800 17px 'Segoe UI',sans-serif;letter-spacing:.08em;text-transform:uppercase}
.hex{font:500 16px Consolas,monospace;opacity:.65}
.row{display:flex;gap:30px;border-top:2px solid rgba(255,255,255,.2);padding:14px 8px;align-items:flex-start}
.row .k{width:240px;flex:none;font:800 18px 'Segoe UI',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);padding-top:5px}
.row .v{flex:1;font-size:23px;line-height:1.35}
`

const FOOT = n => `<div class="foot">${T('foot_l', 'span')}<span>memorabilius.fr · ${n}</span></div>`

const pages = []

// 1. Couverture
pages.push(`<section class="pg">
  <img class="logo" style="height:64px" src="${u('public/memorabilius-logo-white.png')}">
  <div style="position:absolute;left:96px;top:190px;width:900px">
    ${T('c_title', 'h2', 'font-size:176px;line-height:.9;margin:0')}
    ${T('c_sub', 'p', 'margin-top:34px;font-size:32px')}
  </div>
  <img class="card" style="width:300px;left:1030px;top:200px;transform:rotate(-8deg)" src="${CARD_B}">
  <img class="card" style="width:330px;left:1190px;top:90px;transform:rotate(5deg);z-index:2" src="${CARD_A}">
  <img class="card" style="width:300px;left:1170px;top:430px;transform:rotate(-3deg)" src="${CARD_C}">
  <div class="foot">${T('c_foot', 'span')}<span>memorabilius.fr</span></div>
</section>`)

// 2. Presentation
pages.push(`<section class="pg">
  ${EYE('s1_eyebrow')}
  <div class="cols">
    <div style="flex:1.05">
      ${T('s1_title', 'h2')}
      ${T('s1_p1', 'p')}
      ${T('s1_p2', 'p', 'margin-top:20px')}
      ${CHIPS(['chip_free', 'chip_platforms', 'chip_langs'], 'margin-top:34px')}
    </div>
    <img class="shot" style="flex:1;width:100%" src="${w('home_d')}">
  </div>
  ${FOOT(2)}
</section>`)

// 3. Chiffres
pages.push(`<section class="pg">
  ${EYE('s2_eyebrow')}
  ${T('s2_title', 'h2', 'margin-bottom:60px')}
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:30px;border-top:3px solid rgba(255,255,255,.35);padding-top:40px">
    ${NUM('collectors', 'l_collectors').replace('<div data-t', '<div class="lab" data-t')}
    ${NUM('cards', 'l_cards').replace('<div data-t', '<div class="lab" data-t')}
    ${NUM('binders', 'l_binders').replace('<div data-t', '<div class="lab" data-t')}
    ${NUM('trade', 'l_trade').replace('<div data-t', '<div class="lab" data-t')}
  </div>
  ${T('s2_note', 'p', 'margin-top:56px;font-size:22px;opacity:.7')}
  ${FOOT(3)}
</section>`)

// 4. Fonctionnalites
const COLORS = ['#2f6bff', '#e67e22', '#2fd072', '#d9a521', '#7b1fa2', '#1976d2']
pages.push(`<section class="pg">
  ${EYE('s3_eyebrow')}
  ${T('s3_title', 'h2', 'margin-bottom:38px')}
  <div class="grid3">${COLORS.map((c, i) => `<div class="feat"><i style="background:${c}"></i>${T(`f${i + 1}_t`, 'b')}${T(`f${i + 1}_d`, 'p')}</div>`).join('')}</div>
  ${FOOT(4)}
</section>`)

// 5. Galerie
pages.push(`<section class="pg">
  ${EYE('s4_eyebrow')}
  <div class="cols">
    <div style="flex:.8">
      ${T('s4_title', 'h2')}
      ${T('s4_p1', 'p')}
      ${T('s4_p2', 'p', 'margin-top:20px')}
    </div>
    <img class="shot" style="flex:1.25;width:100%" src="${w('gallery_d')}">
  </div>
  ${FOOT(5)}
</section>`)

// 6. Viewer 3D
pages.push(`<section class="pg">
  ${EYE('s5_eyebrow')}
  <div class="cols">
    <img class="shot" style="flex:1.3;width:100%" src="${w('viewer_d')}">
    <div style="flex:.7">
      ${T('s5_title', 'h2')}
      ${T('s5_p', 'p')}
    </div>
  </div>
  ${FOOT(6)}
</section>`)

// 7. Mobile
pages.push(`<section class="pg">
  ${EYE('s6_eyebrow')}
  <div class="cols" style="gap:70px">
    <div style="flex:1">
      ${T('s6_title', 'h2')}
      ${T('s6_p', 'p')}
      <img src="${u('public/google-play-badge.png')}" style="height:70px;margin-top:34px;display:block">
    </div>
    <div style="display:flex;gap:30px;align-items:flex-start;margin-top:-20px">
      <div class="phone"><img src="${w('home_m')}"></div>
      <div class="phone" style="margin-top:70px"><img src="${w('gallery_m')}"></div>
    </div>
  </div>
  ${FOOT(7)}
</section>`)

// 8. Communaute & outils
pages.push(`<section class="pg">
  ${EYE('s7_eyebrow')}
  <div class="cols">
    <div style="flex:.85">
      ${T('s7_title', 'h2')}
      ${T('s7_p', 'p')}
      ${CHIPS(['ch_annuaire', 'ch_equipes', 'ch_echanges', 'ch_evenements', 'ch_scanner', 'ch_gradation', 'ch_sets', 'ch_guides'], 'margin-top:30px')}
    </div>
    <div style="flex:1.15;position:relative;height:100%">
      <img class="shot" style="position:absolute;width:640px;left:0;top:30px" src="${w('annuaire_d')}">
      <img class="shot" style="position:absolute;width:640px;left:150px;top:300px" src="${w('setlist_d')}">
    </div>
  </div>
  ${FOOT(8)}
</section>`)

// 9. Identite visuelle (page claire)
const SW = [['#050912', 'cn_night'], ['#08153B', 'cn_navy'], ['#003DA6', 'cn_blue'], ['#2F6BFF', 'cn_electric'], ['#FFFFFF', 'cn_white'], ['#F3F5FA', 'cn_paper']]
pages.push(`<section class="pg light">
  ${EYE('s8_eyebrow')}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:70px">
    <div>
      ${T('s8_logo', 'h2', 'font-size:70px;margin-bottom:14px')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px">
        <div style="background:#050912;padding:36px 24px;display:flex;justify-content:center"><img style="height:44px" src="${u('public/memorabilius-logo-white.png')}"></div>
        <div style="background:#fff;border:3px solid rgba(10,18,40,.2);padding:36px 24px;display:flex;justify-content:center"><img style="height:44px" src="${u('public/memorabilius-logo.png')}"></div>
      </div>
      ${T('s8_logo_p', 'p', 'font-size:20px')}
      ${T('s8_typo', 'h2', 'font-size:70px;margin:26px 0 8px')}
      <div class="sd" style="font-size:58px;color:#0a1228;line-height:1">Surfquest — 0123456789</div>
      ${T('s8_typo_p', 'p', 'font-size:19px;margin-top:8px')}
    </div>
    <div>
      ${T('s8_colors', 'h2', 'font-size:70px;margin-bottom:14px')}
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${SW.map(s => `<div><div class="sw" style="background:${s[0]}"></div>${T(s[1], 'div', '').replace('<div data-t', '<div class="cn" data-t')}<span class="hex">${s[0]}</span></div>`).join('')}</div>
    </div>
  </div>
  <div class="foot" style="color:#0a1228">${T('foot_l', 'span')}<span>memorabilius.fr · 9</span></div>
</section>`)

// 10. En bref
const ROWS = [['t_name_k', null, 'Memorabilius'], ['t_site_k', null, 'www.memorabilius.fr'], ['t_who_k', 't_who_v'], ['t_plat_k', 't_plat_v'], ['t_lang_k', 't_lang_v'], ['t_price_k', 't_price_v']]
pages.push(`<section class="pg">
  ${EYE('s9_eyebrow')}
  <div class="cols" style="align-items:flex-start;gap:70px">
    <div style="flex:1.2">
      ${T('s9_fiche', 'h2', 'font-size:78px;margin-bottom:20px')}
      <div>${ROWS.map(r => `<div class="row">${T(r[0], 'div', '').replace('<div data-t', '<div class="k" data-t')}${r[1] ? T(r[1], 'div', '').replace('<div data-t', '<div class="v" data-t') : `<div class="v">${r[2]}</div>`}</div>`).join('')}</div>
    </div>
    <div style="flex:1">
      ${T('s9_50', 'h2', 'font-size:78px;margin-bottom:20px')}
      ${T('s9_50_p', 'p')}
    </div>
  </div>
  ${FOOT(10)}
</section>`)

// 11. Ressources (le QR code est un vrai QR vers memorabilius.fr)
;(async () => {
  const qr = await QRCode.toDataURL('https://www.memorabilius.fr', { margin: 1, width: 600, color: { dark: '#050912', light: '#ffffff' } })
  pages.push(`<section class="pg">
  ${EYE('s10_eyebrow')}
  <div class="cols" style="align-items:center;gap:90px">
    <div style="flex:1.3">
      ${T('s10_title', 'h2')}
      ${T('s10_p', 'p')}
      ${CHIPS(['r_logo_w', 'r_logo_b', 'r_shots', 'r_pdf'], 'margin-top:30px')}
      <p class="sd" style="font-size:54px;margin-top:40px;color:#fff">memorabilius.fr/presskit</p>
    </div>
    <div style="flex:.7;text-align:center">
      <div style="background:#fff;padding:22px;display:inline-block"><img style="width:300px;display:block" src="${qr}"></div>
      <div class="lab" style="margin-top:18px">memorabilius.fr</div>
    </div>
  </div>
  ${FOOT(11)}
</section>`)

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style></head><body>${pages.join('\n')}</body></html>`
  const htmlPath = path.join(WORK, 'presskit.html')
  fs.writeFileSync(htmlPath, html)

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1.25 })
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => document.fonts.ready)

  // 1. extraction des positions / styles
  const layout = await page.evaluate(() => {
    const out = { pages: [] }
    const num = v => parseFloat(v) || 0
    const opacityOf = el => { let o = 1; for (let n = el; n && n.tagName !== 'SECTION'; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o }
    document.querySelectorAll('section.pg').forEach(sec => {
      const sr = sec.getBoundingClientRect()
      const pg = { light: sec.classList.contains('light'), items: [], chips: [] }
      const rel = r => ({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height })
      sec.querySelectorAll('[data-t],[data-num]').forEach(el => {
        const cs = getComputedStyle(el)
        const r = rel(el.getBoundingClientRect())
        // ligne de base de la 1re ligne : sonde inline de hauteur 0
        const probe = document.createElement('span')
        probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
        el.insertBefore(probe, el.firstChild)
        const b0 = probe.getBoundingClientRect().bottom - el.getBoundingClientRect().top
        probe.remove()
        const fs = num(cs.fontSize)
        const lh = cs.lineHeight === 'normal' ? fs * 1.2 : num(cs.lineHeight)
        const box = el.dataset.box ? { pad: [num(cs.paddingTop), num(cs.paddingLeft)], bw: num(cs.borderTopWidth) } : null
        const padL = el.dataset.box ? num(cs.paddingLeft) + num(cs.borderLeftWidth) : 0
        pg.items.push({
          key: el.dataset.t || null, num: el.dataset.num || null,
          x: r.x + padL, y: r.y, w: r.w - 2 * padL, h: r.h, bx: r.x, bw: r.w,
          fs, lh, b0, color: cs.color, weight: num(cs.fontWeight), op: opacityOf(el),
          fam: /Surfquest/.test(cs.fontFamily) ? 'sd' : 'sans',
          ls: cs.letterSpacing === 'normal' ? 0 : num(cs.letterSpacing),
          upper: cs.textTransform === 'uppercase', align: cs.textAlign, box,
        })
      })
      sec.querySelectorAll('[data-chips]').forEach(el => {
        const first = el.querySelector('.chip')
        const cs = getComputedStyle(first)
        const r = rel(el.getBoundingClientRect())
        const fr = first.getBoundingClientRect()
        pg.chips.push({
          keys: el.dataset.chips.split(','), x: r.x, y: r.y, w: r.w,
          fs: num(cs.fontSize), padX: num(cs.paddingLeft), h: fr.height, bw: num(cs.borderTopWidth),
          ls: num(cs.letterSpacing), gap: 10, border: cs.borderTopColor, color: cs.color,
        })
      })
      out.pages.push(pg)
    })
    return out
  })
  fs.mkdirSync(path.join(ROOT, 'src/lib/presskit'), { recursive: true })
  fs.writeFileSync(path.join(ROOT, 'src/lib/presskit/layout.json'), JSON.stringify(layout))

  // 2. fonds sans texte traduisible
  await page.addStyleTag({ content: `
    [data-t],[data-num]{color:transparent !important;text-shadow:none !important}
    .eyebrow{border-color:transparent !important}.eyebrow::after{display:none !important}
    .chip{border-color:transparent !important;color:transparent !important}
    .foot{opacity:1 !important}
    .foot span:last-child{opacity:.55}
  ` })
  fs.mkdirSync(path.join(ROOT, 'public', 'presskit'), { recursive: true })
  const sections = await page.$$('section.pg')
  for (let i = 0; i < sections.length; i++) {
    await sections[i].screenshot({ path: path.join(ROOT, 'public', 'presskit', `bg-${String(i + 1).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 88 })
  }
  await browser.close()
  console.log('layout + fonds ok,', sections.length, 'pages')
})()
