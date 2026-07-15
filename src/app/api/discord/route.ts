import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicKey, verify as cryptoVerify } from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyDiscord(req: NextRequest, body: string): boolean {
  const sig = req.headers.get('x-signature-ed25519') || ''
  const ts  = req.headers.get('x-signature-timestamp') || ''
  if (!sig || !ts || !process.env.DISCORD_PUBLIC_KEY) return false
  try {
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const rawKey = Buffer.from(process.env.DISCORD_PUBLIC_KEY, 'hex')
    const spki = Buffer.concat([spkiPrefix, rawKey])
    const keyObject = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return cryptoVerify(null, Buffer.from(ts + body), keyObject, Buffer.from(sig, 'hex'))
  } catch { return false }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasKey: !!process.env.DISCORD_PUBLIC_KEY,
    keyLength: process.env.DISCORD_PUBLIC_KEY?.length ?? 0,
  })
}

function reply(data: object) {
  return { type: 4, data }
}

async function cmdCollection(options: any[]) {
  const username = options.find((o: any) => o.name === 'utilisateur')?.value || ''
  if (!username) return reply({ content: "❌ Précise un nom d'utilisateur.", flags: 64 })

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, stats_total, stats_rc, stats_auto, stats_num, stats_patch')
    .ilike('display_name', `%${username}%`)
    .not('display_name', 'is', null)
    .limit(1)

  const p = data?.[0]
  if (!p) return reply({ content: `❌ Aucun collectionneur trouvé pour \`${username}\`.`, flags: 64 })

  return reply({
    embeds: [{
      title: `🗂️ Collection de ${p.display_name}`,
      color: 0x003DA6,
      fields: [
        { name: '📦 Total',      value: `**${(p.stats_total || 0).toLocaleString('fr-FR')}** cartes`, inline: true },
        { name: '🌟 RC',         value: `**${p.stats_rc || 0}**`, inline: true },
        { name: '✍️ Auto',       value: `**${p.stats_auto || 0}**`, inline: true },
        { name: '🔢 Numérotées', value: `**${p.stats_num || 0}**`, inline: true },
        { name: '🪡 Patch',      value: `**${p.stats_patch || 0}**`, inline: true },
      ],
      url: `https://memorabilius.fr/galerie/${p.id}`,
      footer: { text: 'memorabilius.fr' },
    }],
  })
}

async function cmdTop() {
  const month = new Date().toISOString().slice(0, 7)
  const { data } = await supabase
    .from('monthly_additions')
    .select('user_id, count, profiles(display_name)')
    .eq('month', month)
    .order('count', { ascending: false })
    .limit(5)

  if (!data?.length) return reply({ content: '📭 Pas encore de données ce mois-ci.' })

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  const lines = (data as any[]).map((row, i) =>
    `${medals[i]} **${row.profiles?.display_name || 'Inconnu'}** — +${row.count} carte${row.count > 1 ? 's' : ''}`
  )
  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return reply({
    embeds: [{
      title: `🏆 Top collectionneurs — ${monthLabel}`,
      color: 0xf39c12,
      description: lines.join('\n'),
      url: 'https://memorabilius.fr',
      footer: { text: 'memorabilius.fr' },
    }],
  })
}

function parseTokens(input: string) {
  const tokens = input.toLowerCase().split(/\s+/)
  const isRc    = tokens.includes('rc')
  const isAuto  = tokens.includes('auto')
  const isPatch = tokens.includes('patch')
  const yearTok = tokens.find(t => /^\d{4}(-\d{2})?$/.test(t))
  const numTok  = tokens.find(t => /^\/?\d+$/.test(t) && t !== yearTok)
  const text    = tokens.filter(t =>
    !['rc', 'auto', 'patch'].includes(t) &&
    !/^\d{4}(-\d{2})?$/.test(t) &&
    t !== numTok
  ).join(' ').trim()
  return { isRc, isAuto, isPatch, yearTok, numTok, text }
}

function matchesCsvCard(card: any, tk: ReturnType<typeof parseTokens>): boolean {
  const norm = (s: string) => (s || '').toLowerCase()
  const haystack = [card.name, card.variant, card.brand, card.serie, card.team].map(norm).join(' ')
  if (tk.text && !haystack.includes(tk.text)) return false
  if (tk.isRc    && !card.rc)    return false
  if (tk.isAuto  && !card.auto)  return false
  if (tk.isPatch && !card.patch) return false
  if (tk.yearTok && !norm(card.year).includes(tk.yearTok)) return false
  if (tk.numTok  && !norm(card.num).includes(tk.numTok.replace('/', ''))) return false
  return true
}

async function searchCsv(profiles: any[], tk: ReturnType<typeof parseTokens>) {
  for (const p of profiles) {
    if (!p.lien_csv) continue
    try {
      const res = await fetch(p.lien_csv, { signal: AbortSignal.timeout(2000), next: { revalidate: 3600 } } as any)
      if (!res.ok) continue
      const text = await res.text()
      const rows = text.split(/\r?\n/).slice(4)
      for (const row of rows) {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0]?.includes('http')) continue
        const card = {
          img: c[0]?.trim(), name: (c[2] || '').replace(/^"|"$/g, ''),
          team: (c[3] || '').replace(/^"|"$/g, ''), year: (c[4] || '').replace(/^"|"$/g, ''),
          brand: (c[5] || '').replace(/^"|"$/g, ''), serie: (c[6] || '').replace(/^"|"$/g, ''),
          variant: (c[7] || '').replace(/^"|"$/g, ''), num: (c[8] || '').replace(/^"|"$/g, ''),
          auto: (c[9] || '').toLowerCase().includes('oui'),
          rc: (c[10] || '').toLowerCase().includes('oui'),
          patch: (c[11] || '').toLowerCase().includes('oui'),
        }
        if (matchesCsvCard(card, tk)) return { card, profile: p }
      }
    } catch { continue }
  }
  return null
}

