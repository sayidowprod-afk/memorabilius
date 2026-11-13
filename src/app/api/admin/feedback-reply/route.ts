import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { sendPushToUser } from '@/lib/pushNotify'

const admin = createServerServiceClient()

// POST { feedbackId, reply } : réponse en un clic à un retour de membre. Le membre reçoit une notification (cloche + téléphone).
// Garde-fou : une seule réponse par retour (le lien de la notification porte l'identifiant du retour).
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const feedbackId = String(body?.feedbackId || '')
  const reply = String(body?.reply || '').trim().slice(0, 200)
  if (!/^[0-9a-f-]{36}$/i.test(feedbackId) || reply.length < 2) return NextResponse.json({ error: 'Réponse invalide' }, { status: 400 })

  const { data: fb } = await admin.from('user_feedback').select('id, user_id, message, page_url').eq('id', feedbackId).maybeSingle()
  if (!fb) return NextResponse.json({ error: 'Retour introuvable' }, { status: 404 })
  if (!fb.user_id) return NextResponse.json({ error: 'Retour anonyme : personne à prévenir.' }, { status: 400 })

  const tag = '#retour-' + feedbackId
  const { data: already } = await admin.from('notifications').select('id').eq('user_id', fb.user_id).eq('type', 'feedback_reply').like('lien', '%' + tag).limit(1)
  if (already?.length) return NextResponse.json({ error: 'Tu as déjà répondu à ce retour.' }, { status: 409 })

  // un extrait du retour, sans la mention technique « [Demande de setlist] » etc.
  const excerpt = String(fb.message || '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 70)
  const message = 'À propos de ton retour « ' + excerpt + (String(fb.message || '').length > 70 ? '…' : '') + ' » : ' + reply
  let path = '/'
  try { if (fb.page_url && String(fb.page_url).startsWith('/')) path = String(fb.page_url).split('#')[0] } catch { /* page inconnue : accueil */ }
  const lien = path + tag
  const { error } = await admin.from('notifications').insert({ user_id: fb.user_id, type: 'feedback_reply', message, lien, lu: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.allSettled([sendPushToUser(fb.user_id, { title: 'Réponse à ton retour', body: reply, url: lien, channelId: 'community' })])
  return NextResponse.json({ ok: true, message })
}
