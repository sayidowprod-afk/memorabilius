import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { rateLimited } from '@/lib/publicRateLimit'
import { discordFetch } from '@/lib/discordContest'
import { RARITY_COLOR, RARITY_NAME, type Rarity } from '@/lib/packs'

export const maxDuration = 20
const admin = createServerServiceClient()

// POST { entryId } : partage sur Discord une belle carte (épique ou légendaire) tirée dans un pack.
// Garde-fous : il faut avoir réellement tiré cette carte, elle ne se partage qu'une fois, et le message ne mentionne personne.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (rateLimited(req, 'packs-share', 10, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const channel = process.env.DISCORD_PACKS_CHANNEL_ID
  if (!channel || !process.env.DISCORD_BOT_TOKEN) return NextResponse.json({ error: 'Le partage Discord n’est pas encore configuré.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const entryId = Number(body?.entryId)
  if (!Number.isFinite(entryId)) return NextResponse.json({ error: 'Carte inconnue' }, { status: 400 })

  const [{ data: mine }, { data: card }, { data: prof }] = await Promise.all([
    admin.from('user_pack_cards').select('entry_id, shared_at').eq('user_id', user.id).eq('entry_id', entryId).maybeSingle(),
    admin.from('pack_pool').select('player_name, team, card_number, variation, is_rc, is_auto, is_patch, print_run, image_url, set_name, set_year, rarity').eq('entry_id', entryId).maybeSingle(),
    admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
  ])
  if (!mine || !card) return NextResponse.json({ error: 'Tu n’as pas tiré cette carte.' }, { status: 403 })
  const rarity = card.rarity as Rarity
  if (rarity < 4) return NextResponse.json({ error: 'Seules les cartes épiques et légendaires se partagent.' }, { status: 400 })
  if (mine.shared_at) return NextResponse.json({ error: 'Cette carte est déjà partagée.' }, { status: 409 })

  // on réserve le partage d'abord (impossible de poster deux fois, même avec deux clics rapprochés)
  const { data: claimed } = await admin.from('user_pack_cards').update({ shared_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('entry_id', entryId).is('shared_at', null).select('entry_id')
  if (!claimed?.length) return NextResponse.json({ error: 'Cette carte est déjà partagée.' }, { status: 409 })

  const pseudo = (prof?.display_name as string | null) || 'Un collectionneur'
  const tags = [card.is_rc ? 'RC' : '', card.is_auto ? 'Signée' : '', card.is_patch ? 'Patch' : '', card.print_run ? `/${card.print_run}` : '', card.variation || ''].filter(Boolean).join(' · ')
  const emoji = rarity === 5 ? '🌟' : '💜'
  try {
    await discordFetch(`/channels/${channel}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          title: `${emoji} ${pseudo} a tiré une carte ${RARITY_NAME[rarity]} !`,
          description: [`**${card.player_name}**${card.team ? ` · ${card.team}` : ''}`, [card.set_year, card.set_name].filter(Boolean).join(' '), tags].filter(Boolean).join('\n'),
          color: parseInt(RARITY_COLOR[rarity].slice(1), 16),
          image: { url: card.image_url },
          url: 'https://www.memorabilius.fr/?pack=1',
          footer: { text: 'Un pack gratuit toutes les heures sur memorabilius.fr' },
        }],
      }),
    })
  } catch (e) {
    // l'envoi a échoué : on libère le partage pour pouvoir réessayer
    await admin.from('user_pack_cards').update({ shared_at: null }).eq('user_id', user.id).eq('entry_id', entryId)
    return NextResponse.json({ error: 'Discord n’a pas répondu. Réessaie dans un instant.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
