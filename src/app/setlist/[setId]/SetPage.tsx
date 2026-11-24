'use client'
/* eslint-disable @next/next/no-img-element */
// Page d'un set : chiffres clés, top 5 rookies (draft de l'année), signatures, cartes par série, franchises, rainbow.
// Les blocs sans données (pas de rookie, pas d'équipe, pas de carte signée…) sont masqués : la même page sert tous les sets.
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { TEAM_COLORS } from '@/lib/teamColors'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import SetlistReportDialog from '@/components/SetlistReportDialog'
import './sl2.css'

type SetInfo = { id: number; name: string; year: number | null; brand: string | null; sport: string; total_cards: number }
type Entry = { id: number; card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean; is_auto: boolean; image_url: string | null }
type Series = { name: string; cnt: number; kind: 'base' | 'ins' | 'auto' | 'mem' | 'par'; baseParallel?: boolean }
type Rook = { name: string; team: string | null; cards: number; autos: number; img: string | null }
type Overview = { base: number; rookies: number; autos: number; signers: number; teams: { team: string; n: number }[]; rookieTop: Rook[]; signerTop: { name: string; team: string | null; n: number }[]; hunt: Entry[]; baseRows: Entry[] }

const SPORT_LABEL: Record<string, string> = { nba: 'NBA', nfl: 'NFL', baseball: 'Baseball', hockey: 'Hockey', pokemon: 'Pokémon', mtg: 'Magic', 'non-sport': 'Non-sport' }
const SPORT_API: Record<string, string> = { nba: 'nba', nfl: 'nfl', hockey: 'nhl', baseball: 'mlb' }
const normStr = (t: string) => t?.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '') || ''
const kindOf = (name: string): Series['kind'] => /AUTO|SIGNATURE|SIGNED/i.test(name) ? 'auto' : /RELIC|JERSEY|PATCH|FABRIC|REMNANT|MEMORABILIA|SWATCH|WOVEN/i.test(name) ? 'mem' : 'ins'
const nice = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/\bRc\b/, 'RC')
const ini = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
const fmt = (n: number) => n.toLocaleString('fr-FR')
const normN = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const slug = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// photo de la boîte : public/set-boxes/<saison>-<marque>-<set>-cover.webp (« 2025-26 Topps » seul = le Flagship)
function boxFor(name: string, files: string[]): string | null {
  let sl = slug(name)
  if (/^\d{4}-\d{2}-topps$/.test(sl)) sl += '-flagship'
  const f = `${sl}-cover.webp`
  return files.includes(f) ? `/set-boxes/${f}` : null
}
const tkey = (n: string) => n.toLowerCase().replace(/^los angeles /, 'la ').replace(/\s+/g, ' ').trim()
// cartes d'une franchise sans parallèles/couleurs, valable pour tous les sets : une série dont les cartes (numéro + joueur) sont déjà dans la base,
// ou dans la série dont elle porte le nom (« Autographs Fast Break Black » ← « Autographs Fast Break »), est un parallèle
function cleanTeamRows(all: Entry[]): Entry[] {
  const isCode = (n: string | null) => !!n && /[A-Za-z]/.test(n)
  const byVar = new Map<string, Entry[]>()
  for (const e of all) { const k = e.variation || 'Base'; (byVar.get(k) || byVar.set(k, []).get(k)!).push(e) }
  const keyOf = (e: Entry) => (e.card_number || '') + '|' + normN(e.player_name)
  const order = [...byVar.entries()].sort((a, b) => (a[0] === 'Base' ? -1 : b[0] === 'Base' ? 1 : b[1].length - a[1].length || a[0].length - b[0].length))
  const keptSets = new Map<string, Set<string>>()
  const keep = new Set<string>()
  for (const [v, es] of order) {
    const isPar = v !== 'Base' && [...keptSets.entries()].some(([k, ks]) => (k === 'Base' || v.toLowerCase().includes(k.toLowerCase())) && es.filter(e => ks.has(keyOf(e))).length / es.length >= 0.5)
    if (!isPar) { keep.add(v); keptSets.set(v, new Set(es.map(keyOf))) }
  }
  // un même joueur avec un code (AFB-BAY) et un numéro dans la même série : on garde le numéro
  const numeric = new Set(all.filter(e => !isCode(e.card_number)).map(e => (e.variation || 'Base') + '|' + normN(e.player_name)))
  return all.filter(e => { const v = e.variation || 'Base'; return keep.has(v) && !(isCode(e.card_number) && numeric.has(v + '|' + normN(e.player_name))) })
}
const LEAGUE_OF: Record<string, string> = { nba: 'nba', nfl: 'nfl', baseball: 'mlb', hockey: 'nhl' }
const teamOf = (name: string | null, sport: string) => { if (!name) return null; const lg = LEAGUE_OF[sport]; return SPORTS_TEAMS.find(t => tkey(t.name) === tkey(name) && (!lg || t.sport === lg)) || null }
const colorOf = (name: string | null, sport: string) => (name && TEAM_COLORS[name]?.primary) || teamOf(name, sport)?.color || '#1b3a8a'
const logoOf = (name: string | null, sport: string) => { const t = teamOf(name, sport); return t ? teamLogoUrl(t, true) : null }

