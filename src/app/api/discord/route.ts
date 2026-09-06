import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPublicKey, verify as cryptoVerify } from 'crypto'
import { isAllowedCsvUrl } from '@/lib/csvParse'
import { waitUntil } from '@vercel/functions'
import { renderCardSpinGif } from '@/lib/discordCardGif'

// ── Concours hebdomadaire ─────────────────────────────────────────────────────

async function cmdConcoursThemeAjouter(options: any[]) {
  const label = (options.find((o: any) => o.name === 'texte')?.value || '').trim()
  if (!label) return reply({ content: '❌ Précise un thème.', flags: 64 })
  const { error } = await supabase.from('discord_contest_themes').insert({ label })
  if (error) return reply({ content: `❌ Erreur : ${error.message}`, flags: 64 })
  return reply({ content: `✅ Thème ajouté au pool : **${label}**`, flags: 64 })
}

async function cmdConcoursThemeSupprimer(options: any[]) {
  const label = (options.find((o: any) => o.name === 'texte')?.value || '').trim()
  if (!label) return reply({ content: '❌ Précise le thème à retirer.', flags: 64 })
  const { data } = await supabase.from('discord_contest_themes').select('id, label').ilike('label', `%${label}%`).eq('active', true).limit(1)
  const t = data?.[0]
  if (!t) return reply({ content: `❌ Aucun thème actif ne correspond à \`${label}\`.`, flags: 64 })
  await supabase.from('discord_contest_themes').update({ active: false }).eq('id', t.id)
  return reply({ content: `🗑️ Thème retiré du pool : **${t.label}**`, flags: 64 })
}

async function cmdConcoursThemes() {
  const { data } = await supabase.from('discord_contest_themes').select('label').eq('active', true).order('label')
  if (!data?.length) return reply({ content: "📭 Aucun thème dans le pool pour l'instant.", flags: 64 })
  return reply({
    embeds: [{ title: `🎨 Pool de thèmes (${data.length})`, description: data.map((t: any) => `• ${t.label}`).join('\n').slice(0, 4000), color: 0x003DA6 }],
    flags: 64,
  })
}

