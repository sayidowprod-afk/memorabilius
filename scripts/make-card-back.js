// Genere public/card-back.png : dos de carte Memorabilius (treillis marine, double filet, monogramme M) en Surfquest.
// Usage : node scripts/make-card-back.js   (necessite le serveur de dev sur :3001 pour charger la police)
const puppeteer = require('puppeteer-core')
;(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' })
  const p = await b.newPage()
  await p.setViewport({ width: 500, height: 700, deviceScaleFactor: 2 })
  await p.setContent(`<html><head><style>
    @font-face { font-family: 'Surfquest'; src: url('http://localhost:3001/Surfquest-NoSlash.otf'); }
    html,body{margin:0;background:#08153b}
    .c{width:500px;height:700px;position:relative;overflow:hidden;color:#fff;font-family:Surfquest,Impact,sans-serif;text-transform:uppercase;
      background:
        linear-gradient(45deg, rgba(255,255,255,.055) 25%, transparent 25% 75%, rgba(255,255,255,.055) 75%) 0 0/44px 44px,
        linear-gradient(45deg, rgba(255,255,255,.055) 25%, transparent 25% 75%, rgba(255,255,255,.055) 75%) 22px 22px/44px 44px,
        linear-gradient(160deg,#0a2468,#003da6 58%,#08153b);}
    .c::before{content:'';position:absolute;inset:18px;border:4px solid rgba(255,255,255,.85)}
    .c::after{content:'';position:absolute;inset:30px;border:2px solid rgba(255,255,255,.5)}
    .m{position:absolute;left:50%;top:210px;width:150px;height:150px;margin-left:-75px;border:6px solid #fff;display:flex;align-items:center;justify-content:center;font-size:110px;line-height:1;
      box-shadow:inset 0 0 0 6px #08153b, inset 0 0 0 9px #fff; background:rgba(5,9,18,.35)}
    .t{position:absolute;left:0;right:0;top:400px;text-align:center;font-size:62px;line-height:.9;letter-spacing:.01em}
    .s{position:absolute;left:0;right:0;bottom:62px;text-align:center;font:800 15px system-ui;letter-spacing:.32em;opacity:.85}
  </style></head><body><div class="c"><div class="m">M</div><div class="t">Memorabilius</div><div class="s">Collection de cartes</div></div></body></html>`, { waitUntil: 'networkidle0' })
  await p.evaluate(() => document.fonts.ready)
  await new Promise(r => setTimeout(r, 600))
  const el = await p.$('.c')
  await el.screenshot({ path: 'public/card-back.png' })
  await b.close()
  console.log('ok public/card-back.png')
})()
