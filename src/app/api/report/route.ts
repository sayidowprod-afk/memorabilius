import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const reportSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  context: z.string().max(300).optional(),
  reason: z.enum(['spam', 'harcelement', 'contenu_inapproprie', 'autre']),
  message: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reportSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const { reportedUserId, context, reason, message } = parsed.data

  // Anti-spam : aucune limite avant (audit du 13/09) -- un signalement declenche
  // un insert + un email a chaque appel, sans throttling. Plafonne a 10/h par
  // utilisateur (evite le flood generique) et 1/24h par cible signalee (evite
  // le harcelement d'un meme utilisateur a coups de signalements repetes).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: hourlyCount } = await supabaseAdmin.from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('reporter_id', user.id).gte('created_at', hourAgo)
  if ((hourlyCount ?? 0) >= 10)
    return NextResponse.json({ error: 'Trop de signalements récents, réessaie plus tard' }, { status: 429 })

  if (reportedUserId) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dupCount } = await supabaseAdmin.from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id).eq('reported_user_id', reportedUserId).gte('created_at', dayAgo)
    if ((dupCount ?? 0) > 0)
      return NextResponse.json({ error: 'Tu as déjà signalé cet utilisateur récemment' }, { status: 429 })
  }

  const { error } = await supabaseAdmin.from('reports').insert({
    reporter_id: user.id, reported_user_id: reportedUserId || null, context: context || null, reason, message: message || null,
  })
  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Memorabilius <contact@memorabilius.fr>',
        to: 'contact@memorabilius.fr',
        subject: `[Signalement] ${reason}`,
        html: `
          <p><strong>Signalé par :</strong> ${escHtml(user.email || '')} (${escHtml(user.id)})</p>
          <p><strong>Utilisateur signalé :</strong> ${escHtml(reportedUserId || 'non spécifié')}</p>
          <p><strong>Contexte :</strong> ${escHtml(context || 'inconnu')}</p>
          <p><strong>Motif :</strong> ${escHtml(reason)}</p>
          ${message ? `<p><strong>Message :</strong></p><p>${escHtml(message).replace(/\n/g, '<br>')}</p>` : ''}
        `,
      })
    }
  } catch (e) {
    console.error('[report] email notify failed', e)
  }

  return NextResponse.json({ ok: true })
}
