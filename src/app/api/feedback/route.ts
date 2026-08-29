import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { z } from 'zod'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const feedbackSchema = z.object({
  type: z.enum(['bug', 'suggestion']),
  message: z.string().min(3).max(2000),
  pageUrl: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = feedbackSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  const { type, message, pageUrl } = parsed.data

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let userId: string | null = null
  let email: string | null = null
  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (user) { userId = user.id; email = user.email || null }
  }

  const userAgent = req.headers.get('user-agent') || null

  const { error } = await supabaseAdmin.from('user_feedback').insert({
    user_id: userId, email, type, message, page_url: pageUrl || null, user_agent: userAgent,
  })
  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  // Best-effort : une notif email manquee ne doit jamais faire echouer
  // l'envoi du feedback lui-meme (deja enregistre en base ci-dessus).
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: 'Memorabilius <contact@memorabilius.fr>',
        to: 'contact@memorabilius.fr',
        subject: `[${type === 'bug' ? 'Bug' : 'Suggestion'}] Nouveau feedback Memorabilius`,
        html: `
          <p><strong>Type :</strong> ${type}</p>
          <p><strong>Utilisateur :</strong> ${email || 'anonyme'} ${userId ? `(${userId})` : ''}</p>
          <p><strong>Page :</strong> ${pageUrl || 'inconnue'}</p>
          <p><strong>Message :</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        `,
      })
    }
  } catch (e) {
    console.error('[feedback] email notify failed', e)
  }

  return NextResponse.json({ ok: true })
}