export default function SetPage({ setId }: { setId: string }) {
  const sid = parseInt(setId)
  const [set, setSet] = useState<SetInfo | null>(null)
  const [missing, setMissing] = useState(false)
  const [series, setSeries] = useState<Series[]>([])
  const [ov, setOv] = useState<Overview | null>(null)
  const [owned, setOwned] = useState<Set<number>>(new Set())
  const [loggedIn, setLoggedIn] = useState(false)
  const [uid, setUid] = useState<string | null>(null)
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [seasons, setSeasons] = useState<{ prev: { id: number; name: string } | null; next: { id: number; name: string } | null }>({ prev: null, next: null })
  const [whoHas, setWhoHas] = useState<Map<number, { count: number; members: { id: string; name: string }[] }>>(new Map())   // membres qui ont la carte à échanger
  const [whoOpen, setWhoOpen] = useState<number | null>(null)
  const whoAsked = useRef<Set<number>>(new Set())
  const [reportEntry, setReportEntry] = useState<{ entry: Entry; variation: string } | null>(null)
  const [hiddenPhotos, setHiddenPhotos] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)
  const [wish, setWish] = useState<Map<string, string>>(new Map())   // wishlist : clé (nom|set|variation) -> id
  const [autoBy, setAutoBy] = useState<Record<string, number> | null>(null)   // cartes signées par série (flag is_auto)
  const [loaded, setLoaded] = useState<Record<string, Entry[]>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'all' | Series['kind']>('all')
  const [own, setOwn] = useState<'all' | 'own' | 'miss'>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [q, setQ] = useState('')
  const [sq, setSq] = useState('')
  const [tsort, setTsort] = useState<'n' | 'mine' | 'az'>('az')
  const [limit, setLimit] = useState<Record<string, number>>({})
  const [suggest, setSuggest] = useState<Map<number, { entry_id: number; nom: string; image: string | null; variation: string }>>(new Map())   // cartes de ma galerie qui vont probablement sur cette ligne : à confirmer
  const [mineImg, setMineImg] = useState<Map<number, string>>(new Map())         // mes propres photos (cartes que j'ai reliées à une ligne)
  const [commImg, setCommImg] = useState<Map<number, string>>(new Map())          // photos de la communauté (moteur de correspondance du site)
  const asked = useRef<Set<number>>(new Set())
  const [teamView, setTeamView] = useState<{ name: string; rows: Entry[] | null } | null>(null)
  const [rainbowLimit, setRainbowLimit] = useState(60)
  const [seriesLimit, setSeriesLimit] = useState(40)   // les gros sets ont des centaines de séries : on n'en affiche que quelques-unes à la fois
  const [boxFiles, setBoxFiles] = useState<string[]>([])
  const [draftAll, setDraftAll] = useState<{ pick: number; name: string }[]>([])   // toute la classe de draft de l'année du set
  const [rookieInfo, setRookieInfo] = useState<Record<string, { name: string; team: string | null }>>({})   // nom et équipe du joueur tels qu'ils sont dans notre base
  const [rookieCards, setRookieCards] = useState<Record<string, number> | null>(null)   // cartes (hors parallèles) de chaque joueur de la classe
  const [photos, setPhotos] = useState<Record<string, string | null>>({})

  const SEL = 'id, card_number, player_name, team, variation, is_rc, is_auto, image_url'
  async function pageAll(build: (from: number) => PromiseLike<{ data: unknown[] | null }>, cap = 20000): Promise<Entry[]> {
    const rows: Entry[] = []
    for (let from = 0; from < cap; from += 1000) {
      const { data } = await build(from)
      if (!data?.length) break
      rows.push(...(data as Entry[]))
      if (data.length < 1000) break
    }
    return rows
  }

  useEffect(() => {
    if (!sid) { setMissing(true); return }
    ;(async () => {
      const { data: s } = await supabase.from('card_sets').select('id, name, year, brand, sport, total_cards').eq('id', sid).single()
      if (!s) { setMissing(true); return }
      setSet(s as SetInfo)
      const { data: v } = await supabase.rpc('get_set_variations', { p_set_id: sid })
      const ser: Series[] = (v || []).map((r: { variation: string | null; cnt: number }) => ({ name: r.variation ?? 'Base', cnt: Number(r.cnt), kind: r.variation ? kindOf(r.variation) : 'base' }))
      ser.sort((a, b) => (a.name === 'Base' ? -1 : b.name === 'Base' ? 1 : b.cnt - a.cnt))
      // parallèles : une série qui a autant de cartes que la base (couleurs de la base), ou dont le nom prolonge celui d'une autre série (« MVP Vault Gold Rainbow » → « MVP Vault »)
      const baseCnt = ser.find(x => x.name === 'Base')?.cnt || 0
      const lower = ser.filter(x => x.name !== 'Base').map(x => x.name.toLowerCase())
      for (const x of ser) {
        if (x.name === 'Base') continue
        const lc = x.name.toLowerCase()
        // même nombre de cartes que la base (à ±15 % près : certains parallèles ont quelques cartes de plus ou de moins selon la source)
        if (baseCnt > 0 && Math.abs(x.cnt - baseCnt) <= Math.max(3, Math.round(baseCnt * 0.15))) { x.kind = 'par'; x.baseParallel = true }
        else if (!/(sps?|short prints?)$/.test(lc) && lower.some(m => m !== lc && lc.startsWith(m + ' '))) x.kind = 'par'   // « Companion Cards SPs » = série à part (cartes courtes), pas un parallèle
      }
      setSeries(ser)
      // cartes signées par série : on lit le champ « signée » des cartes (et pas seulement le nom de la série)
      void (async () => {
        const by: Record<string, number> = {}
        for (let from = 0; from < 12000; from += 1000) {
          const { data } = await supabase.from('card_set_entries').select('variation').eq('set_id', sid).eq('is_auto', true).order('id').range(from, from + 999)
          if (!data?.length) break
          for (const r of data as { variation: string | null }[]) { const k = r.variation ?? 'Base'; by[k] = (by[k] || 0) + 1 }
          if (data.length < 1000) break
        }
        setAutoBy(by)
      })()
      setOpen(new Set(ser.length ? [ser[0].name] : []))

      // vue d'ensemble : une seule requête SQL ; repli (lecture par pages) tant que la fonction n'est pas appliquée en base
      let overview: Overview | null = null
      const { data: o, error: oerr } = await supabase.rpc('get_set_overview', { p_set_id: sid })
      if (!oerr && o) overview = { ...(o as Omit<Overview, 'baseRows'>), baseRows: [] }
      if (!overview) {
        const base = await pageAll(from => supabase.from('card_set_entries').select(SEL).eq('set_id', sid).is('variation', null).order('id').range(from, from + 999), 6000)
        const { data: rcd } = await supabase.from('card_set_entries').select(SEL).eq('set_id', sid).eq('is_rc', true).limit(1000)
        const au = await supabase.from('card_set_entries').select('id', { count: 'exact', head: true }).eq('set_id', sid).eq('is_auto', true)
        const { data: sg } = await supabase.from('card_set_entries').select('player_name, team').eq('set_id', sid).eq('is_auto', true).limit(1000)
        const rm = new Map<string, Rook>()
        for (const e of (rcd || []) as Entry[]) { const r = rm.get(e.player_name) || { name: e.player_name, team: e.team, cards: 0, autos: 0, img: null }; r.cards++; if (e.is_auto) r.autos++; if (!r.img && e.image_url) r.img = e.image_url; if (!r.team && e.team) r.team = e.team; rm.set(e.player_name, r) }
        const sm = new Map<string, { name: string; team: string | null; n: number }>()
        for (const r of (sg || []) as { player_name: string; team: string | null }[]) { const k = r.player_name; const e = sm.get(k) || { name: k, team: r.team, n: 0 }; e.n++; sm.set(k, e) }
        const tm = new Map<string, number>(); for (const e of base) if (e.team) tm.set(e.team, (tm.get(e.team) || 0) + 1)
        overview = {
          base: base.length, rookies: rm.size, autos: au.count ?? 0, signers: sm.size,
          teams: [...tm.entries()].map(([team, n]) => ({ team, n })).sort((a, b) => b.n - a.n),
          rookieTop: [...rm.values()].sort((a, b) => b.cards - a.cards || b.autos - a.autos).slice(0, 60),
          signerTop: [...sm.values()].sort((a, b) => b.n - a.n).slice(0, 300),
          hunt: ((rcd || []) as Entry[]).filter(e => e.is_auto).slice(0, 6), baseRows: base,
        }
      }
      setOv(overview)
      // ma progression (lecture seule)
      const { data: ses } = await supabase.auth.getSession(); const uid = ses.session?.user.id
      if (uid) {
        setLoggedIn(true)
        setUid(uid)
        let ids = new Set<number>()
        const mine = new Map<number, string>()
        let synced = false
        // 1) synchro avec ma galerie : les cartes que je possède sont cochées toutes seules (même service que l'ancienne page)
        try {
          type GC = { id?: string; nom: string; annee: string; marque: string; collection: string; collection_tag: string; variation: string; image_recto?: string | null; set_entry_id?: number | null; card_number?: string | null }
          const { data: gc } = await supabase.from('cartes_manuelles').select('id, nom, annee, marque, collection, collection_tag, variation, image_recto, set_entry_id, card_number').eq('user_id', uid)
          let gallery: GC[] = (gc || []) as GC[]
          const { data: prof } = await supabase.from('profiles').select('lien_csv').eq('id', uid).single()
          if (prof?.lien_csv) {
            try {
              const txt = await (await fetch(prof.lien_csv + '&t=' + Date.now())).text()
              gallery = [...gallery, ...txt.split(/\r?\n/).slice(4).flatMap(row => {
                const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                if (!c[0] || !c[0].includes('http')) return []
                return [{ nom: c[2]?.trim() || '', annee: c[4]?.trim() || '', marque: c[5]?.trim() || '', collection: c[6]?.trim() || '', collection_tag: '', variation: c[7]?.trim() || '', card_number: c[13]?.trim() || '', image_recto: c[0]?.trim() || undefined }]
              })]
            } catch { /* CSV indisponible */ }
          }
          const token = ses.session?.access_token
          if (token) {
            const res = await fetch('/api/set-sync', {
              method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ setId: sid, setYear: (s as SetInfo).year, setBrand: (s as SetInfo).brand, setName: (s as SetInfo).name, galleryCards: gallery,
                playerImages: Object.fromEntries(gallery.filter(g => g.image_recto).map(g => [normStr(g.nom), g.image_recto]).filter((e): e is [string, string] => Boolean(e[1]))) }),
            })
            if (res.ok) {
              const d = await res.json() as { completedEntryIds: number[]; completionDetails: Record<string, { matched_card_key?: string | null }>; suggestions?: { entry_id: number; nom: string; image: string | null; variation: string }[] }
              setSuggest(new Map((d.suggestions || []).map(x => [x.entry_id, x])))
              ids = new Set<number>(d.completedEntryIds || [])
              for (const [k, v] of Object.entries(d.completionDetails || {})) if (v?.matched_card_key) mine.set(parseInt(k), v.matched_card_key)
              synced = true
            }
          }
        } catch { /* la synchro a échoué : on lit simplement ce qui est déjà coché */ }
        // 2) repli : lecture simple des cartes déjà cochées
        if (!synced) {
        const { data: c } = await supabase.rpc('get_set_completions', { p_set_id: sid, p_user_id: uid })
        ids = new Set<number>((c || []).map((r: { entry_id: number }) => r.entry_id))
        ; for (const r of (c || []) as { entry_id: number; matched_card_key?: string | null }[]) if (r.matched_card_key) mine.set(r.entry_id, r.matched_card_key)
        if ((c || []).length >= 1000) { // plafond de la fonction : on relit les completions par pages, bornées aux cartes du set
          const lo = await supabase.from('card_set_entries').select('id').eq('set_id', sid).order('id').limit(1)
          const hi = await supabase.from('card_set_entries').select('id').eq('set_id', sid).order('id', { ascending: false }).limit(1)
          const a = lo.data?.[0]?.id, b = hi.data?.[0]?.id
          if (a && b) for (let from = 0; from < 40000; from += 1000) {
            const { data } = await supabase.from('user_set_completion').select('entry_id, matched_card_key').eq('user_id', uid).gte('entry_id', a).lte('entry_id', b).order('entry_id').range(from, from + 999)
            if (!data?.length) break
            for (const r of data as { entry_id: number; matched_card_key?: string | null }[]) { ids.add(r.entry_id); if (r.matched_card_key) mine.set(r.entry_id, r.matched_card_key) }
            if (data.length < 1000) break
          }
        }
        }
        setOwned(ids)
        setMineImg(mine)
      }
    })()
  }, [sid])

  useEffect(() => {
    if (!set) return
    let cancel = false
    const key = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(19|20)\d{2}(-\d{2,4})?\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
    const mine = key(set.name); if (!mine) return
    const longest = mine.split(' ').sort((x, y) => y.length - x.length)[0]
    supabase.from('card_sets').select('id, name, year').eq('sport', set.sport).ilike('name', '%' + longest + '%').limit(80).then(({ data }) => {
      if (cancel) return
      const same = ((data || []) as { id: number; name: string; year: number | null }[]).filter(x => x.year && key(x.name) === mine).sort((a, b) => (a.year || 0) - (b.year || 0))
      const byYear = new Map<number, { id: number; name: string }>()
      for (const x of same) if (!byYear.has(x.year as number)) byYear.set(x.year as number, { id: x.id, name: x.name })
      const list = [...byYear.values()]
      const i = list.findIndex(x => x.id === set.id)
      setSeasons(i < 0 ? { prev: null, next: null } : { prev: i > 0 ? list[i - 1] : null, next: i < list.length - 1 ? list[i + 1] : null })
    })
    return () => { cancel = true }
  }, [set])
  const wishKey = (nom: string, collection: string, variation: string) => `${nom}|${collection}|${variation}`
  useEffect(() => {
    if (!uid) { setWish(new Map()); return }
    supabase.from('wishlist').select('id, nom, collection, variation').eq('user_id', uid)
      .then(({ data }) => setWish(new Map((data || []).map(w => [wishKey(w.nom, w.collection, w.variation || ''), w.id as string]))))
  }, [uid])
  useEffect(() => {
    if (!set?.year || !SPORT_API[set.sport]) return
    fetch(`/api/draft-top?sport=${encodeURIComponent(set.sport)}&year=${set.year}&n=80`).then(r => (r.ok ? r.json() : { picks: [] })).then(d => setDraftAll(Array.isArray(d?.picks) ? d.picks : [])).catch(() => {})
  }, [set?.year, set?.sport])
  useEffect(() => { fetch('/set-boxes/index.json').then(r => (r.ok ? r.json() : [])).then(setBoxFiles).catch(() => {}) }, [])

  const draft = draftAll.slice(0, 5)
  // rookies du set = les cartes (hors parallèles) des joueurs de la draft de l'année : on lit les cartes de ces joueurs puis on écarte les parallèles
  useEffect(() => {
    if (!draftAll.length || !series.length) return
    let off = false
    ;(async () => {
      const plainNames = new Set(series.filter(x => x.kind !== 'par' && x.name !== 'Base').map(x => x.name))
      // un même joueur s'écrit parfois autrement (« Alex Sarr » chez ESPN, « Alexandre Sarr » chez nous) : on cherche par début du prénom + nom de famille,
      // puis on ne garde que les lignes dont le nom de famille est identique et le prénom compatible (l'un commence par l'autre)
      const clean = (t: string) => normN(t).replace(/[^a-z0-9 ]/g, '')
      const parts = (t: string) => { const w = clean(t).split(' ').filter(Boolean); return { first: w[0] || '', last: w[w.length - 1] || '' } }
      const draftKeys = draftAll.map(d => ({ key: normN(d.name), ...parts(d.name) }))
      const counts: Record<string, number> = {}
      const info: Record<string, { name: string; team: string | null; n: Record<string, number> }> = {}
      for (let i = 0; i < draftKeys.length; i += 15) {
        const chunk = draftKeys.slice(i, i + 15).filter(d => d.last.length > 1)
        const orf = chunk.map(d => `player_name.ilike.*${d.first.slice(0, 3)}*${d.last}*`).join(',')
        for (let from = 0; from < 12000; from += 1000) {
          const { data } = await supabase.from('card_set_entries').select('player_name, team, variation').eq('set_id', sid).or(orf).order('id').range(from, from + 999)
          if (!data?.length) break
          for (const r of data as { player_name: string; team: string | null; variation: string | null }[]) {
            if (r.variation && !plainNames.has(r.variation)) continue
            const pr = parts(r.player_name)
            const d = chunk.find(x => x.last === pr.last && (x.first === pr.first || x.first.startsWith(pr.first) || pr.first.startsWith(x.first)))
            if (!d) continue
            counts[d.key] = (counts[d.key] || 0) + 1
            const inf = info[d.key] || (info[d.key] = { name: r.player_name, team: r.team, n: {} })
            inf.n[r.player_name] = (inf.n[r.player_name] || 0) + 1
            if (!inf.team && r.team) inf.team = r.team
          }
          if (data.length < 1000) break
        }
        if (off) return
      }
      if (!off) setRookieInfo(Object.fromEntries(Object.entries(info).map(([k, v]) => [k, { name: Object.entries(v.n).sort((a, b) => b[1] - a[1])[0][0], team: v.team }])))
      if (!off) setRookieCards(counts)
    })()
    return () => { off = true }
  }, [draftAll, series, sid])

  async function loadSeries(name: string) {
    if (loaded[name]) return
    const isBase = name === 'Base'
    const rows = await pageAll(from => {
      const qy = supabase.from('card_set_entries').select(SEL).eq('set_id', sid)
      return (isBase ? qy.is('variation', null) : qy.eq('variation', name)).order('id').range(from, from + 999)
    }, 8000)
    rows.sort((a, b) => parseInt(a.card_number || '9999') - parseInt(b.card_number || '9999'))
    setLoaded(l => ({ ...l, [name]: rows }))
  }
  // première série ouverte par défaut : on charge ses cartes
  useEffect(() => { if (series.length) void loadSeries(series[0].name) }, [series]) // eslint-disable-line react-hooks/exhaustive-deps
  // cocher / décocher une carte directement sur la page (même table que l'ancienne page de suivi : user_set_completion)
  async function toggleOwn(e: Entry) {
    if (!uid || saving.has(e.id)) return
    const was = owned.has(e.id)
    setSaving(x => new Set(x).add(e.id))
    setOwned(o => { const n = new Set(o); if (was) n.delete(e.id); else n.add(e.id); return n })   // affichage immédiat
    const res = was
      ? await supabase.from('user_set_completion').delete().eq('user_id', uid).eq('entry_id', e.id)
      : await supabase.from('user_set_completion').upsert({ user_id: uid, entry_id: e.id, manually_checked: true }, { onConflict: 'user_id,entry_id' })
    if (res.error) setOwned(o => { const n = new Set(o); if (was) n.add(e.id); else n.delete(e.id); return n })   // échec : on remet comme avant
    setSaving(x => { const n = new Set(x); n.delete(e.id); return n })
  }
  async function copyMissing() {
    const lines: string[] = []
    for (const rows of Object.values(loaded)) for (const e of rows) if (!owned.has(e.id)) lines.push(`#${e.card_number || '?'} ${e.player_name}${e.team ? ` (${e.team})` : ''}${e.variation ? ` · ${nice(e.variation)}` : ''}`)
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* presse-papiers refusé */ }
  }
  // wishlist : même table et mêmes champs que l'ancienne page de suivi
  const wishRow = (e: Entry) => ({
    user_id: uid, nom: e.player_name, annee: set?.year ? String(set.year) : '', marque: set?.brand || '', collection: set?.name || '', variation: e.variation || '',
    num: '', rc: e.is_rc, auto: false, patch: false, notes: [e.card_number ? `#${e.card_number}` : '', e.team || ''].filter(Boolean).join(' · '),
  })
  async function toggleWish(e: Entry) {
    if (!uid || !set) return
    const key = wishKey(e.player_name, set.name, e.variation || '')
    const existing = wish.get(key)
    if (existing) {
      setWish(m => { const n = new Map(m); n.delete(key); return n })
      const { error } = await supabase.from('wishlist').delete().eq('id', existing)
      if (error) setWish(m => new Map(m).set(key, existing))
    } else {
      setWish(m => new Map(m).set(key, 'tmp'))
      const { data, error } = await supabase.from('wishlist').insert(wishRow(e)).select('id').single()
      if (error || !data) setWish(m => { const n = new Map(m); n.delete(key); return n })
      else setWish(m => new Map(m).set(key, data.id as string))
    }
  }
  // toutes les cartes manquantes d'une série d'un coup
  async function wishMissing(name: string) {
    const rows = loaded[name]; if (!uid || !set || !rows) return
    const todo = rows.filter(r => !owned.has(r.id) && !wish.has(wishKey(r.player_name, set.name, r.variation || '')))
    if (!todo.length) return
    for (let i = 0; i < todo.length; i += 300) {
      const part = todo.slice(i, i + 300)
      const { data, error } = await supabase.from('wishlist').insert(part.map(wishRow)).select('id, nom, collection, variation')
      if (error || !data) break
      setWish(m => { const n = new Map(m); for (const w of data) n.set(wishKey(w.nom, w.collection, w.variation || ''), w.id as string); return n })
    }
  }
  // toute une série d'un coup : tout cocher, ou tout décocher si elle est déjà complète
  async function toggleSeriesOwn(name: string) {
    const rows = loaded[name]; if (!uid || !rows?.length) return
    const all = rows.every(r => owned.has(r.id))
    const ids = rows.map(r => r.id)
    setOwned(o => { const n = new Set(o); for (const id of ids) { if (all) n.delete(id); else n.add(id) } return n })
    let failed = false
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500)
      const res = all
        ? await supabase.from('user_set_completion').delete().eq('user_id', uid).in('entry_id', part)
        : await supabase.from('user_set_completion').upsert(part.map(id => ({ user_id: uid, entry_id: id, manually_checked: true })), { onConflict: 'user_id,entry_id' })
      if (res.error) { failed = true; break }
    }
    if (failed) setOwned(o => { const n = new Set(o); for (const id of ids) { if (all) n.add(id); else n.delete(id) } return n })
  }
  const toggle = (name: string) => setOpen(o => { const n = new Set(o); if (n.has(name)) n.delete(name); else { n.add(name); void loadSeries(name) } return n })

  const sport = set?.sport || 'nba'
  const rookieTop = ov?.rookieTop || []
  const top5 = useMemo(() => {
    if (draft.length) return draft.slice(0, 5).map(d => {
      const r = rookieTop.find(x => normN(x.name) === normN(d.name))
      const inf = rookieInfo[normN(d.name)]
      return { pick: d.pick, espn: d.name, name: inf?.name || r?.name || d.name, team: inf?.team || r?.team || null, cards: rookieCards ? (rookieCards[normN(d.name)] || 0) : (r?.cards || 0), autos: rookieCards ? 0 : (r?.autos || 0), img: r?.img || null }
    })
    return rookieTop.slice(0, 5).map((r, i) => ({ pick: i + 1, espn: r.name, name: r.name, team: r.team, cards: r.cards, autos: r.autos, img: r.img }))
  }, [draft, rookieTop, rookieCards, rookieInfo])
  const top5Names = top5.map(t => t.espn).join('|')
  useEffect(() => {
    const api = SPORT_API[sport]
    if (!api || !top5Names) return
    let off = false
    fetch('/api/player-photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: top5Names.split('|'), sport: api }) })
      .then(r => (r.ok ? r.json() : { photos: {} })).then(d => { if (!off && d?.photos) setPhotos(d.photos) }).catch(() => {})
    return () => { off = true }
  }, [top5Names, sport])

  // total réel de cartes par franchise (sans parallèles) : on lit les séries non parallèles du set une fois
  const [teamRows, setTeamRows] = useState<Map<string, Entry[]> | null>(null)
  useEffect(() => {
    if (!series.length) return
    let off = false
    ;(async () => {
      const names = series.filter(x => x.kind !== 'par' && x.name !== 'Base').map(x => x.name)
      const rows: Entry[] = []
      if (series.some(x => x.name === 'Base')) rows.push(...await pageAll(from => supabase.from('card_set_entries').select(SEL).eq('set_id', sid).is('variation', null).not('team', 'is', null).order('id').range(from, from + 999), 8000))
      for (let i = 0; i < names.length; i += 25) rows.push(...await pageAll(from => supabase.from('card_set_entries').select(SEL).eq('set_id', sid).in('variation', names.slice(i, i + 25)).not('team', 'is', null).order('id').range(from, from + 999), 8000))
      if (off) return
      const g = new Map<string, Entry[]>()
      for (const e of rows) { const k = tkey(e.team || ''); (g.get(k) || g.set(k, []).get(k)!).push(e) }
      setTeamRows(new Map([...g.entries()].map(([k, v]) => [k, cleanTeamRows(v)])))
    })()
    return () => { off = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, sid])
  // équipes : comptes du set + ma progression (sur les cartes de base déjà lues)
  const teams = useMemo(() => {
    const mine = new Map<string, number>()
    const rows = ov?.baseRows?.length ? ov.baseRows : loaded['Base'] || []
    for (const e of rows) if (e.team && owned.has(e.id)) mine.set(e.team, (mine.get(e.team) || 0) + 1)
    const real = (name: string) => teamRows?.get(tkey(name))
    const lg = LEAGUE_OF[sport]
    const present = new Set((ov?.teams || []).map(t => tkey(t.team)))
    const missingTeams = lg && (ov?.teams || []).length ? SPORTS_TEAMS.filter(x => x.sport === lg && !present.has(tkey(x.name))).map(x => ({ team: x.name, n: 0 })) : []
    const a = [...(ov?.teams || []), ...missingTeams].filter(t => !lg || SPORTS_TEAMS.some(x => x.sport === lg && tkey(x.name) === tkey(t.team))).map(t => { const r = real(t.team); return { name: t.team, n: r ? r.length : Number(t.n), mine: r ? r.filter(e => owned.has(e.id)).length : (mine.get(t.team) || 0) } })
    return a.sort((x, y) => tsort === 'az' ? x.name.localeCompare(y.name) : tsort === 'mine' ? (y.mine / Math.max(1, y.n)) - (x.mine / Math.max(1, x.n)) : y.n - x.n)
  }, [ov, loaded, owned, tsort, sport, teamRows])

  // photos des cartes affichées : seulement celles qui n'ont pas d'image, par paquets (l'API de la communauté exige d'être connecté)
  const visibleIds = (() => {
    const out: number[] = []
    const q1v = q.trim().toLowerCase()
    for (const sr of series.filter(x => tab === 'all' ? x.kind !== 'par' : x.kind === tab).slice(0, seriesLimit)) {
      const rows = loaded[sr.name]; if (!rows || !open.has(sr.name)) continue
      let list = rows
      if (q1v) list = list.filter(e => `${e.player_name} ${e.team || ''} #${e.card_number || ''}`.toLowerCase().includes(q1v))
      if (own !== 'all') list = list.filter(e => owned.has(e.id) === (own === 'own'))
      for (const e of list.slice(0, limit[sr.name] || 48)) if (!e.image_url) out.push(e.id)
    }
    for (const e of ov?.hunt || []) if (!e.image_url) out.push(e.id)
    return out
  })()
  const visibleKey = visibleIds.join(',')
  const whoKey = (() => {
    if (!uid) return ''
    const out: number[] = []
    for (const sr of series.filter(x => tab === 'all' ? x.kind !== 'par' : x.kind === tab).slice(0, seriesLimit)) {
      const rows = loaded[sr.name]; if (!rows || !open.has(sr.name)) continue
      for (const e of rows.slice(0, limit[sr.name] || 48)) if (!owned.has(e.id) && !whoAsked.current.has(e.id)) out.push(e.id)
    }
    return out.slice(0, 60).join(',')
  })()
  useEffect(() => {
    if (!set || !uid || !whoKey) return
    const ids = whoKey.split(',').map(Number)
    const byId = new Map<number, Entry>(); for (const rows of Object.values(loaded)) for (const e of rows) byId.set(e.id, e)
    const todo = ids.map(id => byId.get(id)).filter((e): e is Entry => !!e)
    todo.forEach(e => whoAsked.current.add(e.id))
    let cancel = false
    ;(async () => {
      const { data: ses } = await supabase.auth.getSession(); const token = ses.session?.access_token
      if (!token || cancel) return
      try {
        const r = await fetch('/api/setlist-who-has', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ setId: set.id, setYear: set.year, setBrand: set.brand, setName: set.name, entries: todo.map(e => ({ id: e.id, player_name: e.player_name, card_number: e.card_number, variation: e.variation })) }) })
        const rows: { entry_id: number; count: number; members: { id: string; name: string }[] }[] = r.ok ? await r.json() : []
        if (!cancel && rows.length) setWhoHas(prev => { const n = new Map(prev); for (const x of rows) n.set(x.entry_id, { count: x.count, members: x.members }); return n })
      } catch { /* pas d'information d'échange */ }
    })()
    return () => { cancel = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whoKey, uid, set])
  useEffect(() => {
    if (!set || !loggedIn) return
    const todo = visibleIds.filter(id => !asked.current.has(id)).slice(0, 400)
    if (!todo.length) return
    todo.forEach(id => asked.current.add(id))
    ;(async () => {
      const { data: ses } = await supabase.auth.getSession(); const token = ses.session?.access_token
      if (!token) return
      try {
        const r = await fetch('/api/setlist-images', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ setId: set.id, setYear: set.year, setBrand: set.brand, setName: set.name, entryIds: todo }) })
        const rows: { entry_id: number; image_url: string }[] = r.ok ? await r.json() : []
        if (rows.length) setCommImg(prev => { const n = new Map(prev); for (const x of rows) n.set(x.entry_id, x.image_url); return n })
      } catch { /* pas de photo communautaire */ }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, loggedIn, set])

  if (missing) return <div className="sl2"><div className="wrap" style={{ padding: '60px 16px' }}>Set introuvable. <Link href="/setlist" style={{ textDecoration: 'underline' }}>Retour aux setlists</Link></div></div>
  if (!set) return <div className="sl2"><div className="wrap" style={{ padding: '60px 16px' }}>Chargement du set…</div></div>

  const kindCount = (k: Series['kind']) => series.filter(s => s.kind === k).reduce((a, s) => a + s.cnt, 0)
  const total = set.total_cards || series.reduce((a, s) => a + s.cnt, 0)         // toutes les versions, parallèles comprises
  const plain = series.filter(s => s.kind !== 'par')                              // cartes « uniques » : base + séries, sans les parallèles
  const cardsN = plain.reduce((a, s) => a + s.cnt, 0)
  const parSeries = series.filter(s => s.kind === 'par')
  const baseParN = series.filter(s => s.baseParallel).length
  const insertSeriesN = plain.filter(s => s.kind === 'ins').length                // séries d'inserts « simples » (hors base, signatures et reliques)
  const otherSeriesN = plain.filter(s => s.kind !== 'base').length
  // signées & reliques : cartes marquées « signée » dans les séries sans parallèles + séries de reliques (par le nom) ; avant lecture, estimation par le nom des séries
  const rookieN = rookieCards ? Object.values(rookieCards).reduce((a, n) => a + n, 0) : (ov?.rookies || 0)
  const rookieLabel = rookieCards ? 'Rookies (cartes)' : 'Rookies'
  const signedN = autoBy ? plain.reduce((a, s) => a + (s.kind === 'mem' ? s.cnt : (autoBy[s.name] || 0)), 0) : kindCount('auto') + kindCount('mem')
  const ownedCount = owned.size
  const pct = total ? Math.round((ownedCount / total) * 1000) / 10 : 0
  const q1 = q.trim().toLowerCase()
  const hunt = ov?.hunt || []
  const signers = ov?.signerTop || []
  const hasTeams = teams.length > 0
  const box = boxFor(set.name, boxFiles)
  const sportLabel = SPORT_LABEL[set.sport] || set.sport
  // clic sur une franchise : liste de toutes ses cartes du set, groupées par série (comme les team sets des guides)
  async function openTeam(name: string) {
    setTeamView({ name, rows: null })
    const alt = /^Los Angeles /i.test(name) ? name.replace(/^Los Angeles /i, 'LA ') : /^LA /i.test(name) ? name.replace(/^LA /i, 'Los Angeles ') : null
    const names = alt ? [name, alt] : [name]
    const rows = await pageAll(from => supabase.from('card_set_entries').select(SEL).eq('set_id', sid).in('team', names).order('id').range(from, from + 999), 8000)
    setTeamView(v => (v && v.name === name ? { name, rows } : v))
  }
  // toutes les cartes de la franchise d'un coup (sans les parallèles)
  async function toggleTeamAll(rows: Entry[]) {
    if (!uid || !rows.length) return
    const all = rows.every(r => owned.has(r.id))
    const ids = rows.map(r => r.id)
    setOwned(o => { const n = new Set(o); for (const id of ids) { if (all) n.delete(id); else n.add(id) } return n })
    let failed = false
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500)
      const res = all
        ? await supabase.from('user_set_completion').delete().eq('user_id', uid).in('entry_id', part)
        : await supabase.from('user_set_completion').upsert(part.map(id => ({ user_id: uid, entry_id: id, manually_checked: true })), { onConflict: 'user_id,entry_id' })
      if (res.error) { failed = true; break }
    }
    if (failed) setOwned(o => { const n = new Set(o); for (const id of ids) { if (all) n.add(id); else n.delete(id) } return n })
  }
  const goCards = (text: string) => { setQ(text); document.getElementById('checklist')?.scrollIntoView({ behavior: 'smooth' }) }
  const tabs = ([['all', 'Cartes', cardsN], ['base', 'Base', kindCount('base')], ['ins', 'Inserts', kindCount('ins')], ['auto', 'Signatures', kindCount('auto')], ['mem', 'Reliques', kindCount('mem')], ['par', 'Parallèles', kindCount('par')]] as const).filter(([k, , n]) => k === 'all' || n > 0)
  const anchors = [ov && top5.length ? ['top5', 'Top rookies'] : null, hunt.length ? ['apercu', 'À chasser'] : null, signers.length ? ['signes', 'Signatures'] : null, ['checklist', 'Checklist'], hasTeams ? ['equipes', 'Team Sets'] : null, parSeries.length > 0 ? ['rainbow', 'Rainbow'] : null].filter(Boolean) as string[][]

  const card = (e: Entry) => {
    const lg = logoOf(e.team, sport)
    return (
      <div key={e.id} className={`card${owned.has(e.id) ? ' own' : ''}`}>
        <div className="art" style={{ background: `linear-gradient(160deg, ${colorOf(e.team, sport)}, #050b22)` }}>
          {(mineImg.get(e.id) || (!hiddenPhotos.has(e.id) && (e.image_url || commImg.get(e.id)))) ? <img className="cimg" src={(mineImg.get(e.id) || e.image_url || commImg.get(e.id)) as string} alt="" loading="lazy" /> : <b>{ini(e.player_name)}</b>}
          {e.card_number && <span className="num">#{e.card_number}</span>}
          {lg && <span className="lg"><img src={lg} alt="" /></span>}
          {e.is_rc && <span className="rc">RC</span>}
          {uid && !owned.has(e.id) && <button type="button" className="wish g" title={wish.has(wishKey(e.player_name, set?.name || '', e.variation || '')) ? 'Retirer de ma wishlist' : 'Ajouter à ma wishlist'} aria-label="Wishlist" onClick={ev => { ev.stopPropagation(); void toggleWish(e) }}>{wish.has(wishKey(e.player_name, set?.name || '', e.variation || '')) ? '★' : '☆'}</button>}
          {uid && <button type="button" className="tick g" title={owned.has(e.id) ? 'Je ne l’ai plus' : 'Je l’ai'} aria-label={owned.has(e.id) ? 'Décocher cette carte' : 'Cocher cette carte'} onClick={ev => { ev.stopPropagation(); void toggleOwn(e) }}>{owned.has(e.id) ? '✓' : ''}</button>}
        </div>
        <div className="info"><b>{e.player_name}</b><small>{e.team || '—'}</small>
          {uid && (
            <div className="acts">
              {!owned.has(e.id) && whoHas.get(e.id) && (
                <span style={{ position: 'relative' }}>
                  <button type="button" className="who" title="Des membres ont cette carte à échanger" onClick={ev => { ev.stopPropagation(); setWhoOpen(whoOpen === e.id ? null : e.id) }}>👥 {whoHas.get(e.id)!.count}</button>
                  {whoOpen === e.id && (
                    <div className="whopop" onClick={ev => ev.stopPropagation()}>
                      <small>À échanger chez</small>
                      {whoHas.get(e.id)!.members.map(m => <Link key={m.id} href={`/galerie/${m.id}?q=${encodeURIComponent(e.player_name)}`} prefetch={false}>{m.name}</Link>)}
                    </div>
                  )}
                </span>
              )}
              {!owned.has(e.id) && suggest.get(e.id) && (
                <button type="button" className="sug" title={`Ta carte « ${suggest.get(e.id)!.nom}${suggest.get(e.id)!.variation ? ' · ' + suggest.get(e.id)!.variation : ''} » correspond sans doute à cette ligne. Clique pour confirmer.`} onClick={ev => { ev.stopPropagation(); const s = suggest.get(e.id)!; setSuggest(m => { const n = new Map(m); n.delete(e.id); return n }); if (s.image) setMineImg(m => new Map(m).set(e.id, s.image!)); void toggleOwn(e) }}>À confirmer</button>
              )}
              <button type="button" className="flag" title="Signaler une erreur sur cette carte" aria-label="Signaler une erreur" onClick={ev => { ev.stopPropagation(); setReportEntry({ entry: e, variation: e.variation ? nice(e.variation) : 'Base' }) }}>⚑</button>
            </div>
          )}
        </div>
        {uid && !owned.has(e.id) && <button type="button" className="wish l" aria-label="Wishlist" onClick={ev => { ev.stopPropagation(); void toggleWish(e) }}>{wish.has(wishKey(e.player_name, set?.name || '', e.variation || '')) ? '★' : '☆'}</button>}
        {uid && <button type="button" className="tick l" aria-label={owned.has(e.id) ? 'Décocher cette carte' : 'Cocher cette carte'} onClick={ev => { ev.stopPropagation(); void toggleOwn(e) }}>{owned.has(e.id) ? '✓' : ''}</button>}
      </div>
    )
  }

  return (
    <div className="sl2">
      <div className="wrap">
        <div className="hero">
          {box
            ? <div className="cover photo"><img className="cimg" src={box} alt={`Boîte ${set.name}`} /></div>
            : <div className="cover"><b>{(set.brand || set.name).toUpperCase()}<br />{set.year}</b><i>{set.brand || sportLabel} · {set.year}</i></div>}
          <div>
            <div className="eyebrow">{sportLabel}{set.brand ? ` · ${set.brand}` : ''}</div>
            <h1>{set.name}</h1>
            <div className="meta"><span className="chip on">{fmt(cardsN)} cartes</span>{parSeries.length > 0 && <span className="chip">{fmt(total)} avec les parallèles</span>}<span className="chip">{fmt(otherSeriesN)} série{otherSeriesN > 1 ? 's' : ''}</span></div>
            {(seasons.prev || seasons.next) && <div className="meta">{seasons.prev && <Link className="chip" href={`/setlist/${seasons.prev.id}`} prefetch={false}>← {seasons.prev.name}</Link>}{seasons.next && <Link className="chip" href={`/setlist/${seasons.next.id}`} prefetch={false}>{seasons.next.name} →</Link>}</div>}
            <div className="btns"><a className="btn fill" href="#checklist">Voir les cartes</a><Link className="btn" href={`/setlist/${set.id}/print`}>Imprimer</Link></div>
          </div>
          <div className="prog">
            <div className="ring" style={{ ['--p' as string]: pct }}><b>{loggedIn ? `${Math.round(pct)}%` : '—'}</b></div>
            <div><small>Ta progression sur ce set</small>
              <div className="l2"><span className="disp" style={{ fontSize: 24 }}>{fmt(ownedCount)}</span> / {fmt(total)} versions</div>
              <small>{loggedIn ? (ownedCount ? `Parallèles comprises · il t’en manque ${fmt(Math.max(0, total - ownedCount))}` : 'Aucune carte de ce set pour l’instant') : 'Connecte-toi pour suivre ta progression'}</small></div>
          </div>
        </div>

        <div className="stats">
          <div className="stat"><b>{fmt(cardsN)}</b><span>Cartes</span>{parSeries.length > 0 && <em style={{ color: 'var(--mut)' }}>{fmt(total)} avec parallèles</em>}</div>
          {ov && ov.base > 0 && <div className="stat"><b>{fmt(ov.base)}</b><span>Cartes de base</span></div>}
          {rookieN > 0 && <div className="stat"><b>{fmt(rookieN)}</b><span>{rookieLabel}</span></div>}
          {signedN > 0 && <div className="stat"><b>{fmt(signedN)}</b><span>Signées &amp; reliques</span></div>}
          {insertSeriesN > 0 && <div className="stat"><b>{fmt(insertSeriesN)}</b><span>Séries d’inserts</span></div>}
          {baseParN > 0 && <div className="stat"><b>{fmt(baseParN)}</b><span>Parallèles de base</span></div>}
          
        </div>
      </div>

      <nav className="anchors"><div className="wrap">{anchors.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</div></nav>

      <div className="wrap">
        {ov && top5.length > 0 && (
          <section id="top5">
            <div className="sh"><h2>Top 5 rookies</h2><p>{fmt(rookieN)} cartes de rookies · {draft.length ? `les 5 premiers choix de la draft ${set.year}` : 'les recrues les plus présentes'}</p></div>
            <div className="rooks">{top5.map(r => { const lg = logoOf(r.team, sport); const ph = photos[r.espn] || r.img; return (
              <div className="rook" key={r.espn} onClick={() => goCards(r.name)}>
                <div className="art" style={{ background: `linear-gradient(160deg, ${colorOf(r.team, sport)}, #050b22)` }}>
                  {ph ? <img className="cimg face" src={ph} alt={r.name} loading="lazy" /> : <b>{ini(r.name)}</b>}
                  <span className="num">#{r.pick}</span>{lg && <span className="lg"><img src={lg} alt="" /></span>}{r.cards > 0 && <span className="rc">RC</span>}
                </div>
                <div className="info"><b>{r.name}</b><small>{r.team || '—'}</small><em>{r.cards ? `${r.cards} carte${r.cards > 1 ? 's' : ''}${r.autos ? ` · ✍ ${r.autos} signées` : ''}` : 'Aucune carte dans ce set'}</em></div>
              </div>) })}</div>
          </section>
        )}

        {hunt.length > 0 && (
          <section id="apercu">
            <div className="sh"><h2>Les pièces à chasser</h2><p>Les rookies signés du set</p></div>
            <div className="cards" style={{ padding: 0, border: 0 }}>{hunt.map(card)}</div>
          </section>
        )}

        {signers.length > 0 && (
          <section id="signes">
            <div className="sh"><h2>Les signatures</h2><p>{fmt(ov?.signers || signers.length)} joueurs avec une carte signée</p></div>
            <div className="tools"><input className="inp" value={sq} onChange={e => setSq(e.target.value)} placeholder="Cherche un joueur : a-t-il signé dans ce set ?" /></div>
            <div className="signers">{signers.filter(s => s.name.toLowerCase().includes(sq.toLowerCase())).slice(0, 60).map(s => (
              <div className="sg" key={s.name} onClick={() => goCards(s.name)} style={{ cursor: 'pointer' }}><span className="av" style={{ background: colorOf(s.team, sport) }}>{ini(s.name)}</span><div><b>{s.name}</b><small>{s.team || '—'}</small></div><div className="n">✍ {s.n}</div></div>
            ))}</div>
          </section>
        )}

        <section id="checklist">
          <div className="sh"><h2>Les cartes du set</h2><p>{fmt(cardsN)} cartes · {fmt(plain.length)} série{plain.length > 1 ? 's' : ''}{parSeries.length > 0 ? ` · ${fmt(parSeries.length)} parallèles` : ''}</p></div>
          {tabs.length > 2 && (
            <div className="tabs">
              {tabs.map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<small>{fmt(n)}</small></button>)}
            </div>
          )}
          <div className="tools">
            <input className="inp" value={q} onChange={e => setQ(e.target.value)} placeholder="Joueur, équipe, numéro…" />
            {loggedIn && <button type="button" className="seg" style={{ background: copied ? 'var(--green)' : 'transparent', color: '#fff', padding: '8px 12px', font: '700 12px sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer' }} onClick={() => void copyMissing()}>{copied ? 'Copié ✓' : 'Copier les manquantes'}</button>}
            {loggedIn && <div className="seg">{([['all', 'Toutes'], ['own', 'Possédées'], ['miss', 'Manquantes']] as const).map(([k, l]) => <button key={k} className={own === k ? 'on' : ''} onClick={() => setOwn(k)}>{l}</button>)}</div>}
            <div className="seg" style={{ marginLeft: 'auto' }}>{([['grid', '▦ Grille'], ['list', '☰ Liste']] as const).map(([k, l]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}</div>
          </div>
          {series.filter(s => tab === 'all' ? s.kind !== 'par' : s.kind === tab).slice(0, seriesLimit).map(s => {
            const rows = loaded[s.name]
            const isOpen = open.has(s.name)
            let list = rows || []
            if (q1) list = list.filter(e => `${e.player_name} ${e.team || ''} #${e.card_number || ''}`.toLowerCase().includes(q1))
            if (own !== 'all') list = list.filter(e => owned.has(e.id) === (own === 'own'))
            const shownN = limit[s.name] || 48
            const mineN = rows ? rows.filter(e => owned.has(e.id)).length : null
            return (
              <div className="sub" key={s.name}>
                <header onClick={() => toggle(s.name)}>
                  <h3>{nice(s.name)}</h3>
                  {mineN != null && loggedIn && <span className="mini"><i style={{ width: `${Math.round((mineN / Math.max(1, s.cnt)) * 100)}%` }} /></span>}
                  {uid && rows && rows.some(r => !owned.has(r.id) && !wish.has(wishKey(r.player_name, set.name, r.variation || ''))) && <button type="button" className="rb" onClick={ev => { ev.stopPropagation(); void wishMissing(s.name) }}>★ Manquantes en wishlist</button>}
                  {uid && rows && rows.length > 0 && <button type="button" className="rb" onClick={ev => { ev.stopPropagation(); void toggleSeriesOwn(s.name) }}>{rows.every(r => owned.has(r.id)) ? 'Tout décocher' : 'Tout cocher'}</button>}
                  <span className="cnt">{mineN != null && loggedIn ? `${mineN} / ` : ''}{fmt(s.cnt)}</span>
                  <span>{isOpen ? '▲' : '▼'}</span>
                </header>
                {isOpen && (!rows ? <p style={{ padding: 14, margin: 0, color: 'var(--mut)' }}>Chargement…</p> : (
                  <>
                    <div className={`cards${view === 'list' ? ' list' : ''}`}>{list.slice(0, shownN).map(card)}</div>
                    {list.length > shownN && <button className="more" onClick={() => setLimit(l => ({ ...l, [s.name]: shownN + 96 }))}>Voir {Math.min(96, list.length - shownN)} cartes de plus ({fmt(list.length - shownN)} restantes)</button>}
                    {!list.length && <p style={{ padding: 14, margin: 0, color: 'var(--mut)' }}>Aucune carte ne correspond.</p>}
                  </>
                ))}
              </div>
            )
          })}
          {(() => { const n = series.filter(s => tab === 'all' ? s.kind !== 'par' : s.kind === tab).length; return n > seriesLimit ? <button className="more" style={{ border: '2px solid var(--line)' }} onClick={() => setSeriesLimit(l => l + 60)}>Voir {Math.min(60, n - seriesLimit)} séries de plus ({fmt(n - seriesLimit)} restantes)</button> : null })()}
        </section>

        {hasTeams && (
          <section id="equipes">
            <div className="sh"><h2>Team Sets</h2>
              <select className="inp" value={tsort} onChange={e => setTsort(e.target.value as 'n' | 'mine' | 'az')}><option value="az">Tri : A → Z</option><option value="n">Tri : nombre de cartes</option>{loggedIn && <option value="mine">Tri : ma progression</option>}</select></div>
            <div className="teams">{teams.map(t => { const lg = logoOf(t.name, sport); return (
              <div className="tm" key={t.name} onClick={() => void openTeam(t.name)}>
                {lg && <img src={lg} alt="" />}<b>{t.name}</b>
                {loggedIn && <div className="bar"><i style={{ width: `${Math.round((t.mine / Math.max(1, t.n)) * 100)}%` }} /></div>}<small>{t.n === 0 ? 'pas de carte de base' : `${loggedIn ? `${t.mine} / ` : ''}${t.n} cartes`}</small>
              </div>) })}</div>
          </section>
        )}

        {parSeries.length > 0 && (
          <section id="rainbow">
            <div className="sh"><h2>Le rainbow</h2><p>{fmt(parSeries.length)} parallèles et couleurs · {fmt(kindCount('par'))} versions</p></div>
            <div className="pars">{parSeries.slice(0, rainbowLimit).map(s => <span key={s.name} className="pchip" onClick={() => { setTab('par'); setOpen(o => new Set(o).add(s.name)); void loadSeries(s.name); document.getElementById('checklist')?.scrollIntoView({ behavior: 'smooth' }) }}>{nice(s.name)} <em>{fmt(s.cnt)}</em></span>)}{parSeries.length > rainbowLimit && <button type="button" className="pchip" style={{ background: 'transparent', color: 'inherit' }} onClick={() => setRainbowLimit(l => l + 120)}>+ {fmt(parSeries.length - rainbowLimit)} autres</button>}</div>
          </section>
        )}
      </div>
      {teamView && (() => {
        const nonPar = new Set(series.filter(x => x.kind !== 'par').map(x => x.name))
        const all = teamView.rows ? teamView.rows.filter(e => nonPar.has(e.variation || 'Base')) : null
        const rows = all ? cleanTeamRows(all) : null
        const groups = new Map<string, Entry[]>()
        for (const e of rows || []) { const k = e.variation || 'Base'; (groups.get(k) || groups.set(k, []).get(k)!).push(e) }
        const list = [...groups.entries()].sort((a, b) => (a[0] === 'Base' ? -1 : b[0] === 'Base' ? 1 : a[0].localeCompare(b[0])))
        const lg = logoOf(teamView.name, sport)
        const mineN = rows ? rows.filter(r => owned.has(r.id)).length : 0
        return (
          <div className="tv-back" onClick={() => setTeamView(null)}>
            <div className="tv" onClick={ev => ev.stopPropagation()}>
              <header>{lg && <img src={lg} alt="" />}<div><b>{teamView.name}</b><small>{rows ? `${loggedIn ? `${mineN} / ` : ''}${fmt(rows.length)} cartes dans ce set` : 'Chargement…'}</small></div>{uid && rows && rows.length > 0 && <button type="button" className="tv-all" onClick={() => void toggleTeamAll(rows)}>{rows.every(r => owned.has(r.id)) ? 'Tout décocher' : 'Tout cocher'}</button>}<button type="button" aria-label="Fermer" onClick={() => setTeamView(null)}>✕</button></header>
              <div className="tv-body">
                {!rows && <p className="tv-empty">Chargement des cartes…</p>}
                {rows && !rows.length && <p className="tv-empty">Aucune carte de cette équipe dans ce set.</p>}
                {list.map(([v, es]) => (
                  <div key={v}>
                    <h4>{nice(v)} <span>({es.length})</span></h4>
                    {es.sort((a, b) => parseInt(a.card_number || '9999') - parseInt(b.card_number || '9999')).map(e => (
                      <div className={'tv-row' + (owned.has(e.id) ? ' own' : '')} key={e.id}>
                        <i>{e.card_number || '—'}</i><span>{e.player_name}</span>{e.is_rc && <em>RC</em>}
                        {uid && <button type="button" className="tvc" aria-label={owned.has(e.id) ? 'Décocher' : 'Cocher'} onClick={() => void toggleOwn(e)}>{owned.has(e.id) ? '✓' : ''}</button>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
      {reportEntry && <SetlistReportDialog setId={setId} setName={set.name} variation={reportEntry.variation} entry={reportEntry.entry} imageUrl={mineImg.has(reportEntry.entry.id) ? undefined : (reportEntry.entry.image_url || commImg.get(reportEntry.entry.id) || undefined)} onPhotoReported={id => setHiddenPhotos(h => new Set(h).add(id))} onClose={() => setReportEntry(null)} />}
      <p style={{ textAlign: 'center', color: 'var(--mut)', fontSize: 12, padding: '30px 16px 40px' }}>Memorabilius est un site indépendant, non affilié aux éditeurs de cartes ni aux ligues.</p>
    </div>
  )
}
