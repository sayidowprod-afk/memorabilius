import type { SupabaseClient } from '@supabase/supabase-js'

// Relie chaque sortie du calendrier à un set de notre setlist, et importe automatiquement la checklist d'un set absent.
// Conventions identiques à scripts/scrape-checklistinsider.js : base = variation null ; « Base Ruby » = « RUBY » ; autres = nom de la section en
// majuscules ; sets créés sans tcdb_id (ou avec un identifiant négatif synthétique si la base l'exige) ; un set déjà présent n'est jamais modifié.

const FORMAT_WORDS = /\b(basketball|hobby|jumbo|mega|value|retail|blaster|hanger|fotl|cello|choice|breaker|box|boxes|case|pack|packs)\b/gi

export const yearOf = (name: string): number | null => { const m = name.match(/\b(20\d{2}|19\d{2})\b/); return m ? Number(m[1]) : null }
export const sportOf = (name: string): 'wnba' | 'nba' => (/\bwnba\b/i.test(name) ? 'wnba' : 'nba')
// Nom du set comme dans notre base : sans « Basketball » ni format de boîte ; pour la WNBA, « WNBA » en fin de nom (ex. « 2025 Panini Impeccable WNBA »)
export const cleanSetName = (name: string): string => {
  const base = name.replace(FORMAT_WORDS, ' ').replace(/\s+/g, ' ').trim()
  return /\bwnba\b/i.test(base) ? `${base.replace(/\bwnba\b/gi, ' ').replace(/\s+/g, ' ').trim()} WNBA` : base
}
const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bwnba\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
export const normSetName = (name: string) => strip(cleanSetName(name))

const MANUFACTURERS = ['Topps', 'Panini', 'Upper Deck', 'Leaf', 'Donruss', 'Bowman', 'Fanatics', 'Hit Parade']
export const brandOf = (clean: string): string => {
  for (const m of MANUFACTURERS) if (new RegExp(`\\b${m}\\b`, 'i').test(clean)) return m
  return clean.replace(/^\s*\d{4}(?:-\d{2,4})?\s*/, '').split(' ')[0] || 'Divers'
}

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

export type ChecklistEntry = { card_number: string; player_name: string; team: string | null; variation: string | null; is_rc: boolean; is_auto: boolean }

// « Base Cards » -> null (base) ; « Base Cards Blackout » -> « BLACKOUT » ; autres sections -> leur nom en majuscules
const stripBase = (v: string): string | null => {
  if (/^base(\s+cards?)?$/i.test(v.trim())) return null
  return v.replace(/^Base(\s+Cards?)?\s+/i, '').trim().toUpperCase()
}
const AUTO_RE = /autograph|signature|signed|\bmarks\b|applicants|real one auto/i

