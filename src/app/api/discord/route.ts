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

async function cmdCarte(options: any[]) {
  const nom = options.find((o: any) => o.name === 'nom')?.value || ''
  const utilisateur = options.find((o: any) => o.name === 'utilisateur')?.value || ''
  if (!nom) return reply({ content: "❌ Précise le nom d'une carte.", flags: 64 })

  let query = supabase
    .from('cartes_manuelles')
    .select('nom, image_recto, equipe, annee, marque, variation, rc, auto, num, patch, user_id, profiles(id, display_name)')
    .ilike('nom', `%${nom}%`)
    .not('image_recto', 'is', null)

  if (utilisateur) {
    // Résoudre l'utilisateur par display_name d'abord
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .ilike('display_name', `%${utilisateur}%`)
      .limit(1)
    if (prof?.[0]) query = query.eq('user_id', prof[0].id)
  }

  const { data } = await query.limit(1)
  const c = data?.[0] as any
  if (!c) return reply({ content: `❌ Aucune carte trouvée pour \`${nom}\`${utilisateur ? ` chez \`${utilisateur}\`` : ''}.`, flags: 64 })

  const profile = c.profiles
  const badges: string[] = []
  if (c.rc)    badges.push('🌟 RC')
  if (c.auto)  badges.push('✍️ Auto')
  if (c.patch) badges.push('🪡 Patch')
  if (c.num)   badges.push(`🔢 ${c.num}`)

  const desc = [c.variation, c.annee, c.marque, c.equipe].filter(Boolean).join(' · ')

  return reply({
    embeds: [{
      title: c.nom,
      description: desc || undefined,
      color: 0x003DA6,
      image: { url: c.image_recto },
      fields: badges.length ? [{ name: 'Badges', value: badges.join('  '), inline: false }] : [],
      author: profile ? {
        name: profile.display_name,
        url: `https://memorabilius.fr/galerie/${profile.id}`,
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
