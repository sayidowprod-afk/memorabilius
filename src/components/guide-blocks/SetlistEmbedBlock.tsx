'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { sportEmoji } from '@/lib/sportEmoji'
import { canonicalVariation } from '@/lib/variationMatch'

interface Entry {
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
}

interface Props {
  title?: string
  setId: number
  setName: string
  totalCards: number
  sport: string | null
  entries: Entry[]
  // Vocabulaire de mots couleur/motif (issu du bloc pyramide du guide) servant à
  // reconnaître et retirer le suffixe couleur d'une variation — voir canonicalVariation.
  colorVocab?: Set<string>
}

type TabKey = 'base' | 'variations' | 'autographs' | 'memorabilia' | 'inserts' | 'full' | 'teams'

// Checklist "façon Beckett" (voir capture de référence fournie) : onglets Base /
// Variations / Autographs / Memorabilia / Inserts / Full Checklist / Team Sets,
// au lieu d'une simple liste groupée par variation. La base de données ne distingue
// pas explicitement auto/memorabilia/insert (pas de colonne dédiée, seulement un
// champ texte `variation` libre issu du scraping TCDB) — la catégorie de chaque
// carte est donc devinée par mots-clés dans `variation`/`card_number`, comme pour les
// couleurs de la pyramide (voir fallbackColorFor dans PyramidBlock.tsx).
function classify(e: Entry): Exclude<TabKey, 'full' | 'teams'> {
  const v = (e.variation || '').toLowerCase()
  if (/auto/.test(v)) return 'autographs'
  if (/relic|patch|jersey|swatch|memorabilia/.test(v)) return 'memorabilia'
  if (/^[a-z]{1,6}-/i.test(e.card_number || '')) return 'inserts'
  if (v && v !== 'base') return 'variations'
  return 'base'
}

const TAB_LABELS: Record<TabKey, string> = {
  base: 'Base', inserts: 'Inserts', variations: 'Variations', autographs: 'Autographs',
  memorabilia: 'Memorabilia', full: 'Full Checklist', teams: 'Team Sets',
}

// Ordre d'affichage des onglets : catégories "physiques" d'abord (Base, Inserts,
// Variations, Autographs, Memorabilia), puis les vues agrégées (Full Checklist,
// Team Sets) à la fin.
const TAB_ORDER: TabKey[] = ['base', 'inserts', 'variations', 'autographs', 'memorabilia', 'full', 'teams']

// Tri "façon TCDB" par numéro de carte, croissant. `localeCompare` en mode `numeric`
// gère aussi bien les numéros purs ("1", "23") que les préfixes alphanumériques
// ("FAN-1", "80TBA-AB") en comparant les segments numériques par valeur plutôt que
// lexicographiquement (sinon "10" passerait avant "2").
function cardNumCompare(a: Entry, b: Entry): number {
  return (a.card_number || '').localeCompare(b.card_number || '', undefined, { numeric: true, sensitivity: 'base' })
}

