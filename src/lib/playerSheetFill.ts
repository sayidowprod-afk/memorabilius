import { fetchEspnPlayerAutofill, type EspnPlayerAutofill } from '@/lib/espnHeadshot'
import { findNbaComPlayer, heightMeters, weightKg, type NbaComPlayer } from '@/lib/nbaComPlayers'
import { espnCitizenshipToCode, nbaCountryName } from '@/lib/nbaCountries'

// Remplissage automatique d'une fiche joueur : stats de la derniere saison, age,
// poste, pays, experience, historique des equipes (ESPN) + pays/gabarit/draft
// (NBA.com) + une courte description de PROFIL dans les notes.
//
// La description est un profil de scout en 3 lignes (style de jeu, points forts,
// points faibles) redige par Gemini a partir de ses connaissances du joueur ET des
// faits NBA.com/ESPN ; elle ne repete pas ce qui est deja affiche sur la fiche.
// Joueur inconnu du modele (recrue recente) : mention "(profil a confirmer)".
// Si Gemini est indisponible, repli deterministe sur les faits NBA.com.

// Noms qui different entre notre liste (Spotrac) et ESPN.
const ESPN_ALIASES: Record<string, string[]> = {
  'nicolas claxton': ['Nic Claxton'],
  'ron holland ii': ['Ronald Holland II', 'Ron Holland'],
  'tolu smith iii': ['Tolu Smith'],
  'cameron christie': ['Cam Christie'],
  "nah'shon hyland": ['Bones Hyland'],
  'herb jones': ['Herbert Jones'],
}

const fr = (v: string | null | undefined) => (v == null ? '' : String(v).replace('.', ','))

function draftText(p: NbaComPlayer | null): string | null {
  if (!p) return null
  if (p.draftYear && p.draftRound && p.draftNumber) {
    return `drafté en ${p.draftYear} (${p.draftRound === 1 ? '1er' : `${p.draftRound}e`} tour, n°${p.draftNumber})`
  }
  if (p.draftYear) return `drafté en ${p.draftYear}`
  if (p.fromYear) return `non drafté, arrivé en NBA en ${p.fromYear}`
  return null
}

function fallbackDescription(nba: NbaComPlayer | null, d: EspnPlayerAutofill | null): string {
  const parts: string[] = []
  const h = heightMeters(nba?.height ?? null), w = weightKg(nba?.weight ?? null)
  if (h) parts.push(`Gabarit de ${h}${w ? ` pour ${w}` : ''}.`)
  const origin = [nba?.college ? `formé à ${nba.college}` : null, draftText(nba)].filter(Boolean).join(', ')
  if (origin) parts.push(`${origin[0].toUpperCase()}${origin.slice(1)}.`)
  const hist = d?.teamHistory || []
  if (hist.length > 1) {
    const before = hist.slice(0, -1).map(s => s.name).filter((n, i, a) => a.indexOf(n) === i)
    if (before.length) parts.push(`Passé par : ${before.join(', ')}.`)
  }
  return parts.join(' ')
}

