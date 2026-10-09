// Fabrique le dossier de presse PDF : node scripts/presskit/capture.js (captures) puis node scripts/presskit/build.js
// Sortie : public/presskit/Memorabilius-Presskit.pdf  (+ work/pages/*.png pour controle visuel)
const puppeteer = require('puppeteer-core')
const path = require('path')
const fs = require('fs')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..', '..')
const WORK = path.join(__dirname, 'work')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const stats = JSON.parse(fs.readFileSync(path.join(WORK, 'stats.json'), 'utf8'))
const u = p => pathToFileURL(path.join(ROOT, p)).href
const w = n => pathToFileURL(path.join(WORK, n + '.jpg')).href
const fmt = n => Number(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const d = new Date(stats.date)
const dateFr = `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
const moisAnnee = `${MOIS[d.getUTCMonth()][0].toUpperCase()}${MOIS[d.getUTCMonth()].slice(1)} ${d.getUTCFullYear()}`

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const CARD_A = SB + '1787763372857_recto.jpg'
const CARD_B = SB + '1781875894817_recto.jpg'
const CARD_C = SB + 'csv_1790632470730_4f41x1.jpg'

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`

const css = `
@font-face{font-family:'Surfquest';src:url('${u('public/Surfquest-NoSlash.otf')}') format('opentype')}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:1600px 900px;margin:0}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:1600px;height:900px;position:relative;overflow:hidden;page-break-after:always;padding:76px 96px;
  background:linear-gradient(135deg,#050912 0%,#08153b 55%,#003da6 135%)}
.pg:last-child{page-break-after:auto}
.pg.light{background:#f3f5fa;color:#0a1228}
.sd{font-family:'Surfquest',Impact,sans-serif;text-transform:uppercase;font-weight:400;letter-spacing:.01em}
.eyebrow{display:inline-block;position:relative;border:3px solid currentColor;padding:8px 20px;font:800 20px 'Segoe UI',sans-serif;letter-spacing:.16em;text-transform:uppercase;margin-bottom:34px}
.eyebrow::after{content:'';position:absolute;inset:3px;border:1.5px solid currentColor;pointer-events:none}
h2{font-family:'Surfquest',Impact,sans-serif;text-transform:uppercase;font-weight:400;font-size:92px;line-height:.95;margin-bottom:24px}
p{font-size:26px;line-height:1.5;color:rgba(255,255,255,.82)}
.light p{color:rgba(10,18,40,.78)}
.foot{position:absolute;left:96px;right:96px;bottom:34px;display:flex;justify-content:space-between;font:700 15px 'Segoe UI',sans-serif;letter-spacing:.16em;text-transform:uppercase;opacity:.55}
.logo{height:46px;display:block}
.shot{border:3px solid rgba(255,255,255,.35);box-shadow:0 30px 70px rgba(0,0,0,.5);display:block}
.cols{display:flex;gap:64px;align-items:center;height:calc(100% - 150px)}
.cols>*{min-width:0}
.chip{display:inline-block;border:2px solid rgba(255,255,255,.7);padding:8px 18px;font:800 19px 'Segoe UI',sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:0 10px 10px 0}
.card{position:absolute;box-shadow:0 36px 70px rgba(0,0,0,.6);display:block}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
.feat{border:3px solid rgba(255,255,255,.28);padding:30px 30px 26px;background:rgba(255,255,255,.05)}
.feat b{display:block;font:900 27px 'Segoe UI',sans-serif;margin-bottom:10px}
.feat p{font-size:21px;line-height:1.45}
.feat i{display:block;width:46px;height:6px;margin-bottom:20px}
.num{font-family:'Surfquest',Impact,sans-serif;font-size:190px;line-height:.9}
.lab{font:800 22px 'Segoe UI',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-top:10px}
.phone{width:300px;border:10px solid #04060d;border-radius:44px;overflow:hidden;box-shadow:0 36px 70px rgba(0,0,0,.55);background:#04060d}
.phone img{display:block;width:100%}
table{border-collapse:collapse;width:100%}
td{border-top:2px solid rgba(255,255,255,.2);padding:15px 8px;font-size:23px;vertical-align:top}
td:first-child{width:260px;font:800 18px 'Segoe UI',sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);padding-top:20px}
.sw{height:130px;border:3px solid rgba(10,18,40,.25);margin-bottom:10px}
.sw+b{display:block;font:800 18px 'Segoe UI',sans-serif;letter-spacing:.08em;text-transform:uppercase}
.sw+b+span{font:500 17px Consolas,monospace;opacity:.65}
`

const FOOT = (n) => `<div class="foot"><span>Memorabilius — Dossier de presse</span><span>memorabilius.fr · ${n}</span></div>`

const pages = []

// 1. Couverture
pages.push(`<section class="pg">
  <img class="logo" style="height:64px" src="${u('public/memorabilius-logo-white.png')}">
  <div style="position:absolute;left:96px;top:190px;width:900px">
    <h2 style="font-size:176px;line-height:.9;margin:0">Collectionnez.<br>Identifiez.<br>Échangez.</h2>
    <p style="margin-top:34px;font-size:32px">La plateforme gratuite des collectionneurs de cartes de sport.</p>
  </div>
  <img class="card" style="width:300px;left:1030px;top:200px;transform:rotate(-8deg)" src="${CARD_B}">
  <img class="card" style="width:330px;left:1190px;top:90px;transform:rotate(5deg);z-index:2" src="${CARD_A}">
  <img class="card" style="width:300px;left:1170px;top:430px;transform:rotate(-3deg)" src="${CARD_C}">
  <div class="foot"><span>Dossier de presse · ${moisAnnee}</span><span>memorabilius.fr</span></div>
</section>`)

// 2. Presentation
pages.push(`<section class="pg">
  <span class="eyebrow">01 — Présentation</span>
  <div class="cols">
    <div style="flex:1.05">
      <h2>Une plateforme,<br>toute ta collection.</h2>
      <p>Memorabilius réunit au même endroit une galerie 3D interactive, un scan par intelligence artificielle, les prix eBay en direct et un système d’échanges entre passionnés.</p>
      <p style="margin-top:20px">Chaque collectionneur crée sa galerie, la partage en un lien, range ses cartes en classeurs thématiques, suit les sets qu’il complète et échange ses doubles avec la communauté.</p>
      <div style="margin-top:34px"><span class="chip">Gratuit</span><span class="chip">Web · PWA · Android</span><span class="chip">5 langues</span></div>
    </div>
    <img class="shot" style="flex:1;width:100%" src="${w('home_d')}">
  </div>
  ${FOOT(2)}
</section>`)

// 3. Chiffres
pages.push(`<section class="pg">
  <span class="eyebrow">02 — Chiffres clés</span>
  <h2 style="margin-bottom:60px">La communauté<br>en chiffres</h2>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:30px;border-top:3px solid rgba(255,255,255,.35);padding-top:40px">
    <div><div class="num">${fmt(stats.collectors)}</div><div class="lab">Collectionneurs</div></div>
    <div><div class="num">${fmt(stats.cards)}</div><div class="lab">Cartes référencées</div></div>
    <div><div class="num">${fmt(stats.binders)}</div><div class="lab">Classeurs partagés</div></div>
    <div><div class="num">${fmt(stats.trade)}</div><div class="lab">Cartes proposées à l’échange</div></div>
  </div>
  <p style="margin-top:56px;font-size:22px;opacity:.7">Chiffres publics, relevés le ${dateFr}.</p>
  ${FOOT(3)}
</section>`)

// 4. Fonctionnalites
const F = [
  ['#2f6bff', 'Scan IA instantané', '1 photo suffit : notre IA reconnaît joueur, année, marque et variation automatiquement.'],
  ['#e67e22', 'Galerie 3D interactive', 'Tes cartes visualisées en holographique interactif. Partage ton profil de collectionneur en 1 lien.'],
  ['#2fd072', 'Prix eBay en direct', 'Connais la valeur de chaque carte grâce aux ventes récentes eBay, en temps réel.'],
  ['#d9a521', 'Système d’échanges', 'Propose des trades directement depuis les galeries. Échange tes doubles avec la communauté.'],
  ['#7b1fa2', 'Sets & complétion', 'Compare ta collection aux sets officiels. Vois exactement quelles cartes il te manque.'],
  ['#1976d2', 'Classeurs thématiques', 'Organise ta collection dans des classeurs partageables par équipe, saison ou thème.'],
]
pages.push(`<section class="pg">
  <span class="eyebrow">03 — Fonctionnalités</span>
  <h2 style="margin-bottom:38px">Tout ce dont<br>un collectionneur a besoin</h2>
  <div class="grid3">${F.map(f => `<div class="feat"><i style="background:${f[0]}"></i><b>${f[1]}</b><p>${f[2]}</p></div>`).join('')}</div>
  ${FOOT(4)}
</section>`)

// 5. Galerie
pages.push(`<section class="pg">
  <span class="eyebrow">04 — La galerie</span>
  <div class="cols">
    <div style="flex:.8">
      <h2>Une galerie<br>qui se partage.</h2>
      <p>Chaque collectionneur a son profil : nombre de cartes, rookies, autographes, numérotées, patchs, niveau et badges. Les pièces maîtresses sont mises en avant dans le « Grail Wall ».</p>
      <p style="margin-top:20px">Les cartes se filtrent, se trient par collection et s’ouvrent dans un viewer 3D.</p>
    </div>
    <img class="shot" style="flex:1.25;width:100%" src="${w('gallery_d')}">
  </div>
  ${FOOT(5)}
</section>`)

// 6. Viewer 3D
pages.push(`<section class="pg">
  <span class="eyebrow">05 — Viewer 3D</span>
  <div class="cols">
    <img class="shot" style="flex:1.3;width:100%" src="${w('viewer_d')}">
    <div style="flex:.7">
      <h2>Chaque carte,<br>en relief.</h2>
      <p>Recto, verso, épaisseur, reflets : le viewer 3D montre la carte sous tous les angles, à la meilleure résolution disponible.</p>
    </div>
  </div>
  ${FOOT(6)}
</section>`)

// 7. Mobile
pages.push(`<section class="pg">
  <span class="eyebrow">06 — Sur mobile</span>
  <div class="cols" style="gap:70px">
    <div style="flex:1">
      <h2>Dans la poche,<br>au salon comme<br>en salon de cartes.</h2>
      <p>Memorabilius s’utilise dans le navigateur, s’installe comme une application web (PWA) et existe en application Android.</p>
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
  <span class="eyebrow">07 — Communauté & outils</span>
  <div class="cols">
    <div style="flex:.85">
      <h2>Une communauté,<br>des outils.</h2>
      <p>Annuaire des collectionneurs, équipes, échanges entre galeries, événements et fil d’activité côté communauté. Scanner de prix, gradation, sets à compléter, guides et recherche de cartes côté outils.</p>
      <div style="margin-top:30px"><span class="chip">Annuaire</span><span class="chip">Équipes</span><span class="chip">Échanges</span><span class="chip">Événements</span><span class="chip">Scanner</span><span class="chip">Gradation</span><span class="chip">Sets</span><span class="chip">Guides</span></div>
    </div>
    <div style="flex:1.15;position:relative;height:100%">
      <img class="shot" style="position:absolute;width:640px;left:0;top:30px" src="${w('annuaire_d')}">
      <img class="shot" style="position:absolute;width:640px;left:150px;top:300px" src="${w('setlist_d')}">
    </div>
  </div>
  ${FOOT(8)}
</section>`)

// 9. Identite visuelle
const SW = [['#050912', 'Nuit'], ['#08153B', 'Marine'], ['#003DA6', 'Bleu Memorabilius'], ['#2F6BFF', 'Bleu électrique'], ['#FFFFFF', 'Blanc'], ['#F3F5FA', 'Papier']]
pages.push(`<section class="pg light">
  <span class="eyebrow">08 — Identité visuelle</span>
  <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:70px">
    <div>
      <h2 style="font-size:78px">Logo</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:6px 0 34px">
        <div style="background:#050912;padding:50px 30px;display:flex;justify-content:center"><img style="height:50px" src="${u('public/memorabilius-logo-white.png')}"></div>
        <div style="background:#fff;border:3px solid rgba(10,18,40,.2);padding:50px 30px;display:flex;justify-content:center"><img style="height:50px" src="${u('public/memorabilius-logo.png')}"></div>
      </div>
      <p style="font-size:22px">Le logo s’utilise tel quel, sans cadre ajouté, ni déformation, ni changement de couleur : blanc sur fond sombre, noir sur fond clair. Laisse un espace libre autour égal à la hauteur de la lettre « M ».</p>
    </div>
    <div>
      <h2 style="font-size:78px">Couleurs</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px">${SW.map(s => `<div><div class="sw" style="background:${s[0]}"></div><b>${s[1]}</b><span>${s[0]}</span></div>`).join('')}</div>
      <h2 style="font-size:78px;margin-top:30px">Typographie</h2>
      <p class="sd" style="font-size:64px;color:#0a1228;line-height:1">Surfquest — 0123456789</p>
      <p style="font-size:21px;margin-top:10px">Surfquest pour les grands titres et les chiffres ; police système en gras pour le texte courant.</p>
    </div>
  </div>
  <div class="foot" style="color:#0a1228"><span>Memorabilius — Dossier de presse</span><span>memorabilius.fr · 9</span></div>
</section>`)

// 10. En bref
pages.push(`<section class="pg">
  <span class="eyebrow">09 — En bref</span>
  <div class="cols" style="align-items:flex-start;gap:70px">
    <div style="flex:1.2">
      <h2 style="font-size:78px;margin-bottom:20px">Fiche</h2>
      <table>
        <tr><td>Nom</td><td>Memorabilius</td></tr>
        <tr><td>Site</td><td>www.memorabilius.fr</td></tr>
        <tr><td>Pour qui</td><td>Collectionneurs de cartes de sport (NBA, football, hockey, baseball…)</td></tr>
        <tr><td>Plateformes</td><td>Web, application web installable (PWA), Android (Google Play)</td></tr>
        <tr><td>Langues</td><td>Français, anglais, allemand, espagnol, italien</td></tr>
        <tr><td>Prix</td><td>Gratuit</td></tr>
      </table>
    </div>
    <div style="flex:1">
      <h2 style="font-size:78px;margin-bottom:20px">En 50 mots</h2>
      <p>Memorabilius est la plateforme gratuite des collectionneurs de cartes de sport : une galerie 3D à partager, un scan par intelligence artificielle, les prix eBay en direct, des classeurs, des sets à compléter et des échanges entre passionnés — sur le web et sur mobile.</p>
    </div>
  </div>
  ${FOOT(10)}
</section>`)

// 11. Ressources
pages.push(`<section class="pg">
  <span class="eyebrow">10 — Ressources</span>
  <div class="cols" style="align-items:center;gap:90px">
    <div style="flex:1.3">
      <h2>Utilise-nous,<br>librement.</h2>
      <p>Ce dossier, le logo, les couleurs et les captures d’écran sont à la disposition de toute personne qui souhaite parler de Memorabilius.</p>
      <div style="margin-top:30px"><span class="chip">Logo blanc</span><span class="chip">Logo noir</span><span class="chip">Captures</span><span class="chip">Ce dossier (PDF)</span></div>
      <p class="sd" style="font-size:54px;margin-top:40px;color:#fff">memorabilius.fr/presskit</p>
    </div>
    <div style="flex:.7;text-align:center">
      <div style="background:#fff;padding:26px;display:inline-block"><img style="width:300px;display:block" src="${u('public/memorabilius-logo-qr-hd.png')}"></div>
      <div class="lab" style="margin-top:18px">memorabilius.fr</div>
    </div>
  </div>
  ${FOOT(11)}
</section>`)

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Memorabilius — Dossier de presse</title><style>${css}</style></head><body>${pages.join('\n')}</body></html>`

;(async () => {
  fs.mkdirSync(path.join(ROOT, 'public', 'presskit'), { recursive: true })
  fs.mkdirSync(path.join(WORK, 'pages'), { recursive: true })
  const htmlPath = path.join(WORK, 'presskit.html')
  fs.writeFileSync(htmlPath, html)
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 900 })
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => document.fonts.ready)
  // controle visuel : une image par page
  const n = await page.$$eval('section.pg', s => s.length)
  for (let i = 0; i < n; i++) {
    const el = (await page.$$('section.pg'))[i]
    await el.screenshot({ path: path.join(WORK, 'pages', `p${String(i + 1).padStart(2, '0')}.png`) })
  }
  await page.pdf({ path: path.join(ROOT, 'public', 'presskit', 'Memorabilius-Presskit.pdf'), width: '1600px', height: '900px', printBackground: true, preferCSSPageSize: true })
  await browser.close()
  console.log('PDF ok,', n, 'pages')
})()
