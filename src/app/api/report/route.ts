import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
          <p><strong>Signalé par :</strong> ${user.email} (${user.id})</p>
          <p><strong>Utilisateur signalé :</strong> ${reportedUserId || 'non spécifié'}</p>
          <p><strong>Contexte :</strong> ${context || 'inconnu'}</p>
          <p><strong>Motif :</strong> ${reason}</p>
          ${message ? `<p><strong>Message :</strong></p><p>${message.replace(/\n/g, '<br>')}</p>` : ''}
        `,
      })
    }
  } catch (e) {
    console.error('[report] email notify failed', e)
  }

  return NextResponse.json({ ok: true })
}