// Page « full-checklist » : une section par <h3 class="sh"><span>Nom<small>N cards</small></span></h3>, puis un tableau (#, PLAYER, TEAM).
export function parseChecklistHtml(html: string): ChecklistEntry[] {
  const out: ChecklistEntry[] = []
  const seen = new Set<string>()
  const parts = html.split('<h3 class="sh"').slice(1)
  for (const part of parts) {
    const head = part.match(/<span>([\s\S]*?)<small>/)
    if (!head) continue
    const name = decode(head[1].replace(/<[^>]+>/g, ''))
    const table = part.match(/<table class="ckt[^"]*">([\s\S]*?)<\/table>/)
    if (!name || !table) continue
    const variation = stripBase(name)
    const auto = AUTO_RE.test(name)
    for (const r of table[1].matchAll(/<tr><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td><td>([\s\S]*?)<\/td>/g)) {
      const number = decode(r[1].replace(/<[^>]+>/g, ''))
      const rc = /<i>\s*RC\s*<\/i>/i.test(r[2])
      const player = decode(r[2].replace(/<i>\s*RC\s*<\/i>/gi, '').replace(/<[^>]+>/g, ''))
      const team = decode(r[3].replace(/<[^>]+>/g, '')) || null
      if (!number || !player) continue
      const key = `${number}|${player.toLowerCase()}|${variation ?? ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ card_number: number, player_name: player, team, variation, is_rc: rc, is_auto: auto })
    }
  }
  return out
}

type Release = { id: number; name: string; release_date: string; source_url: string | null; set_id: number | null }

export async function findSetId(supabase: SupabaseClient, name: string): Promise<number | null> {
  const year = yearOf(name)
  if (!year) return null
  const { data } = await supabase.from('card_sets').select('id, name, sport').eq('year', year).in('sport', ['nba', 'wnba']).limit(2000)
  const want = normSetName(name)
  const wantSport = sportOf(name)
  const hits = (data ?? []).filter(s => normSetName(s.name) === want && (s.sport === wantSport || !/wnba/i.test(name) === (s.sport === 'nba')))
  return hits.length ? hits[0].id : null
}

async function createSet(supabase: SupabaseClient, name: string, year: number, brand: string, sport: string, total: number): Promise<number | null> {
  const body = { name, year, brand, sport, total_cards: total }
  let r = await supabase.from('card_sets').insert({ ...body, tcdb_id: null }).select('id').single()
  if (r.error || !r.data) {
    let h = 0; for (const ch of name + year) h = (h * 31 + ch.charCodeAt(0)) | 0
    r = await supabase.from('card_sets').insert({ ...body, tcdb_id: -Math.abs(h || 1) }).select('id').single()
  }
  return r.data?.id ?? null
}

// Importe la checklist d'une sortie (set absent de notre base). Renvoie l'id du set créé, ou null.
export async function importChecklist(supabase: SupabaseClient, rel: Release): Promise<number | null> {
  if (!rel.source_url || !/\/full-checklist\//.test(rel.source_url)) return null
  const clean = cleanSetName(rel.name)
  const year = yearOf(clean)
  if (!year) return null
  let html = ''
  try {
    const r = await fetch(rel.source_url, { headers: { 'User-Agent': 'MemorabiliusBot/1.0 (+https://www.memorabilius.fr)' }, cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!r.ok) return null
    html = await r.text()
  } catch { return null }
  const entries = parseChecklistHtml(html)
  if (entries.length < 20) return null // page sans checklist exploitable : on n'invente rien
  const setId = await createSet(supabase, clean, year, brandOf(clean), sportOf(rel.name), entries.length)
  if (!setId) return null
  for (let i = 0; i < entries.length; i += 500) {
    const batch = entries.slice(i, i + 500).map(e => ({ set_id: setId, ...e }))
    const { error } = await supabase.from('card_set_entries').insert(batch)
    if (error) { await supabase.from('card_set_entries').delete().eq('set_id', setId); await supabase.from('card_sets').delete().eq('id', setId); return null }
  }
  return setId
}

export type LinkResult = { linked: number; imported: number }

// Pour les sorties à venir sans set : cherche un set existant ; sinon importe (au plus 2 checklists par passage, pour rester dans le temps imparti).
export async function linkReleasesToSets(supabase: SupabaseClient): Promise<LinkResult> {
  const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('card_releases').select('id, name, release_date, source_url, set_id').gte('release_date', from).is('set_id', null).limit(100)
  if (error || !data?.length) return { linked: 0, imported: 0 } // colonne set_id absente (migration pas passée) ou rien à faire
  let linked = 0, imported = 0
  const byBase = new Map<string, number>() // nom normalisé -> set (évite d'importer deux fois « Mega Box » et la boîte de base)
  const rels = [...data as Release[]].sort((a, b) => Number(/\b(mega|jumbo|value|hobby)\b/i.test(a.name)) - Number(/\b(mega|jumbo|value|hobby)\b/i.test(b.name)))
  for (const rel of rels) {
    const key = normSetName(rel.name)
    let setId: number | null = byBase.get(key) ?? await findSetId(supabase, rel.name)
    // une boîte précise (Mega, Hobby…) n'a pas la checklist complète : on la relie au set de base, on ne l'importe pas
    const isFormat = /\b(mega|jumbo|value|hobby|retail|blaster|hanger|cello)\b/i.test(rel.name)
    if (!setId && !isFormat && imported < 2) {
      setId = await importChecklist(supabase, rel)
      if (setId) imported++
    }
    if (setId) {
      byBase.set(key, setId)
      const { error: e } = await supabase.from('card_releases').update({ set_id: setId }).eq('id', rel.id)
      if (!e) linked++
    }
  }
  return { linked, imported }
}
