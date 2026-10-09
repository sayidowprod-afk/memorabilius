// Releve des chiffres PUBLICS (memes sources que la page d'accueil : le compte de demonstration est exclu).
// Usage : node scripts/presskit/stats.js  -> scripts/presskit/work/stats.json
const fs = require('fs')
const path = require('path')
const env = {}
for (const l of fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const { createClient } = require('@supabase/supabase-js')
const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  const out = {}
  out.collectors = (await c.from('profiles').select('*', { count: 'exact', head: true }).eq('is_demo', false)).count
  out.cards = (await c.rpc('get_total_cards')).data
  out.binders = (await c.from('binders').select('*', { count: 'exact', head: true }).neq('is_public', false).gte('page_count', 1)).count
  out.trade = (await c.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('disponible_vente', true)).count
  out.date = new Date().toISOString().slice(0, 10)
  fs.mkdirSync(path.join(__dirname, 'work'), { recursive: true })
  fs.writeFileSync(path.join(__dirname, 'work', 'stats.json'), JSON.stringify(out, null, 1))
  console.log(out)
})()
