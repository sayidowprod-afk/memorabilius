import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseTcdbPdf } from '@/lib/tcdbPdf'
import { resolveCollectionLine, findEntry, sameName, sportsForTcdb, type ISet, type IEntry } from '@/lib/tcdbImport'
import { norm } from '@/lib/setMatcher'

export const maxDuration = 60

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SPORT_WORDS = /\b(basketball|football|baseball|hockey|soccer)\b/gi
const setKey = (s: string) => norm(s.replace(SPORT_WORDS, ''))

async function loadSets(sports: string[] | null): Promise<ISet[]> {
  const out: ISet[] = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('card_sets').select('id, name, year, sport').order('id').range(from, from + 999)
    if (sports) q = q.in('sport', sports)
    const { data } = await q
    out.push(...((data || []) as ISet[]))
    if (!data || data.length < 1000) break
  }
  return out
}

async function loadEntries(setId: number): Promise<IEntry[]> {
  const out: IEntry[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('card_set_entries').select('id, card_number, player_name, variation, set_id').eq('set_id', setId).order('id').range(from, from + 999)
    out.push(...((data || []) as IEntry[]))
    if (!data || data.length < 1000) break
  }
  return out
}

// Prefixe lisible d'une ligne dont le set n'existe pas chez nous (pour grouper "set manquant")
function setGuess(text: string): string {
  const w = text.split(/\s+/)
  let i = 3
  while (i < w.length - 1 && !/^(\d+[a-zA-Z]?|[A-Za-z]{1,6}-?[A-Za-z]{0,3}\d+)$/.test(w[i])) i++
  return w.slice(0, Math.min(i, 8)).join(' ')
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  const dryRun = form.get('dryRun') !== 'false'
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
  if (file.size > 4_000_000) return NextResponse.json({ error: 'PDF trop volumineux (4 Mo max)' }, { status: 413 })

  let pdf
  try { pdf = await parseTcdbPdf(new Uint8Array(await file.arrayBuffer())) }
  catch { return NextResponse.json({ error: 'Lecture du PDF impossible. Utilise le PDF imprimable de TCDB (Checklist, Your Collection ou Collection Print).' }, { status: 422 }) }

  // 1. lignes possedees -> {setId, num, variation, name}
  type Want = { setId: number; num: string; variation: string; name: string; text: string }
  const wants: Want[] = []
  const setMissing = new Map<string, number>()
  let numMissing = 0
  let totalLines = 0

  if (pdf.kind === 'collection') {
    const sets = await loadSets(sportsForTcdb(pdf.sport))
    totalLines = pdf.entries.length
    for (const text of pdf.entries) {
      const r = resolveCollectionLine(text, sets)
      if ('error' in r) {
        if (r.error === 'set') { const g = setGuess(text); setMissing.set(g, (setMissing.get(g) || 0) + 1) } else numMissing++
      } else wants.push({ ...r, text })
    }
  } else {
    const owned = pdf.rows.filter(r => r.owned)
    totalLines = pdf.rows.length
    if (!pdf.hasOwnedMarks) return NextResponse.json({ error: 'Ce PDF est une checklist vide (aucune carte cochée). Télécharge « Your Collection » ou « Collection Print » depuis TCDB.' }, { status: 422 })
    const ym = pdf.title.match(/^(\d{4})/)
    const year = ym ? parseInt(ym[1]) : null
    // le titre d'un set TCDB porte son sport ("2025-26 Topps Basketball") : indispensable pour ne pas confondre avec "2025 Topps" (baseball)
    const sw = pdf.title.match(SPORT_WORDS)?.[0] || null
    const sets = await loadSets(sw ? sportsForTcdb(sw) : null)
    const key = setKey(pdf.title.replace(/^\d{4}(-\d{2,4})?\s*/, ''))
    const cands = sets.filter(s => (year == null || s.year === year) && setKey(s.name.replace(/^\d{4}(-\d{2,4})?\s*/, '')) === key)
    if (cands.length !== 1) {
      return NextResponse.json({ kind: pdf.kind, title: pdf.title, totalLines, owned: owned.length, matched: 0, alreadyHad: 0, imported: 0, setMissing: [{ set: pdf.title, count: owned.length }], unmatched: 0, dryRun })
    }
    for (const r of owned) wants.push({ setId: cands[0].id, num: r.num, variation: '', name: r.name, text: `${r.num} ${r.name}` })
  }

  // 2. entrees de checklist correspondantes, set par set
  const bySet = new Map<number, Want[]>()
  for (const w of wants) (bySet.get(w.setId) || bySet.set(w.setId, []).get(w.setId)!).push(w)
  const matchedIds = new Set<number>()
  const perSet: { setId: number; count: number }[] = []
  const unmatched: string[] = []
  let nameMismatch = 0
  for (const [setId, ws] of bySet) {
    const entries = await loadEntries(setId)
    let c = 0
    for (const w of ws) {
      const e = findEntry(entries, w)
      if (!e) { unmatched.push(w.text); continue }
      if (!sameName(e.player_name, w.name)) { nameMismatch++; unmatched.push(w.text); continue }
      if (!matchedIds.has(e.id)) { matchedIds.add(e.id); c++ }
    }
    perSet.push({ setId, count: c })
  }

  // 3. ecriture : tout ce qui vient du PDF est une case cochee A LA MAIN (jamais effacee par la synchro)
  const ids = [...matchedIds]
  const existing = new Map<number, { id: string; manually_checked: boolean }>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase.from('user_set_completion').select('id, entry_id, manually_checked').eq('user_id', user.id).in('entry_id', ids.slice(i, i + 500))
    for (const r of data || []) existing.set(r.entry_id, { id: r.id, manually_checked: r.manually_checked })
  }
  const toInsert = ids.filter(id => !existing.has(id))
  const toUpgrade = ids.filter(id => existing.get(id) && !existing.get(id)!.manually_checked)
  if (!dryRun) {
    for (let i = 0; i < toInsert.length; i += 500) {
      await supabase.from('user_set_completion').upsert(toInsert.slice(i, i + 500).map(entry_id => ({ user_id: user.id, entry_id, manually_checked: true })), { onConflict: 'user_id,entry_id', ignoreDuplicates: true })
    }
    for (let i = 0; i < toUpgrade.length; i += 500) {
      await supabase.from('user_set_completion').update({ manually_checked: true }).eq('user_id', user.id).in('entry_id', toUpgrade.slice(i, i + 500))
    }
  }

  const setNames = new Map<number, string>()
  if (perSet.length) {
    const { data } = await supabase.from('card_sets').select('id, name').in('id', perSet.map(p => p.setId))
    for (const s of data || []) setNames.set(s.id, s.name)
  }
  return NextResponse.json({
    kind: pdf.kind, title: pdf.title, dryRun,
    totalLines,
    owned: pdf.kind === 'collection' ? pdf.entries.length : wants.length,
    matched: ids.length,
    alreadyHad: ids.length - toInsert.length,
    imported: dryRun ? 0 : toInsert.length + toUpgrade.length,
    sets: perSet.filter(p => p.count > 0).map(p => ({ name: setNames.get(p.setId) || String(p.setId), count: p.count })).sort((a, b) => b.count - a.count),
    setMissing: [...setMissing.entries()].map(([set, count]) => ({ set, count })).sort((a, b) => b.count - a.count),
    unmatched: unmatched.length + numMissing,
    unmatchedSamples: unmatched.slice(0, 15),
    nameMismatch,
  })
}