async function cmdConcoursGagnants() {
  const { data } = await supabase
    .from('discord_contest_weeks')
    .select('week_start, discord_contest_themes(label), discord_contest_entries(discord_username)')
    .eq('status', 'closed')
    .not('winning_entry_id', 'is', null)
    .order('week_start', { ascending: false })
    .limit(10)

  if (!data?.length) return reply({ content: "📭 Pas encore d'historique de gagnants.", flags: 64 })

  const lines = (data as any[]).map(w => {
    const date = new Date(w.week_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    return `**${date}** — *${w.discord_contest_themes?.label || '?'}* : 🏆 ${w.discord_contest_entries?.discord_username || '?'}`
  })

  return reply({ embeds: [{ title: '📜 Historique des gagnants', description: lines.join('\n'), color: 0xf39c12 }], flags: 64 })
}

async function cmdConcoursParticiper(body: any) {
  const options = body.data?.options || []
  const discordUser = body.member?.user || body.user
  if (!discordUser) return reply({ content: '❌ Utilisateur introuvable.', flags: 64 })

  const { data: week } = await supabase.from('discord_contest_weeks').select('id').eq('status', 'submission_open').order('week_start', { ascending: false }).limit(1).maybeSingle()
  if (!week) return reply({ content: "❌ Aucun concours n'accepte de participations en ce moment.", flags: 64 })

  const attachmentOpt = options.find((o: any) => o.name === 'image')
  let imageUrl: string | null = null
  if (attachmentOpt) {
    imageUrl = body.data?.resolved?.attachments?.[attachmentOpt.value]?.url || null
  }
  if (!imageUrl && (options.find((o: any) => o.name === 'nom') || options.find((o: any) => o.name === 'lien'))) {
    const result = await findCardData(options)
    if ('error' in result) return reply({ content: result.error, flags: 64 })
    imageUrl = result.data.img
  }
  if (!imageUrl) return reply({ content: '❌ Joins une image, précise `nom` ou colle un `lien` Memorabilius (comme pour /carte).', flags: 64 })

  const { error } = await supabase.from('discord_contest_entries').upsert(
    { week_id: week.id, discord_user_id: discordUser.id, discord_username: discordUser.username, image_url: imageUrl },
    { onConflict: 'week_id,discord_user_id' }
  )
  if (error) return reply({ content: `❌ Erreur : ${error.message}`, flags: 64 })

  return reply({ content: '✅ Ta participation a été enregistrée ! Le vote démarre vendredi 8h.', flags: 64 })
}

async function handleContestComponent(body: any) {
  const customId: string = body.data?.custom_id || ''
  const discordUserId = body.member?.user?.id || body.user?.id
  if (!discordUserId) return reply({ content: '❌ Utilisateur introuvable.', flags: 64 })

  if (customId.startsWith('cvote:')) {
    const [, weekId, themeId] = customId.split(':')
    const { data: week } = await supabase.from('discord_contest_weeks').select('status').eq('id', weekId).single()
    if (week?.status !== 'theme_voting') return reply({ content: '⏱️ Le vote des thèmes est terminé.', flags: 64 })
    const { error } = await supabase.from('discord_contest_theme_votes').upsert(
      { week_id: weekId, theme_id: themeId, discord_user_id: discordUserId },
      { onConflict: 'week_id,discord_user_id' }
    )
    if (error) return reply({ content: `❌ ${error.message}`, flags: 64 })
    return reply({ content: '✅ Ton vote a été pris en compte !', flags: 64 })
  }

  if (customId.startsWith('evote:')) {
    const [, weekId, entryId] = customId.split(':')
    const { data: week } = await supabase.from('discord_contest_weeks').select('status').eq('id', weekId).single()
    if (week?.status !== 'entry_voting') return reply({ content: '⏱️ Le vote des participations est terminé.', flags: 64 })
    const { data: entry } = await supabase.from('discord_contest_entries').select('discord_user_id').eq('id', entryId).single()
    if (entry?.discord_user_id === discordUserId) return reply({ content: '❌ Tu ne peux pas voter pour ta propre carte 😉', flags: 64 })
    const { error } = await supabase.from('discord_contest_entry_votes').upsert(
      { week_id: weekId, entry_id: entryId, discord_user_id: discordUserId },
      { onConflict: 'week_id,discord_user_id' }
    )
    if (error) return reply({ content: `❌ ${error.message}`, flags: 64 })
    return reply({ content: '✅ Ton vote a été enregistré !', flags: 64 })
  }

  return reply({ content: '❌ Action inconnue.', flags: 64 })
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

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
  const searchOne = async (p: any): Promise<{ card: any; profile: any } | null> => {
    if (!p.lien_csv || !isAllowedCsvUrl(p.lien_csv)) return null
    try {
      const res = await fetch(p.lien_csv, { signal: AbortSignal.timeout(2000), next: { revalidate: 3600 } } as any)
      if (!res.ok) return null
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
    } catch { /* CSV inaccessible */ }
    return null
  }

  // Recherche en parallèle — Promise.any s'arrête dès le premier match
  try {
    return await Promise.any(profiles.map(searchOne))
  } catch {
    return null
  }
}

interface CardData {
  nom: string; img: string; imgBack: string | null; desc: string; badges: string[]
  profileId: string | null; profileName: string | null; cardUrl: string
}

// Un lien de carte est de la forme https://memorabilius.fr/galerie/{profileId}?card={image}
// (voir la construction de cardUrl plus bas) -- on extrait les deux pour retrouver
// directement la ligne exacte plutot que de repasser par une recherche floue.
function cardDataFromRow(dbCard: any, link: string, fallbackProfileId: string | null = null): CardData {
  const p = dbCard.profiles
  const desc = [dbCard.variation, dbCard.annee, dbCard.marque, dbCard.equipe].filter(Boolean).join(' · ')
  const badges: string[] = []
  if (dbCard.rc)    badges.push('🌟 RC')
  if (dbCard.auto)  badges.push('✍️ Auto')
  if (dbCard.patch) badges.push('🪡 Patch')
  if (dbCard.num)   badges.push(`🔢 ${dbCard.num}`)

  return {
    nom: dbCard.nom, img: dbCard.image_recto, imgBack: dbCard.image_verso || null, desc, badges,
    profileId: p?.id || fallbackProfileId, profileName: p?.display_name || null, cardUrl: link,
  }
}

// Format le plus courant : lien de partage genere par l'appli, /s/{cardId}
// (cartes_manuelles.id -- voir src/app/s/[cardId]/page.tsx et les boutons
// "partager" dans GalerieClient.tsx/Viewer3D.tsx). On garde en repli l'ancien
// format /galerie/{userId}?card={image} (celui construit pour l'embed Discord
// lui-meme), au cas ou quelqu'un colle ce lien-la plutot que le lien de partage.
async function findCardByLink(rawLink: string): Promise<CardData | null> {
  // Tolère un lien colle avec du texte autour ("voici ma carte : https://...")
  // -- on extrait la premiere sous-chaine qui ressemble a une URL plutot que
  // d'exiger que tout le champ en soit une, sinon new URL() leve et on perd
  // silencieusement une saisie par ailleurs valide.
  const urlMatch = rawLink.match(/https?:\/\/\S+/)
  let url: URL
  try { url = new URL(urlMatch ? urlMatch[0] : rawLink) } catch { return null }

  const shareMatch = url.pathname.match(/\/s\/([^/?]+)/)
  if (shareMatch) {
    const { data: dbCard } = await supabase
      .from('cartes_manuelles')
      .select('nom, image_recto, image_verso, equipe, annee, marque, variation, collection, rc, auto, num, patch, profiles(id, display_name)')
      .eq('id', shareMatch[1])
      .maybeSingle()
    if (dbCard) return cardDataFromRow(dbCard, url.toString())
  }

  const galerieMatch = url.pathname.match(/\/galerie\/([^/?]+)/)
  const img = url.searchParams.get('card')
  if (galerieMatch && img) {
    const { data: dbCard } = await supabase
      .from('cartes_manuelles')
      .select('nom, image_recto, image_verso, equipe, annee, marque, variation, collection, rc, auto, num, patch, profiles(id, display_name)')
      .eq('user_id', galerieMatch[1])
      .eq('image_recto', img)
      .limit(1)
      .maybeSingle()
    if (dbCard) return cardDataFromRow(dbCard, url.toString(), galerieMatch[1])
  }

  return null
}

// Partagé par /carte, /carte-gif et /concours-participer -- même recherche
// (lien direct, puis DB, puis CSV en repli), juste le format de reponse differe.
async function findCardData(options: any[]): Promise<{ error: string } | { data: CardData }> {
  const lien = (options.find((o: any) => o.name === 'lien')?.value || '') as string
  if (lien) {
    const byLink = await findCardByLink(lien)
    if (byLink) return { data: byLink }
    console.error('[concours/lien] echec de resolution, lien recu:', JSON.stringify(lien))
    return { error: '❌ Impossible de retrouver une carte depuis ce lien.' }
  }

  const input = (options.find((o: any) => o.name === 'nom')?.value || '') as string
  const utilisateur = options.find((o: any) => o.name === 'utilisateur')?.value || ''
  if (!input) return { error: "❌ Précise le nom d'une carte ou un lien Memorabilius (`lien`)." }

  const tk = parseTokens(input)

  // Résoudre l'utilisateur si spécifié
  let targetProfile: any = null
  if (utilisateur) {
    const { data: prof } = await supabase
      .from('profiles').select('id, display_name, lien_csv').ilike('display_name', `%${utilisateur}%`).limit(1)
    if (!prof?.[0]) return { error: `❌ Collectionneur \`${utilisateur}\` introuvable.` }
    targetProfile = prof[0]
  }

  // Recherche DB (cartes_manuelles) et CSV en parallèle
  let dbQuery = supabase
    .from('cartes_manuelles')
    .select('nom, image_recto, image_verso, equipe, annee, marque, variation, collection, rc, auto, num, patch, user_id, profiles(id, display_name)')
    .not('image_recto', 'is', null)

  if (tk.text) {
    // `,` et `()` sont les séparateurs/groupeurs de la syntaxe .or() de PostgREST —
    // un input non filtré pourrait injecter des clauses de filtre supplémentaires.
    const s = tk.text.replace(/[%_]/g, '\\$&').replace(/[,()]/g, ' ').trim()
    if (s) dbQuery = dbQuery.or(`nom.ilike.%${s}%,variation.ilike.%${s}%,marque.ilike.%${s}%,equipe.ilike.%${s}%,collection.ilike.%${s}%`)
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
    return { error: `❌ Aucune carte trouvée pour \`${input}\`${utilisateur ? ` chez \`${utilisateur}\`` : ''}.` }
  }

  let nom: string, img: string, imgBack: string | null, desc: string, badges: string[]
  let profileId: string | null, profileName: string | null

  if (dbCard) {
    const p = dbCard.profiles
    nom = dbCard.nom
    img = dbCard.image_recto
    imgBack = dbCard.image_verso || null
    desc = [dbCard.variation, dbCard.annee, dbCard.marque, dbCard.equipe].filter(Boolean).join(' · ')
    badges = []
    if (dbCard.rc)    badges.push('🌟 RC')
    if (dbCard.auto)  badges.push('✍️ Auto')
    if (dbCard.patch) badges.push('🪡 Patch')
    if (dbCard.num)   badges.push(`🔢 ${dbCard.num}`)
    profileId = p?.id || null; profileName = p?.display_name || null
  } else {
    const { card, profile: p } = csvResult!
    nom = card.name
    img = card.img
    imgBack = null
    desc = [card.variant, card.year, card.brand, card.team].filter(Boolean).join(' · ')
    badges = []
    if (card.rc)    badges.push('🌟 RC')
    if (card.auto)  badges.push('✍️ Auto')
    if (card.patch) badges.push('🪡 Patch')
    if (card.num)   badges.push(`🔢 ${card.num}`)
    profileId = p.id; profileName = p.display_name
  }

  const cardUrl = profileId
    ? `https://memorabilius.fr/galerie/${profileId}?card=${encodeURIComponent(img)}`
    : 'https://memorabilius.fr'

  return { data: { nom, img, imgBack, desc, badges, profileId, profileName, cardUrl } }
}

function cardEmbed(d: CardData, imageUrl: string) {
  return {
    title: d.nom,
    url: d.cardUrl,
    description: d.desc || undefined,
    color: 0x003DA6,
    image: { url: imageUrl },
    fields: d.badges.length ? [{ name: 'Badges', value: d.badges.join('  '), inline: false }] : [],
    author: d.profileName ? {
      name: d.profileName,
      url: `https://memorabilius.fr/galerie/${d.profileId}`,
    } : undefined,
    footer: { text: 'memorabilius.fr' },
  }
}

async function cmdCarte(options: any[]) {
  const result = await findCardData(options)
  if ('error' in result) return reply({ content: result.error, flags: 64 })
  return reply({ embeds: [cardEmbed(result.data, result.data.img)] })
}

// Genere le GIF et edite la reponse differee une fois pret -- appele en
// arriere-plan (waitUntil) apres l'ACK immediat de type 5, car le rendu
// (plusieurs frames canvas + encodage GIF) depasse largement la limite de
// 3s de Discord pour une reponse initiale. Le follow-up webhook, lui,
// tolere jusqu'a 15 minutes.
async function sendCarteGifFollowup(applicationId: string, token: string, d: CardData) {
  const editUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`
  try {
    const gifBuffer = await renderCardSpinGif(d.img, d.imgBack)
    const form = new FormData()
    form.append('payload_json', JSON.stringify({ embeds: [cardEmbed(d, 'attachment://carte.gif')] }))
    form.append('files[0]', new Blob([new Uint8Array(gifBuffer)], { type: 'image/gif' }), 'carte.gif')
    await fetch(editUrl, { method: 'PATCH', body: form })
  } catch (e) {
    await fetch(editUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `❌ Échec de génération du GIF : ${e instanceof Error ? e.message : String(e)}` }),
    }).catch(() => {})
  }
}

async function cmdCarteGif(options: any[], applicationId: string, token: string) {
  const result = await findCardData(options)
  if ('error' in result) return reply({ content: result.error, flags: 64 })
  waitUntil(sendCarteGifFollowup(applicationId, token, result.data))
  return { type: 5 } // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE -- "Memorabilius Bot réfléchit…"
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
    else if (name === 'carte-gif') result = await cmdCarteGif(options, body.application_id, body.token)
    else if (name === 'concours-theme-ajouter') result = await cmdConcoursThemeAjouter(options)
    else if (name === 'concours-theme-supprimer') result = await cmdConcoursThemeSupprimer(options)
    else if (name === 'concours-themes') result = await cmdConcoursThemes()
    else if (name === 'concours-gagnants') result = await cmdConcoursGagnants()
    else if (name === 'concours-participer') result = await cmdConcoursParticiper(body)
    return NextResponse.json(result)
  }

  if (body.type === 3) {
    return NextResponse.json(await handleContestComponent(body))
  }

  return NextResponse.json({ type: 1 })
}
