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
  if (!sig || !ts || !process.env.DISCORD_PUBLIC_KEY) {
    console.error('[discord] missing sig/ts/key', { sig: !!sig, ts: !!ts, key: !!process.env.DISCORD_PUBLIC_KEY })
    return false
  }
  try {
    // La clé Discord est un hex de 32 bytes bruts. Node.js createPublicKey
    // attend du SPKI/DER : on préfixe avec le header ASN.1 Ed25519 (12 bytes).
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const rawKey = Buffer.from(process.env.DISCORD_PUBLIC_KEY, 'hex')
    const spki = Buffer.concat([spkiPrefix, rawKey])
    const keyObject = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    const result = cryptoVerify(null, Buffer.from(ts + body), keyObject, Buffer.from(sig, 'hex'))
    if (!result) console.error('[discord] signature invalide')
    return result
  } catch (e) {
    console.error('[discord] erreur vérification', e)
    return false
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasKey: !!process.env.DISCORD_PUBLIC_KEY,
    keyLength: process.env.DISCORD_PUBLIC_KEY?.length ?? 0,
  })
}

function med(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function reply(data: object) {
  return { type: 4, data }
}

async function cmdCollection(options: any[]) {
  const username = options.find((o: any) => o.name === 'utilisateur')?.value || ''
  if (!username) return reply({ content: '❌ Précise un nom d\'utilisateur.', flags: 64 })

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
        { name: '📦 Total',       value: `**${(p.stats_total || 0).toLocaleString('fr-FR')}** cartes`, inline: true },
        { name: '🌟 RC',          value: `**${p.stats_rc || 0}**`, inline: true },
        { name: '✍️ Auto',        value: `**${p.stats_auto || 0}**`, inline: true },
        { name: '🔢 Numérotées',  value: `**${p.stats_num || 0}**`, inline: true },
        { name: '🪡 Patch',       value: `**${p.stats_patch || 0}**`, inline: true },
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

async function cmdPrix(options: any[]) {
  const carte = options.find((o: any) => o.name === 'carte')?.value || ''
  if (!carte) return reply({ content: '❌ Précise le nom d\'une carte.', flags: 64 })

  const appId = process.env.EBAY_APP_ID
  if (!appId) return reply({ content: '❌ Configuration eBay manquante.', flags: 64 })

  try {
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'GLOBAL-ID': 'EBAY-US',
      'keywords': carte,
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'paginationInput.entriesPerPage': '20',
      'sortOrder': 'EndTimeSoonest',
    })
    const res = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const json = await res.json()
    const items: any[] = json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []

    const prices = items
      .map((i: any) => parseFloat(i.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || '0'))
      .filter(p => p > 0)

    if (!prices.length) return reply({ content: `❌ Aucune vente trouvée sur eBay pour \`${carte}\`.`, flags: 64 })

    // Outlier filter (même logique que ebay-sold)
    const sorted = [...prices].sort((a, b) => a - b)
    const m = Math.floor(sorted.length / 2)
    const median = sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
    const filtered = prices.filter(p => p >= median * 0.15 && p <= median * 5)

    const finalMed = med(filtered)
    const min = Math.min(...filtered)
    const max = Math.max(...filtered)
    const lastThree = items
      .slice(0, 3)
      .map((i: any) => `• ${i.title?.[0]?.slice(0, 50) || ''}… — **$${parseFloat(i.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__ || '0').toFixed(2)}**`)
      .join('\n')

    return reply({
      embeds: [{
        title: `💰 Prix eBay — ${carte}`,
        color: 0x27ae60,
        fields: [
          { name: '📊 Médiane', value: `**$${finalMed.toFixed(2)}**`, inline: true },
          { name: '⬇️ Min',     value: `$${min.toFixed(2)}`,          inline: true },
          { name: '⬆️ Max',     value: `$${max.toFixed(2)}`,          inline: true },
          { name: '🕐 Dernières ventes', value: lastThree || '—', inline: false },
        ],
        footer: { text: `${filtered.length} ventes analysées · USD · memorabilius.fr` },
      }],
    })
  } catch {
    return reply({ content: '❌ Erreur lors de la recherche eBay.', flags: 64 })
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!verifyDiscord(req, rawBody)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = JSON.parse(rawBody)

  // PING — validation initiale de l'endpoint par Discord
  if (body.type === 1) return NextResponse.json({ type: 1 })

  // Slash commands
  if (body.type === 2) {
    const name = body.data?.name
    const options = body.data?.options || []
    let result: object = { type: 1 }
    if (name === 'collection') result = await cmdCollection(options)
    else if (name === 'top')   result = await cmdTop()
    else if (name === 'prix')  result = await cmdPrix(options)
    return NextResponse.json(result)
  }

  return NextResponse.json({ type: 1 })
}