async function cmdCarte(options: any[]) {
  const input = (options.find((o: any) => o.name === 'nom')?.value || '') as string
  const utilisateur = options.find((o: any) => o.name === 'utilisateur')?.value || ''
  if (!input) return reply({ content: "❌ Précise le nom d'une carte.", flags: 64 })

  const tk = parseTokens(input)

  // Résoudre l'utilisateur si spécifié
  let targetProfile: any = null
  if (utilisateur) {
    const { data: prof } = await supabase
      .from('profiles').select('id, display_name, lien_csv').ilike('display_name', `%${utilisateur}%`).limit(1)
    if (!prof?.[0]) return reply({ content: `❌ Collectionneur \`${utilisateur}\` introuvable.`, flags: 64 })
    targetProfile = prof[0]
  }

  // Recherche DB (cartes_manuelles) et CSV en parallèle
  let dbQuery = supabase
    .from('cartes_manuelles')
    .select('nom, image_recto, equipe, annee, marque, variation, collection, rc, auto, num, patch, user_id, profiles(id, display_name)')
    .not('image_recto', 'is', null)

  if (tk.text) {
    const s = tk.text.replace(/[%_]/g, '\\$&')
    dbQuery = dbQuery.or(`nom.ilike.%${s}%,variation.ilike.%${s}%,marque.ilike.%${s}%,equipe.ilike.%${s}%,collection.ilike.%${s}%`)
  }
  if (tk.isRc)    dbQuery = dbQuery.eq('rc', true)
  if (tk.isAuto)  dbQuery = dbQuery.eq('auto', true)
  if (tk.isPatch) dbQuery = dbQuery.eq('patch', true)
  if (tk.yearTok) dbQuery = dbQuery.ilike('annee', `%${tk.yearTok}%`)
  if (tk.numTok)  dbQuery = dbQuery.ilike('num', `%${tk.numTok.replace('/', '')}%`)
  if (targetProfile) dbQuery = dbQuery.eq('user_id', targetProfile.id)

  // Pour les CSV : si utilisateur spécifié → son CSV seulement, sinon top 15 avec CSV
  const csvProfilesPromise = targetProfile
    ? Promise.resolve([targetProfile])
    : supabase.from('profiles').select('id, display_name, lien_csv')
        .not('lien_csv', 'is', null).neq('lien_csv', '').limit(15)
        .then(r => r.data || [])

  const [dbResult, csvProfiles] = await Promise.all([dbQuery.limit(1), csvProfilesPromise])

  const dbCard = dbResult.data?.[0] as any
  const csvResult = dbCard ? null : await searchCsv(csvProfiles, tk)

  if (!dbCard && !csvResult) {
    return reply({ content: `❌ Aucune carte trouvée pour \`${input}\`${utilisateur ? ` chez \`${utilisateur}\`` : ''}.`, flags: 64 })
  }

  // Construire la réponse
  let nom: string, img: string, desc: string, badges: string[], profileId: string, profileName: string, cardUrl: string

  if (dbCard) {
    const p = dbCard.profiles
    nom = dbCard.nom
    img = dbCard.image_recto
    desc = [dbCard.variation, dbCard.annee, dbCard.marque, dbCard.equipe].filter(Boolean).join(' · ')
    badges = []
    if (dbCard.rc)    badges.push('🌟 RC')
    if (dbCard.auto)  badges.push('✍️ Auto')
    if (dbCard.patch) badges.push('🪡 Patch')
    if (dbCard.num)   badges.push(`🔢 ${dbCard.num}`)
    profileId = p?.id; profileName = p?.display_name
  } else {
    const { card, profile: p } = csvResult!
    nom = card.name
    img = card.img
    desc = [card.variant, card.year, card.brand, card.team].filter(Boolean).join(' · ')
    badges = []
    if (card.rc)    badges.push('🌟 RC')
    if (card.auto)  badges.push('✍️ Auto')
    if (card.patch) badges.push('🪡 Patch')
    if (card.num)   badges.push(`🔢 ${card.num}`)
    profileId = p.id; profileName = p.display_name
  }

  cardUrl = profileId
    ? `https://memorabilius.fr/galerie/${profileId}?card=${encodeURIComponent(img)}`
    : 'https://memorabilius.fr'

  return reply({
    embeds: [{
      title: nom,
      url: cardUrl,
      description: desc || undefined,
      color: 0x003DA6,
      image: { url: img },
      fields: badges.length ? [{ name: 'Badges', value: badges.join('  '), inline: false }] : [],
      author: profileName ? {
        name: profileName,
        url: `https://memorabilius.fr/galerie/${profileId}`,
      } : undefined,
      footer: { text: 'memorabilius.fr' },
    }],
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyDiscord(req, rawBody)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  if (body.type === 1) return NextResponse.json({ type: 1 })

  if (body.type === 2) {
    const name = body.data?.name
    const options = body.data?.options || []
    let result: object = { type: 1 }
    if (name === 'collection') result = await cmdCollection(options)
    else if (name === 'top')   result = await cmdTop()
    else if (name === 'carte') result = await cmdCarte(options)
    return NextResponse.json(result)
  }

  return NextResponse.json({ type: 1 })
}
