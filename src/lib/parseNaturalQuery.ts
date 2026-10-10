// Recherche en langage naturel : detecte quelques signaux frequents dans le
// texte tape ("RC", "auto", "patch", une annee, "sous /25", "1/1"...) pour
// appliquer automatiquement les filtres correspondants, plutot que d'obliger
// a les cocher manuellement. Le texte reconnu est retire de la requete pour
// ne garder que le nom recherche. Partage entre /recherche et la galerie.
export interface ParsedQuery { text: string; rc: boolean; auto: boolean; patch: boolean; num: boolean; year: string | null; numMax: number | null; numMin: number | null }

export function parseNaturalQuery(raw: string): ParsedQuery {
  let text = ` ${raw} `
  const strip = (re: RegExp) => { const has = re.test(text); text = text.replace(re, ' '); return has }

  const rc = strip(/\b(rc|rookie|rooky)\b/i)
  const auto = strip(/\b(auto|autographe|autograph)\b/i)
  const patch = strip(/\bpatch(e|es)?\b/i)

  // Tirage : comparaisons ("num </25", "num <= 25", "< 25", "sous 25", "moins de 25", "max 25") -> numMax ;
  // (">/50", ">= 50", "plus de 50", "au moins 50", "min 50") -> numMin ; "entre 10 et 50" -> les deux.
  // Toutes les bornes sont INCLUSIVES (comme le "sous /25" historique : une carte /25 est comprise dans "sous 25").
  let numMax: number | null = null
  let numMin: number | null = null
  let cmp = false
  const NUM = String.raw`(?:\bnum(?:erot[eé]e?s?)?\s*)?`
  const between = text.match(/\b(?:entre|between)\s*\/?\s*(\d{1,4})\s*(?:et|and|-|à|a)\s*\/?\s*(\d{1,4})\b/i)
  if (between) { numMin = Math.min(+between[1], +between[2]); numMax = Math.max(+between[1], +between[2]); text = text.replace(between[0], ' '); cmp = true }
  const UP = String.raw`(?:<=?|≤|\b(?:sous|en[\s-]*dessous(?:\s+de)?|moins\s+(?:de|que)|inf[eé]rieur(?:e)?s?\s+[aà]|less\s+than|under|below|max(?:imum)?|jusqu'?[aà])(?=[\s/\d]))`
  const LO = String.raw`(?:>=?|≥|\b(?:au[\s-]*dessus(?:\s+de)?|plus\s+(?:de|que)|sup[eé]rieur(?:e)?s?\s+[aà]|more\s+than|over|above|min(?:imum)?|au\s+moins|at\s+least)(?=[\s/\d]))`
  const upper = text.match(new RegExp(NUM + UP + String.raw`\s*\/?\s*(\d{1,4})\b`, 'i'))
  if (upper) { numMax = parseInt(upper[1]); text = text.replace(upper[0], ' '); cmp = true }
  const lower = text.match(new RegExp(NUM + LO + String.raw`\s*\/?\s*(\d{1,4})\b`, 'i'))
  if (lower) { numMin = parseInt(lower[1]); text = text.replace(lower[0], ' '); cmp = true }
  const exact = !cmp ? text.match(/\bnum(?:erot[eé]e?s?)?\s*=\s*\/?\s*(\d{1,4})\b/i) : null
  if (exact) { numMin = numMax = parseInt(exact[1]); text = text.replace(exact[0], ' '); cmp = true }

  let num = cmp
  if (!num) {
    const oneOfOne = strip(/\b1\s*\/\s*1\b/)
    if (oneOfOne) { num = true; numMax = 1 }
  }
  if (!num) {
    const bareNum = text.match(/\bnum(?:erot[eé]e?s?)?\b|\/(\d{1,4})\b/i)
    if (bareNum) { num = true; if (bareNum[1]) numMax = parseInt(bareNum[1]); text = text.replace(bareNum[0], ' ') }
  } else {
    // "num" seul restant a cote d'une comparaison : on le retire du texte
    text = text.replace(/\bnum(?:erot[eé]e?s?)?\b/i, ' ')
  }

  let year: string | null = null
  const yearMatch = text.match(/\b(19|20)\d{2}(-\d{2,4})?\b/)
  if (yearMatch) { year = yearMatch[0]; text = text.replace(yearMatch[0], ' ') }

  text = text.replace(/\s+/g, ' ').trim()
  return { text, rc, auto, patch, num, year, numMax, numMin }
}
