import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 60

const admin = createServerServiceClient()
const nk = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }

interface SetRow { id: number; name: string; year: number | null; sport: string; total_cards: number | null; tcdb_id: number | null }

// GET ?max=5 : (866) les sets qui ont moins de `max` cartes, avec le nombre de lignes réellement en base ; (867) les sets en double (même sport, année et nom).
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const max = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get('max') || '5') || 5))

  const all: SetRow[] = []
  for (let o = 0; o < 20000; o += 1000) {
    const { data, error } = await admin.from('card_sets').select('id, name, year, sport, total_cards, tcdb_id').order('id').range(o, o + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all.push(...((data || []) as SetRow[]))
    if (!data || data.length < 1000) break
  }

  // doublons
  const groups = new Map<string, SetRow[]>()
  for (const s of all) { const k = s.sport + '|' + s.year + '|' + nk(s.name); groups.set(k, [...(groups.get(k) || []), s]) }
  const dupGroups = [...groups.values()].filter(g => g.length > 1)

  // incomplets : on vérifie le nombre de lignes réelles (le total enregistré peut être faux)
  const small = all.filter(s => (s.total_cards ?? 0) < max).sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 300)
  const counts = new Map<number, number>()
  for (const part of chunk(small, 15)) {
    await Promise.all(part.map(async s => {
      const { count } = await admin.from('card_set_entries').select('id', { count: 'exact', head: true }).eq('set_id', s.id)
      counts.set(s.id, count || 0)
    }))
  }
  const incomplete = small.map(s => ({ ...s, lignes: counts.get(s.id) || 0 }))

  // lignes réelles des sets en double
  const dups = []
  for (const g of dupGroups) {
    const withCounts = await Promise.all(g.map(async s => {
      const { count } = await admin.from('card_set_entries').select('id', { count: 'exact', head: true }).eq('set_id', s.id)
      return { ...s, lignes: count || 0 }
    }))
    dups.push(withCounts.sort((a, b) => b.lignes - a.lignes))
  }
  return NextResponse.json({ total: all.length, max, incomplete, duplicates: dups })
}

// POST { fromId, toId, dryRun } : (867) fusionne le set `fromId` dans `toId` : les cases cochées et les liens de cartes des membres sont reportés
// sur la ligne équivalente (même numéro + joueur + variation), puis le set en trop est supprimé. `dryRun: true` ne fait que compter.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const fromId = parseInt(String(body?.fromId)), toId = parseInt(String(body?.toId)), dryRun = body?.dryRun !== false
  if (!fromId || !toId || fromId === toId) return NextResponse.json({ error: 'Sets invalides' }, { status: 400 })

  const [{ data: a }, { data: b }] = await Promise.all([
    admin.from('card_sets').select('id, name, year, sport').eq('id', fromId).maybeSingle(),
    admin.from('card_sets').select('id, name, year, sport').eq('id', toId).maybeSingle(),
  ])
  if (!a || !b) return NextResponse.json({ error: 'Set introuvable' }, { status: 404 })
  if (a.sport !== b.sport || a.year !== b.year || nk(a.name) !== nk(b.name)) return NextResponse.json({ error: 'Ces deux sets ne sont pas des doublons (sport, année et nom différents).' }, { status: 400 })

  type E = { id: number; card_number: string | null; player_name: string; variation: string | null; image_url: string | null }
  const load = async (setId: number) => {
    const out: E[] = []
    for (let o = 0; o < 100000; o += 1000) {
      const { data } = await admin.from('card_set_entries').select('id, card_number, player_name, variation, image_url').eq('set_id', setId).order('id').range(o, o + 999)
      out.push(...((data || []) as E[]))
      if (!data || data.length < 1000) break
    }
    return out
  }
  const [src, dst] = await Promise.all([load(fromId), load(toId)])
  const key = (e: E) => (e.card_number || '') + '|' + e.player_name + '|' + (e.variation || '')
  const dstByKey = new Map(dst.map(e => [key(e), e]))
  const map = new Map<number, E>()   // ligne du set en trop -> ligne équivalente du bon set
  for (const e of src) { const t = dstByKey.get(key(e)); if (t) map.set(e.id, t) }
  const srcIds = src.map(e => e.id)

  const comps: { id: string; user_id: string; entry_id: number }[] = []
  for (const part of chunk(srcIds, 200)) {
    const { data } = await admin.from('user_set_completion').select('id, user_id, entry_id').in('entry_id', part)
    comps.push(...((data || []) as typeof comps))
  }
  const links: { id: string; set_entry_id: number }[] = []
  for (const part of chunk(srcIds, 200)) {
    const { data } = await admin.from('cartes_manuelles').select('id, set_entry_id').in('set_entry_id', part)
    links.push(...((data || []) as typeof links))
  }
  // cases déjà cochées sur la ligne de destination par le même membre
  const dstIds = [...new Set(comps.map(c => map.get(c.entry_id)?.id).filter((x): x is number => !!x))]
  const existing = new Set<string>()
  for (const part of chunk(dstIds, 200)) {
    const { data } = await admin.from('user_set_completion').select('user_id, entry_id').in('entry_id', part)
    for (const r of data || []) existing.add(r.user_id + '|' + r.entry_id)
  }
  const toMove = comps.filter(c => { const t = map.get(c.entry_id); return t && !existing.has(c.user_id + '|' + t.id) })
  const already = comps.filter(c => { const t = map.get(c.entry_id); return t && existing.has(c.user_id + '|' + t.id) }).length
  const lost = comps.filter(c => !map.get(c.entry_id)).length
  const summary = { from: a.name + ' (#' + fromId + ', ' + src.length + ' lignes)', to: b.name + ' (#' + toId + ', ' + dst.length + ' lignes)', casesReportees: toMove.length, casesDejaCochees: already, casesSansEquivalent: lost, liensDeCartes: links.length }
  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, ...summary })

  // 1) cases cochées
  for (const c of toMove) {
    const t = map.get(c.entry_id)!
    await admin.from('user_set_completion').update({ entry_id: t.id }).eq('id', c.id)
  }
  // 2) liens carte ↔ ligne
  for (const l of links) {
    const t = map.get(l.set_entry_id)
    await admin.from('cartes_manuelles').update({ set_entry_id: t ? t.id : null }).eq('id', l.id)
  }
  // 3) images déjà connues pour des lignes qui n'en avaient pas dans le bon set
  for (const e of src) { const t = map.get(e.id); if (t && e.image_url && !t.image_url) await admin.from('card_set_entries').update({ image_url: e.image_url }).eq('id', t.id) }
  // 4) suppression du set en trop (ses lignes d'abord)
  for (const part of chunk(srcIds, 500)) await admin.from('card_set_entries').delete().in('id', part)
  const { error } = await admin.from('card_sets').delete().eq('id', fromId)
  if (error) return NextResponse.json({ error: 'Cases reportées, mais le set n’a pas pu être supprimé : ' + error.message, ...summary }, { status: 500 })
  return NextResponse.json({ ok: true, dryRun: false, ...summary })
}
