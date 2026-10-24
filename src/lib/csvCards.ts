export interface CsvCard {
  img: string
  back: string
  name: string
  team: string
  year: string
  brand: string
  serie: string
  variant: string
  num: string
  auto: boolean
  rc: boolean
  patch: boolean
  user_id: string
  display_name: string
  avatar_url: string | null
  accent: string
}

// Champs derives du CSV seul (pas du profil) -- c'est ce qui est mis en
// cache cote serveur dans csvCardsCache.ts ; display_name/avatar_url/accent
// sont rajoutes a la lecture depuis le profil courant.
export type RawCsvCard = Omit<CsvCard, 'user_id' | 'display_name' | 'avatar_url' | 'accent'>

export function parseCsv(text: string): RawCsvCard[] {
  const rows = text.split(/\r?\n/).slice(4)
  const out: RawCsvCard[] = []
  rows.forEach(row => {
    const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    if (!c[0]?.includes('http')) return
    out.push({
      img:    c[0]?.trim(),
      back:   (c[1]?.trim() || ''),
      name:   (c[2] || '').replace(/^"|"$/g, ''),
      team:   (c[3] || '').replace(/^"|"$/g, ''),
      year:   (c[4] || '').replace(/^"|"$/g, ''),
      brand:  (c[5] || '').replace(/^"|"$/g, ''),
      serie:  (c[6] || '').replace(/^"|"$/g, ''),
      variant:(c[7] || '').replace(/^"|"$/g, ''),
      num:    (c[8] || '').replace(/^"|"$/g, ''),
      auto:   (c[9] || '').toLowerCase().includes('oui'),
      rc:     (c[10] || '').toLowerCase().includes('oui'),
      patch:  (c[11] || '').toLowerCase().includes('oui'),
    })
  })
  return out
}

// Fetch live, sans cache -- utilise cote client (CardPicker.tsx, un seul
// profil a la fois) et comme repli par csvCardsCache.ts cote serveur.
// N'importe jamais de secret serveur ici : ce module est bundle cote
// navigateur (CardPicker est un composant client).
export async function fetchCsvCardsForProfiles(
  profiles: { id: string; display_name: string; avatar_url: string | null; lien_csv: string | null; couleur_bordure?: string | null }[]
): Promise<CsvCard[]> {
  const all: CsvCard[] = []
  await Promise.all(
    profiles.filter(p => p.lien_csv).map(async p => {
      try {
        const r = await fetch(p.lien_csv!, { signal: AbortSignal.timeout(4000), next: { revalidate: 3600 } })
        if (!r.ok) return
        const cards = parseCsv(await r.text())
        for (const c of cards) {
          all.push({ ...c, user_id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, accent: p.couleur_bordure || '#003DA6' })
        }
      } catch { /* skip unreachable CSV */ }
    })
  )
  return all
}
