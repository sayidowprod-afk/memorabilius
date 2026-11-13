// Icône iOS pour le build Codemagic : Apple exige une icône de 1024×1024 SANS canal alpha (sinon l'envoi est refusé, erreur ITMS-90717).
//   node scripts/ios-icon.js before   -> prépare assets/icon.png (1024×1024, sans alpha) à partir de resources/icon.png
//   (puis : npx capacitor-assets generate --ios)
//   node scripts/ios-icon.js after    -> retire le canal alpha des icônes générées dans le projet iOS
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

async function main() {
  const mode = process.argv[2]
  if (mode === 'before') {
    const out = await sharp('resources/icon.png').resize(1024, 1024, { fit: 'cover' }).flatten({ background: '#0e0e0e' }).removeAlpha().png().toBuffer()
    fs.mkdirSync('assets', { recursive: true })
    fs.writeFileSync(path.join('assets', 'icon.png'), out)
    console.log('assets/icon.png : 1024×1024, sans alpha')
  } else if (mode === 'after') {
    const dir = path.join('ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset')
    for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.png'))) {
      const file = path.join(dir, f)
      fs.writeFileSync(file, await sharp(file).flatten({ background: '#0e0e0e' }).removeAlpha().png().toBuffer())
      console.log('sans alpha : ' + f)
    }
  } else {
    console.error('Usage : node scripts/ios-icon.js before|after'); process.exit(1)
  }
}
main().catch(e => { console.error(e.message); process.exit(1) })