function slugifyTeam(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Tri "façon Beckett Team Set Checklists" (voir capture de référence) : au sein
// d'une équipe, les cartes sont groupées par set/insert (Base d'abord, puis
// alphabétique — "1980-81 Topps Basketball Autographs", "Activators", "Captains"…),
// et chaque groupe est trié par numéro de carte croissant. Un simple tri par
// numéro de carte mélangerait les inserts entre eux (chaque set a sa propre
// numérotation, ex. "AC-16" vs "CB-9").
function teamEntryCompare(a: Entry, b: Entry): number {
  const va = a.variation || 'Base'
  const vb = b.variation || 'Base'
  const aBase = /^base/i.test(va) ? 0 : 1
  const bBase = /^base/i.test(vb) ? 0 : 1
  if (aBase !== bBase) return aBase - bBase
  if (va !== vb) return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
  return cardNumCompare(a, b)
}

export default function SetlistEmbedBlock({ title, setId, setName, totalCards, sport, entries: preview, colorVocab }: Props) {
  const emoji = sportEmoji(sport)
  const [tab, setTab] = useState<TabKey>('full')
  // Le HTML du guide ne contient qu'un apercu (cartes de base) pour rester leger et indexable ; la checklist complete arrive ici, apres coup.
  const [full, setFull] = useState<Entry[] | null>(null)
  useEffect(() => {
    let off = false
    fetch(`/api/setlist-entries?setId=${setId}`).then(r => r.json()).then((j: { e?: (string | number | null)[][] }) => {
      if (off || !j.e?.length) return
      setFull(j.e.map(r => ({ card_number: r[0] as string | null, player_name: r[1] as string, team: r[2] as string | null, variation: r[3] as string | null, is_rc: r[4] === 1 })))
    }).catch(() => { /* on garde l'apercu */ })
    return () => { off = true }
  }, [setId])
  const entries = full ?? preview

  // TCDB n'itemise pas les parallèles couleur (Refractor, Wave Gold...) dans ses
  // checklists — c'est la même carte physique que la version de base, juste
  // recolorée. On remplace donc la variation de chaque carte par sa forme
  // canonique (suffixe couleur retiré, ex: "Fortune 15 Aqua Refractor" ->
  // "Fortune 15") puis on ne garde qu'une seule entrée par (numéro de carte,
  // joueur, variation canonique) — les doublons de couleur disparaissent. Fait ici
  // (avant classify/tri) pour que TOUS les onglets (Base, Team Sets, Full
  // Checklist...) en bénéficient d'un coup. Les parallèles couleur non reconnus par ce
  // vocabulaire (ex: "Optic Red Cracked Ice", "Seismic"...) sont regroupés plus bas
  // par la logique de familles (prefixe de nom), qui les range sous leur insert de
  // base ("Optic") -- on ne les exclut JAMAIS en bloc par categorie : une premiere
  // version de ce filtre excluait toute la categorie "variations", ce qui supprimait
  // aussi de VRAIS inserts a part entiere sans mot-cle auto/memorabilia reconnu (ex.
  // "Archetype", "Crusade", "Color Burst" sur Panini Phoenix 2023-24 -- une quarantaine
  // d'inserts disparaissaient alors que seule la redondance des couleurs devait l'etre).
  const entriesToShow = useMemo(() => {
    const seen = new Set<string>()
    const out: Entry[] = []
    for (const e of entries) {
      const variation = colorVocab && colorVocab.size ? canonicalVariation(e.variation, colorVocab) : e.variation
      const merged = variation === e.variation ? e : { ...e, variation }
      const key = `${e.card_number || ''} ${e.player_name} ${variation || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(merged)
    }
    // Filet au cas ou le vocabulaire couleur ne reconnait pas le suffixe (ex: "Prizms" au pluriel, une nuance
    // jamais listee dans la pyramide du guide...) : regroupe par NOM plutot que par effectif exact -- un effectif
    // identique au pixel pres n'est pas fiable (une ligne en double dans une seule des couleurs suffit a casser
    // une comparaison stricte, vu en prod sur "Sparks" (3 lignes) vs "Sparks Blue/Copper Prizms" (2 chacune)).
    // Deux noms de groupe (meme categorie) sont consideres comme le meme insert recolore si l'un est un prefixe
    // MOT A MOT complet de l'autre ("Sparks" prefixe de "Sparks Blue Prizms") -- jamais juste un mot de debut
    // en commun (eviterait de fusionner a tort "Rookie Autographs" et "Rookie Jersey Autographs", deux inserts
    // differents). Regroupement transitif (union-find) pour capter aussi une famille sans version de base nue
    // ("Draft Selections Memorabilia Copper/Gold/.../Tie-Dye Prizms", aucune juste "Draft Selections Memorabilia").
    const byGroup = new Map<string, Entry[]>()
    for (const e of out) {
      const k = `${classify(e)}\u0001${e.variation || ''}`
      if (!byGroup.has(k)) byGroup.set(k, [])
      byGroup.get(k)!.push(e)
    }
    const groupKeys = [...byGroup.keys()]
    const wordsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean)
    const isWordPrefix = (shortWords: string[], longWords: string[]) =>
      shortWords.length > 0 && shortWords.length <= longWords.length &&
      shortWords.every((w, i) => w.toLowerCase() === longWords[i].toLowerCase())
    const parent = new Map<string, string>(groupKeys.map(k => [k, k]))
    const find = (k: string): string => { while (parent.get(k) !== k) k = parent.get(k)!; return k }
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb) }
    const wordsByKey = new Map(groupKeys.map(k => [k, wordsOf(k.split('\u0001')[1] || '')]))
    for (let i = 0; i < groupKeys.length; i++) {
      const catA = groupKeys[i].split('\u0001')[0]
      const wA = wordsByKey.get(groupKeys[i])!
      for (let j = i + 1; j < groupKeys.length; j++) {
        const catB = groupKeys[j].split('\u0001')[0]
        if (catA !== catB) continue // jamais entre deux categories differentes
        const wB = wordsByKey.get(groupKeys[j])!
        if (wA.length === 0 || wB.length === 0) continue // pas de nom (base) : rien a fusionner
        if (isWordPrefix(wA, wB) || isWordPrefix(wB, wA)) { union(groupKeys[i], groupKeys[j]); continue }
        // Famille sans version courte (aucun "Select Stars Jersey Autographs" nu, seulement ses 3 couleurs,
        // meme nombre de mots des deux cotes donc aucune n'est prefixe complet de l'autre) : connecte quand
        // meme si elles partagent un long debut commun (>= 3 mots) -- seuil volontairement eleve pour ne
        // jamais fusionner deux inserts juste proches par le nom (cf. Rookie Autographs / Rookie Jersey
        // Autographs plus haut, qui ne partagent qu'1 mot et ne doivent jamais se regrouper).
        let common = 0
        while (common < wA.length && common < wB.length && wA[common].toLowerCase() === wB[common].toLowerCase()) common++
        if (common >= 3) union(groupKeys[i], groupKeys[j])
      }
    }
    const clusters = new Map<string, string[]>() // racine -> cles de groupe
    for (const k of groupKeys) { const r = find(k); if (!clusters.has(r)) clusters.set(r, []); clusters.get(r)!.push(k) }
    // Plus long prefixe commun en MOTS entre tous les noms d'une meme famille --
    // "Draft Selections Memorabilia Copper Prizms" / "... Gold Prizms" / ... -> "Draft Selections Memorabilia".
    const canonicalName = (names: string[]): string => {
      if (names.length === 1) return names[0]
      const wordLists = names.map(n => n.trim().split(/\s+/))
      const minLen = Math.min(...wordLists.map(w => w.length))
      let i = 0
      while (i < minLen && wordLists.every(w => w[i].toLowerCase() === wordLists[0][i].toLowerCase())) i++
      const prefix = wordLists[0].slice(0, i).join(' ')
      return prefix || names[0] // aucun mot commun (rare) : pas assez sur pour fusionner le nom, on garde le 1er tel quel
    }
    const result: Entry[] = []
    for (const keys of clusters.values()) {
      const names = keys.map(k => byGroup.get(k)![0].variation || '')
      const canon = canonicalName(names)
      const cardSeen = new Set<string>()
      for (const k of keys) for (const e of byGroup.get(k)!) {
        // union des effectifs (pas juste le 1er groupe) : une ligne presente dans une seule couleur n'est jamais perdue
        const ck = `${e.card_number || ''}|${e.player_name}`
        if (cardSeen.has(ck)) continue
        cardSeen.add(ck)
        result.push(canon === e.variation ? e : { ...e, variation: canon || null })
      }
    }
    return result
  }, [entries, colorVocab])

  const { tabEntries, availableTabs, teamGroups, fullList } = useMemo(() => {
    const byTab: Record<Exclude<TabKey, 'full' | 'teams'>, Entry[]> = {
      base: [], variations: [], autographs: [], memorabilia: [], inserts: [],
    }
    for (const e of entriesToShow) byTab[classify(e)].push(e)
    ;(['base', 'variations', 'autographs', 'memorabilia', 'inserts'] as const).forEach(k => {
      byTab[k].sort(cardNumCompare)
    })

    const available: TabKey[] = TAB_ORDER.filter(k => {
      if (k === 'full') return true
      if (k === 'teams') return false // décidé plus bas une fois les équipes groupées
      return byTab[k].length > 0
    })

    // e.team peut contenir plusieurs equipes brutes concatenees par le scraping
    // ("Denver Nuggets/Toronto Raptors/Miami Heat" pour une carte liee a un
    // trade, parfois avec des doublons litteraux "Detroit Pistons/Detroit
    // Pistons/...") -- on eclate sur "/", on deduplique, et la carte rejoint
    // CHAQUE equipe distincte comme une entree a part entiere plutot qu'une
    // seule "equipe" artificielle qui concatene les noms.
    const teams = new Map<string, Entry[]>()
    for (const e of entriesToShow) {
      const rawTeams = e.team ? [...new Set(e.team.split('/').map(t => t.trim()).filter(Boolean))] : []
      const keys = rawTeams.length > 0 ? rawTeams : ['Autres']
      for (const key of keys) {
        if (!teams.has(key)) teams.set(key, [])
        teams.get(key)!.push(e)
      }
    }
    for (const items of teams.values()) items.sort(teamEntryCompare)
    if (teams.size > 1) available.push('teams')

    // "Full Checklist" doit grouper par TYPE de carte (Base, Inserts, Variations...)
    // à travers toutes les équipes -- pas rester dans l'ordre brut de la table
    // (qui regroupe par équipe, l'ordre d'insertion du scraping), ce qui donnait
    // "9 cartes Base des Atlanta Hawks, puis leurs inserts, puis leurs autographs"
    // avant de passer enfin à l'équipe suivante, au lieu d'une vraie checklist
    // complète triée par type. Réutilise les listes déjà classées/triées ci-dessus.
    const fullList = [...byTab.base, ...byTab.inserts, ...byTab.variations, ...byTab.autographs, ...byTab.memorabilia]

    return { tabEntries: byTab, availableTabs: available, teamGroups: teams, fullList }
  }, [entriesToShow])

  if (!entriesToShow.length) return null

  const groupByVariation = (list: Entry[]) => {
    const groups: { name: string; items: Entry[] }[] = []
    for (const e of list) {
      const name = e.variation || 'Base'
      const last = groups[groups.length - 1]
      if (last && last.name === name) last.items.push(e)
      else groups.push({ name, items: [e] })
    }
    return groups
  }

  const renderList = (list: Entry[], opts?: { hideTeam?: boolean }) => (
    <div style={{ border: '1px solid var(--border, #eee)', borderRadius: 10, overflow: 'hidden' }}>
      {groupByVariation(list).map((g, gi) => (
        <div key={gi}>
          <div className="sle-accent" style={{ padding: '8px 14px', background: 'var(--bg3, #f7f8fa)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {g.name} <span style={{ color: 'var(--text3, #999)', fontWeight: 700 }}>({g.items.length})</span>
          </div>
          {g.items.map((e, ei) => (
            <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', fontSize: 13, borderTop: '1px solid var(--border, #f0f0f0)' }}>
              {e.card_number && <strong style={{ minWidth: 40, color: 'var(--text3, #999)' }}>{e.card_number}</strong>}
              <span style={{ flex: 1 }}>
                {e.player_name}
                {e.is_rc && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px' }}>RC</span>}
              </span>
              {!opts?.hideTeam && e.team && <span style={{ color: 'var(--text3, #999)', fontSize: 12 }}>{e.team}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  const currentList = tab === 'full' ? fullList : tab === 'teams' ? entriesToShow : tabEntries[tab]

  return (
    <div style={{ margin: '32px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
          {emoji && <span style={{ marginRight: 8 }}>{emoji}</span>}
          {title || setName}
        </h3>
        <Link href={`/setlist/${setId}`} className="sle-accent" style={{ fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          Voir la checklist complète ({totalCards} cartes) →
        </Link>
      </div>

      {availableTabs.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {availableTabs.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: `1px solid ${tab === k ? '#003DA6' : 'var(--border, #ddd)'}`,
                background: tab === k ? '#003DA6' : 'var(--card-bg, #fff)', color: tab === k ? 'white' : 'var(--text2, #555)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
            >
              {TAB_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {tab === 'teams' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ columns: '220px', columnGap: 28, padding: '18px 22px', border: '1px solid var(--border, #eee)', borderRadius: 10, background: 'var(--bg3, #fafafa)' }}>
            {[...teamGroups.keys()].sort((a, b) => a.localeCompare(b)).map(teamName => (
              <div key={teamName} style={{ breakInside: 'avoid' }}>
                <a
                  href={`#team-${slugifyTeam(teamName)}`}
                  onClick={e => {
                    e.preventDefault()
                    document.getElementById(`team-${slugifyTeam(teamName)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="sle-accent" style={{ display: 'inline-block', padding: '5px 0', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}
                >
                  {teamName}
                </a>
              </div>
            ))}
          </div>
          {[...teamGroups.entries()].map(([teamName, items]) => (
            <div key={teamName} id={`team-${slugifyTeam(teamName)}`} style={{ scrollMarginTop: 90 }}>
              <h4 style={{ padding: '2px 0 8px', margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text, #222)' }}>
                {teamName} <span style={{ color: 'var(--text3, #999)', fontWeight: 700 }}>({items.length})</span>
              </h4>
              {renderList(items, { hideTeam: true })}
            </div>
          ))}
        </div>
      ) : renderList(currentList)}
    </div>
  )
}
