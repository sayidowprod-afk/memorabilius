#!/usr/bin/env node
/**
 * Copie le profil Chrome Default vers un répertoire isolé (Chrome-Scrape)
 * pour que le scraper puisse tourner sans fermer Chrome.
 *
 * Usage: node scripts/setup-scrape-profile.js
 * À relancer si les cookies TCDB expirent.
 */
const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const LOCAL = process.env.LOCALAPPDATA || path.join('C:\\Users', process.env.USERNAME, 'AppData', 'Local')
const SRC   = path.join(LOCAL, 'Google', 'Chrome', 'User Data', 'Default')
const DST_ROOT = path.join(LOCAL, 'Chrome-Scrape')
const DST   = path.join(DST_ROOT, 'Default')

if (!fs.existsSync(SRC)) {
  console.error('❌ Chrome introuvable à:', SRC)
  process.exit(1)
}

console.log('📋 Copie du profil Chrome → Chrome-Scrape...')
console.log('   Source:', SRC)
console.log('   Dest  :', DST)

fs.mkdirSync(DST_ROOT, { recursive: true })
fs.mkdirSync(DST, { recursive: true })

// Copie via robocopy (ignore les fichiers verrouillés par Chrome)
// /XD = exclure les dossiers cache (trop lourds et inutiles)
// /XF = exclure les fichiers verrouillés connus
// /NFL /NDL /NJH /NJS /NC /NS = output minimal
try {
  execSync(
    `robocopy "${SRC}" "${DST}" /E /COPYALL /R:0 /W:0 /NFL /NDL /NJH /NJS /NC /NS ` +
    `/XD "Cache" "Code Cache" "GPUCache" "ShaderCache" "Service Worker" "CacheStorage" "blob_storage" "databases" ` +
    `/XF "*.log" "lockfile" "RunningChromeVersion"`,
    { stdio: 'pipe' }
  )
} catch (e) {
  // robocopy retourne un code != 0 même en cas de succès partiel (codes 1-7 = OK)
  if (e.status > 7) {
    console.warn('⚠️  robocopy a eu des erreurs (fichiers verrouillés ignorés)')
  }
}

// Copie aussi Local State (nécessaire pour les profils Chrome)
const localState = path.join(LOCAL, 'Google', 'Chrome', 'User Data', 'Local State')
if (fs.existsSync(localState)) {
  fs.copyFileSync(localState, path.join(DST_ROOT, 'Local State'))
}

// Copie aussi le dossier Network (Chrome 118+ stocke les cookies ici)
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

// Vérifie Cookies (ancien emplacement ou nouveau)
const cookiesOld = path.join(DST, 'Cookies')
const cookiesNew = path.join(DST, 'Network', 'Cookies')
const cookies = fs.existsSync(cookiesNew) ? cookiesNew : cookiesOld
if (fs.existsSync(cookies)) {
  const size = fs.statSync(cookies).size
  console.log(`✅ Profil copié (Cookies: ${Math.round(size/1024)} KB — ${cookies})`)
  console.log('   Le scraper utilisera Chrome-Scrape — Chrome peut rester ouvert.')
} else {
  console.warn('⚠️  Cookies non copiés. Essai copie directe...')
  // Copie directe en fallback
  for (const p of [path.join(SRC,'Network','Cookies'), path.join(SRC,'Cookies')]) {
    if (!fs.existsSync(p)) continue
    const d = path.dirname(p.replace(SRC, DST))
    fs.mkdirSync(d, { recursive: true })
    try { fs.copyFileSync(p, p.replace(SRC, DST)); console.log('✅ Copie directe OK:', p) } catch(e) { console.warn('❌', e.message) }
  }
}