async function geminiDescription(name: string, nba: NbaComPlayer | null, d: EspnPlayerAutofill | null): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  const hist = (d?.teamHistory || []).map(s => `${s.name} (${s.from} à ${s.to})`)
  const recent = !!nba?.draftYear && nba.draftYear >= 2025
  const facts = {
    joueur: name,
    poste_espn: d?.position || null,
    gabarit: [heightMeters(nba?.height ?? null), weightKg(nba?.weight ?? null)].filter(Boolean).join(', ') || null,
    universite: nba?.college || null,
    draft: draftText(nba),
    premiere_saison_nba: nba?.fromYear ?? null,
    parcours_equipes_nba: hist.length ? hist : null,
    derniere_saison: d?.points != null ? {
      saison: d.season, points: d.points, rebonds: d.rebounds, passes: d.assists, minutes: d.minutes, matchs: d.gamesPlayed,
    } : null,
  }
  const prompt = `Tu es un analyste basket qui rédige le profil d'un joueur NBA pour sa fiche dans une émission de cartes de collection. Français, ton direct et sobre, comme un scout.

Format EXACT (3 lignes, séparées par un retour à la ligne, sans autre texte) :
Style de jeu : <1 phrase courte>
Points forts : <2 à 4 qualités, séparées par des virgules>
Points faibles : <1 à 3 défauts ou limites, séparés par des virgules>

Règles :
- Appuie-toi sur ce que tu sais réellement de ce joueur (style, tendances, réputation) ET sur les faits JSON ci-dessous (gabarit, formation, draft, rôle déduit des chiffres).
- Reste sur des caractéristiques largement reconnues. N'invente ni anecdote, ni blessure, ni distinction, ni statistique précise. Aucun chiffre de stats.
- Uniquement des qualités et défauts SPORTIFS observables sur le terrain (tir, création, finition, défense, rebond, physique, gestion de balle...). Interdit : éthique de travail, leadership, mentalité, professionnalisme, "potentiel" vague, et tout trait de caractère.
- N'écris pas l'âge, le pays ni l'expérience. Pas d'emoji, pas de guillemets, pas de superlatifs gratuits.
- Chaque ligne fait au plus 150 caractères.
${recent ? "- Joueur très récent (drafté en 2025 ou 2026) : tu le connais peut-être mal. Base-toi surtout sur le gabarit, l'université, la position au draft et le rôle ; reste prudent et termine la dernière ligne par ' (profil à confirmer)'.\n" : "- Si tu ne connais pas vraiment ce joueur, base-toi sur les faits et termine la dernière ligne par ' (profil à confirmer)'.\n"}
Faits : ${JSON.stringify(facts)}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 256 } },
        }),
        signal: AbortSignal.timeout(22000),
      })
      if (!res.ok) continue
      const json = await res.json()
      const raw: string = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim()
      const lines = raw.split('\n').map(l => l.replace(/^[\s*\-•"«]+|["»\s*]+$/g, '').replace(/\s+/g, ' ')).filter(Boolean)
      const style = lines.find(l => /^style de jeu\s*:/i.test(l))
      const forts = lines.find(l => /^points? forts?\s*:/i.test(l))
      const faibles = lines.find(l => /^points? faibles?\s*:/i.test(l))
      if (!style || !forts || !faibles) continue
      // Pas de statistiques chiffrees recitees.
      const out = [style, forts, faibles]
      if (out.some(l => /\d+[.,]?\d*\s*(pts|points|rebonds|rbs|passes|pds|min)\b/i.test(l))) continue
      return out.join('\n')
    } catch { /* on retente une fois */ }
  }
  return null
}

export interface SheetFill {
  fields: Record<string, string>
  team_history: EspnPlayerAutofill['teamHistory']
  notes: string
}

// null si ni ESPN ni NBA.com ne connaissent le joueur.
export async function computeSheetFill(name: string): Promise<SheetFill | null> {
  const aliases = ESPN_ALIASES[name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || []
  let d: EspnPlayerAutofill | null = null
  for (const candidate of [name, ...aliases]) {
    d = await fetchEspnPlayerAutofill(candidate, 'nba')
    if (d) break
  }
  const nba = (await findNbaComPlayer(name)) ?? (await (async () => {
    for (const a of aliases) { const p = await findNbaComPlayer(a); if (p) return p }
    return null
  })())
  if (!d && !nba) return null

  const fields: Record<string, string> = {}
  if (d) {
    if (d.age != null) fields.stat_age = `${d.age} ans`
    if (d.position) fields.stat_poste = d.position
    if (d.experience) fields.stat_saison = d.experience
    if (d.gamesPlayed != null) fields.stat_matches = d.gamesPlayed
    if (d.minutes != null) fields.stat_minutes = d.minutes
    if (d.points != null) fields.stat_points = d.points
    if (d.rebounds != null) fields.stat_rebonds = d.rebounds
    if (d.assists != null) fields.stat_passes = d.assists
  }
  // Pays : ESPN (citoyennete / lieu de naissance) sinon NBA.com, qui le renseigne
  // pour tous les joueurs.
  const country = d?.countryCode ?? espnCitizenshipToCode(nba?.country)
  if (country && nbaCountryName(country)) fields.stat_country = country

  const notes = (await geminiDescription(name, nba, d)) || fallbackDescription(nba, d)
  return { fields, team_history: d?.teamHistory ?? [], notes }
}
