import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { sendPushToUser, isChannelAllowed } from '@/lib/pushNotify'
import { normalizePushLang, type PushLang } from '@/lib/pushTranslations'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 60

const supabase = createServerServiceClient()

type Added = { id: string; name: string; count: number }

// Une fois par jour : prévient chaque membre des cartes ajoutées (24 h) par les personnes qu'il suit.
// UNE notification par suiveur (regroupée), jamais une par carte. Ne touche qu'à des tables, pas d'API externe.
function wording(lang: PushLang, list: Added[]) {
  const total = list.reduce((a, x) => a + x.count, 0)
  const first = list[0].name
  const others = list.length - 1
  const who = others === 0 ? first
    : { fr: `${first} et ${others} autre${others > 1 ? 's' : ''}`, en: `${first} and ${others} other${others > 1 ? 's' : ''}`, de: `${first} und ${others} weitere` }[lang]
  const verb = others === 0
    ? { fr: 'a ajouté', en: 'added', de: 'hat' }[lang]
    : { fr: 'ont ajouté', en: 'added', de: 'haben' }[lang]
  const cards = { fr: `${total} carte${total > 1 ? 's' : ''}`, en: `${total} card${total > 1 ? 's' : ''}`, de: `${total} Karte${total > 1 ? 'n' : ''}` }[lang]
  const body = lang === 'de' ? `${who} ${verb} ${cards} hinzugefügt` : `${who} ${verb} ${cards}`
  const title = { fr: '🃏 Du nouveau chez ceux que tu suis', en: '🃏 New cards from people you follow', de: '🃏 Neues von deinen Abos' }[lang]
  return { title, body }
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: cards } = await supabase.from('cartes_manuelles').select('user_id').gte('created_at', since).limit(20000)
  const countBy = new Map<string, number>()
  for (const c of cards ?? []) if (c.user_id) countBy.set(c.user_id, (countBy.get(c.user_id) ?? 0) + 1)
  if (!countBy.size) return NextResponse.json({ sent: 0 })

  const authors = [...countBy.keys()]
  const { data: follows } = await supabase.from('follows').select('follower_id, followed_id').in('followed_id', authors).limit(50000)
  if (!follows?.length) return NextResponse.json({ sent: 0 })

  const followers = [...new Set(follows.map(f => f.follower_id))]
  const [{ data: authorProfiles }, { data: followerProfiles }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').in('id', authors),
    supabase.from('profiles').select('id, preferred_lang, notif_followed_cards').in('id', followers),
  ])
  const nameOf = new Map((authorProfiles ?? []).map(p => [p.id, p.display_name || '?']))
  const profOf = new Map((followerProfiles ?? []).map(p => [p.id, p]))

  const byFollower = new Map<string, Added[]>()
  for (const f of follows) {
    if (f.follower_id === f.followed_id) continue
    const arr = byFollower.get(f.follower_id) ?? []
    arr.push({ id: f.followed_id, name: nameOf.get(f.followed_id) || '?', count: countBy.get(f.followed_id) ?? 0 })
    byFollower.set(f.follower_id, arr)
  }

  let sent = 0
  const errors: string[] = []
  const entries = [...byFollower.entries()]
  const BATCH = 20
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ([uid, list]) => {
      try {
        const p = profOf.get(uid)
        if (!p || p.notif_followed_cards === false) return
        list.sort((a, b) => b.count - a.count)
        const { title, body } = wording(normalizePushLang(p.preferred_lang), list)
        const lien = `/galerie/${list[0].id}`
        if (await isChannelAllowed(uid, 'community')) {
          await supabase.from('notifications').insert({ user_id: uid, type: 'followed_cards', message: body, lien, lu: false })
        }
        await sendPushToUser(uid, { title, body, url: lien, channelId: 'community' })
        sent++
      } catch (e) {
        errors.push(`${uid}: ${(e as Error).message}`)
      }
    }))
  }
  return NextResponse.json({ sent, errors })
}
