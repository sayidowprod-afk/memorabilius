#!/usr/bin/env node
/**
 * Copie le profil Chrome Default vers Chrome-Scrape et Chrome-Scrape-2.
 * Chrome-Scrape   → slot 1 (défaut)
 * Chrome-Scrape-2 → slot 2 (parallélisme : node script.js --slot=2)
 *
 * Usage: node scripts/setup-scrape-profile.js
 * À relancer si les cookies TCDB expirent.
 */
const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const LOCAL = process.env.LOCALAPPDATA || path.join('C:\\Users', process.env.USERNAME, 'AppData', 'Local')
const SRC   = path.join(LOCAL, 'Google', 'Chrome', 'User Data', 'Default')

if (!fs.existsSync(SRC)) {
  console.error('❌ Chrome introuvable à:', SRC)
  process.exit(1)
}

function copyProfile(dstRootName) {
  const DST_ROOT = path.join(LOCAL, dstRootName)
  const DST      = path.join(DST_ROOT, 'Default')

  console.log(`\n📋 Copie du profil Chrome → ${dstRootName}...`)
  console.log('   Source:', SRC)
  console.log('   Dest  :', DST)

  fs.mkdirSync(DST_ROOT, { recursive: true })
  fs.mkdirSync(DST, { recursive: true })

  try {
    execSync(
      `robocopy "${SRC}" "${DST}" /E /COPYALL /R:0 /W:0 /NFL /NDL /NJH /NJS /NC /NS ` +
      `/XD "Cache" "Code Cache" "GPUCache" "ShaderCache" "Service Worker" "CacheStorage" "blob_storage" "databases" ` +
      `/XF "*.log" "lockfile" "RunningChromeVersion"`,
      { stdio: 'pipe' }
    )
  } catch (e) {
    if (e.status > 7) console.warn('⚠️  robocopy a eu des erreurs (fichiers verrouillés ignorés)')
  }

  const localState = path.join(LOCAL, 'Google', 'Chrome', 'User Data', 'Local State')
  if (fs.existsSync(localState)) {
    fs.copyFileSync(localState, path.join(DST_ROOT, 'Local State'))
  }

  const srcNetwork = path.join(SRC, 'Network')
  const dstNetwork = path.join(DST, 'Network')
  if (fs.existsSync(srcNetwork)) {
    try {
      execSync(
        `robocopy "${srcNetwork}" "${dstNetwork}" /E /COPYALL /R:0 /W:0 /NFL /NDL /NJH /NJS /NC /NS`,
        { stdio: 'pipe' }
      )
    } catch (e) { if (e.status > 7) console.warn('⚠️  robocopy Network: erreurs partielles') }
  }

  const cookiesOld = path.join(DST, 'Cookies')
  const cookiesNew = path.join(DST, 'Network', 'Cookies')
  const cookies = fs.existsSync(cookiesNew) ? cookiesNew : cookiesOld
  if (fs.existsSync(cookies)) {
    const size = fs.statSync(cookies).size
    console.log(`✅ ${dstRootName} prêt (Cookies: ${Math.round(size/1024)} KB)`)
  } else {
    console.warn(`⚠️  ${dstRootName}: Cookies non copiés. Essai copie directe...`)
    for (const p of [path.join(SRC,'Network','Cookies'), path.join(SRC,'Cookies')]) {
      if (!fs.existsSync(p)) continue
      const d = path.dirname(p.replace(SRC, DST))
      fs.mkdirSync(d, { recursive: true })
      try { fs.copyFileSync(p, p.replace(SRC, DST)); console.log('✅ Copie directe OK:', p) }
      catch(e) { console.warn('❌', e.message) }
    }
  }
}

copyProfile('Chrome-Scrape')
copyProfile('Chrome-Scrape-2')

console.log('\n🎯 Les deux slots sont prêts :')
console.log('   Slot 1 (défaut) : node scripts/scrape-all-years-baseball.js')
console.log('   Slot 2 (parallèle) : node scripts/scrape-all-years-hockey.js --slot=2')
