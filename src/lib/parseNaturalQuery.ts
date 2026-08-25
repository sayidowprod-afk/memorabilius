// Recherche en langage naturel : detecte quelques signaux frequents dans le
// texte tape ("RC", "auto", "patch", une annee, "sous /25", "1/1"...) pour
// appliquer automatiquement les filtres correspondants, plutot que d'obliger
// a les cocher manuellement. Le texte reconnu est retire de la requete pour
// ne garder que le nom recherche. Partage entre /recherche et la galerie.
export interface ParsedQuery { text: string; rc: boolean; auto: boolean; patch: boolean; num: boolean; year: string | null; numMax: number | null }

export function parseNaturalQuery(raw: string): ParsedQuery {
  let text = ` ${raw} `
  const strip = (re: RegExp) => { const has = re.test(text); text = text.replace(re, ' '); return has }

  const rc = strip(/\b(rc|rookie|rooky)\b/i)
  const auto = strip(/\b(auto|autographe|autograph)\b/i)
  const patch = strip(/\bpatch(e|es)?\b/i)

  let numMax: number | null = null
  const underMatch = text.match(/\b(?:sous|moins de|under|below)\s*\/?\s*(\d{1,4})\b/i)
  if (underMatch) { numMax = parseInt(underMatch[1]); text = text.replace(underMatch[0], ' ') }

  let num = numMax !== null
  if (!num) {
    const oneOfOne = strip(/\b1\s*\/\s*1\b/)
    if (oneOfOne) { num = true; numMax = 1 }
  }
  if (!num) {
    const bareNum = text.match(/\bnumerot[eé]e?s?\b|\/(\d{1,4})\b/i)
    if (bareNum) { num = true; if (bareNum[1]) numMax = parseInt(bareNum[1]); text = text.replace(bareNum[0], ' ') }
  }

  let year: string | null = null
  const yearMatch = text.match(/\b(19|20)\d{2}(-\d{2,4})?\b/)
  if (yearMatch) { year = yearMatch[0]; text = text.replace(yearMatch[0], ' ') }

  text = text.replace(/\s+/g, ' ').trim()
  return { text, rc, auto, patch, num, year, numMax }
}
