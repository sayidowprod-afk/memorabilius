// Données « en direct » des bobbleheads pour les pages joueurs (serveur uniquement : lit public/bobbleheads/live.json, régénéré toutes les 10 s par scripts/bobble-live.mjs).
// Priorité : les 7 figurines complètes d'origine (corps propre au joueur), puis les têtes validées (OK) posées sur le corps de leur équipe avec leur numéro.
import liveJson from '../../public/bobbleheads/live.json'
import { BOBBLEHEADS, normName } from '@/lib/bobbleheads'

export type BobbleFig = {
  id: string
  head: { w: number; h: number; ear: number; skin?: number[] }
  headSrc: string
  body: { w: number; h: number; span: number; src: string; team?: string; num?: string; numFill?: string; numStroke?: string }
}

type Live = { players: Record<string, { name: string; team: string; num: string; head: { w: number; h: number; ear: number; skin?: number[] }; v: number }>; teams: Record<string, { w: number; h: number; span: number; num: { fill: string; stroke: string } }> }

// Données importées dans le build (public/bobbleheads/live.json, régénéré par scripts/bobble-live.mjs d'après les têtes validées) : fonctionne en production ; en local, le fichier est rechargé à chaud.
const live = liveJson as unknown as Live
const byName = new Map<string, string>()
for (const [id, p] of Object.entries(live.players)) byName.set(normName(p.name), id)
function loadLive() { return { live, byName } }

export function teamBody(abbr: string, num?: string | null): BobbleFig['body'] | null {
  const c = loadLive(); const t = c?.live.teams[abbr]; if (!t) return null
  return { w: t.w, h: t.h, span: t.span, src: `/bobbleheads/team-${abbr}.webp`, team: abbr, num: num || undefined, numFill: t.num.fill, numStroke: t.num.stroke }
}

export function bobbleFor(playerName: string): BobbleFig | null {
  const n = normName(playerName)
  // 1) figurines complètes d'origine
  for (const [id, m] of Object.entries(BOBBLEHEADS)) {
    if (m.names.some(x => normName(x) === n)) return { id, head: m.head, headSrc: `/bobbleheads/${id}-head.webp`, body: { ...m.body, src: `/bobbleheads/${id}-body.webp` } }
  }
  // 2) tête validée + corps d'équipe + numéro
  const c = loadLive(); if (!c) return null
  const id = c.byName.get(n); if (!id) return null
  const p = c.live.players[id], t = c.live.teams[p.team]; if (!t) return null
  return { id, head: p.head, headSrc: `/bobbleheads/${id}-head.webp?v=${p.v}`, body: { w: t.w, h: t.h, span: t.span, src: `/bobbleheads/team-${p.team}.webp`, team: p.team, num: p.num, numFill: t.num.fill, numStroke: t.num.stroke } }
}
