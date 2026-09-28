import { fetchEspnPlayerAutofill, type EspnPlayerAutofill } from '@/lib/espnHeadshot'
import { findNbaComPlayer, heightMeters, weightKg, type NbaComPlayer } from '@/lib/nbaComPlayers'
import { espnCitizenshipToCode, nbaCountryName } from '@/lib/nbaCountries'

// Remplissage automatique d'une fiche joueur : stats de la derniere saison, age,
// poste, pays, experience, historique des equipes (ESPN) + pays/gabarit/draft
// (NBA.com) + une courte description de PROFIL dans les notes.
//
// La description ne repete PAS ce qui est deja affiche sur la fiche (poste, age,
// pays, experience, stats) : elle parle du joueur (gabarit, formation, draft,
// parcours, role). Redigee par Gemini a partir de faits fournis uniquement ; si
// Gemini est indisponible ou renvoie du hors-sujet, repli deterministe sur les
// faits NBA.com.

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
  const facts = {
    joueur: name,
    gabarit: [heightMeters(nba?.height ?? null), weightKg(nba?.weight ?? null)].filter(Boolean).join(', ') || null,
    universite: nba?.college || null,
    draft: draftText(nba),
    premiere_saison_nba: nba?.fromYear ?? null,
    parcours_equipes_nba: hist.length ? hist : null,
    // Pour deduire le ROLE uniquement (ne pas citer les chiffres) :
    derniere_saison: d?.points != null ? {
      saison: d.season, points: d.points, rebonds: d.rebounds, passes: d.assists, minutes: d.minutes, matchs: d.gamesPlayed,
    } : null,
  }
  const prompt = `Tu rédiges la courte description de profil d'un joueur NBA pour sa fiche dans une émission de cartes de collection (français, ton sobre et factuel).

Règles STRICTES :
- 2 phrases maximum, 260 caractères maximum.
- Utilise UNIQUEMENT les faits JSON ci-dessous. N'ajoute aucune connaissance extérieure : pas d'anecdote, de distinction, de blessure, de style de jeu ou de qualité qui ne se déduit pas des faits.
- NE répète PAS l'âge, le poste, le pays, l'expérience ni les chiffres de statistiques (déjà affichés à côté). Tu peux déduire un rôle des chiffres (scoreur, rebondeur, passeur, joueur de rotation...) sans les citer.
- Parle du profil : gabarit, formation universitaire, draft, parcours entre équipes, rôle.
- Si peu de faits sont fournis, écris une seule phrase courte plutôt que d'inventer.
- Pas d'emoji, pas de guillemets, pas de superlatifs.

Faits : ${JSON.stringify(facts)}

Réponds uniquement par le texte de la description.`
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 240, thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const json = await res.json()
    let text: string = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('').trim()
    text = text.replace(/^["«\s]+|["»\s]+$/g, '').replace(/\s+/g, ' ')
    if (!text || text.length < 15) return null
    // Garde-fous : pas de stats chiffrees recitees, pas de pavé.
    if (/\d+[.,]?\d*\s*(pts|points|rebonds|rbs|passes|pds|min)\b/i.test(text)) return null
    if (text.length > 320) {
      const cut = text.slice(0, 320)
      text = cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, 0)) || cut
    }
    return text
  } catch {
    return null
  }
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
