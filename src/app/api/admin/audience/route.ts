/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 60

const admin = createServerServiceClient()
const TZ: Record<string, string> = { US: 'America/New_York', CA: 'America/Toronto', GB: 'Europe/London', DE: 'Europe/Berlin', FR: 'Europe/Paris', ES: 'Europe/Madrid', IT: 'Europe/Rome', BE: 'Europe/Brussels', CH: 'Europe/Zurich' }
const hourIn = (d: Date, tz: string) => parseInt(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d))

// forme canonique d'un chemin : les identifiants deviennent « :id » pour regrouper (« /galerie/abc… » = « /galerie/:id »)
const norm = (p: string) => {
  const parts = (p || '/').split('?')[0].split('/').filter(Boolean)
  if (!parts.length) return '/'
  const head = parts[0]
  const dyn = ['galerie', 'joueur', 'equipe', 'cartes', 's', 'c', 'setlist', 'teams', 'guides', 'quiz', 'trades', 'profil']
  if (parts.length > 1 && dyn.includes(head) && !['ajouter', 'ajouter-lot'].includes(parts[1])) return '/' + head + '/:id'
  return '/' + parts.slice(0, 2).join('/')
}

let cache: { at: number; data: unknown } | null = null

// GET : (910) pages les plus vues sur 7 jours contre les 7 précédents ; (907) heures d'affluence par pays sur 30 jours ; (906) sources des visites et des inscrits.
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (cache && Date.now() - cache.at < 10 * 60 * 1000 && !req.nextUrl.searchParams.get('fresh')) return NextResponse.json(cache.data)

  const now = Date.now(), since30 = new Date(now - 30 * 86400000).toISOString()
  type V = { path: string; country: string; created_at: string; src?: string | null }
  const rows: V[] = []
  let withSrc = true
  for (let o = 0; o < 80000; o += 1000) {
    const cols = withSrc ? 'path, country, created_at, src' : 'path, country, created_at'
    let res = await (admin.from('page_views') as any).select(cols).gte('created_at', since30).order('created_at', { ascending: false }).range(o, o + 999)
    if (res.error && withSrc) {                   // migration 20261123 pas encore appliquée : on lit sans la source
      withSrc = false
      res = await (admin.from('page_views') as any).select('path, country, created_at').gte('created_at', since30).order('created_at', { ascending: false }).range(o, o + 999)
    }
    const { data, error } = res as { data: unknown[] | null; error: { message: string } | null }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...((data || []) as V[]))
    if (!data || data.length < 1000) break
  }

  // 910 : pages
  const t7 = now - 7 * 86400000, t14 = now - 14 * 86400000
  const cur = new Map<string, number>(), prev = new Map<string, number>()
  for (const r of rows) {
    const t = new Date(r.created_at).getTime(), k = norm(r.path)
    if (t >= t7) cur.set(k, (cur.get(k) || 0) + 1)
    else if (t >= t14) prev.set(k, (prev.get(k) || 0) + 1)
  }
  const pages = [...cur.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([path, n]) => ({ path, n, prev: prev.get(path) || 0 }))

  // 907 : heures par pays (heure locale du pays, et heure de France pour programmer)
  const byCountry = new Map<string, { total: number; local: number[]; fr: number[] }>()
  for (const r of rows) {
    const tz = TZ[r.country]; if (!tz) continue
    const d = new Date(r.created_at)
    const e = byCountry.get(r.country) || { total: 0, local: Array(24).fill(0), fr: Array(24).fill(0) }
    e.total++; e.local[hourIn(d, tz)]++; e.fr[hourIn(d, 'Europe/Paris')]++
    byCountry.set(r.country, e)
  }
  const peak = (a: number[]) => { let best = 0, at = 0; for (let h = 0; h < 24; h++) { const s = a[h] + a[(h + 1) % 24] + a[(h + 2) % 24]; if (s > best) { best = s; at = h } } return at }
  const hours = [...byCountry.entries()].sort((a, b) => b[1].total - a[1].total).map(([country, e]) => ({ country, total: e.total, local: e.local, fr: e.fr, peakLocal: peak(e.local), peakFr: peak(e.fr) }))

  // 906 : sources
  const srcVisits = new Map<string, number>()
  for (const r of rows) { const k = r.src || '(direct ou inconnue)'; srcVisits.set(k, (srcVisits.get(k) || 0) + 1) }
  const signups = new Map<string, number>()
  let srcTable = true
  {
    const { data, error } = await admin.from('user_sources').select('src').gte('created_at', since30).limit(5000)
    if (error) srcTable = false
    for (const r of data || []) signups.set(r.src, (signups.get(r.src) || 0) + 1)
  }
  const sources = [...new Set([...srcVisits.keys(), ...signups.keys()])].map(src => ({ src, visits: srcVisits.get(src) || 0, signups: signups.get(src) || 0 })).sort((a, b) => b.visits - a.visits).slice(0, 30)

  const data = { sampled: rows.length, since: since30, pages, hours, sources, sourcesReady: withSrc && srcTable }
  cache = { at: Date.now(), data }
  return NextResponse.json(data)
}
