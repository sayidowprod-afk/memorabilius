import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

const LOGO_B64 = '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'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildEmail(name: string): string {
  const safeName = esc(name)
  const greeting = safeName ? ` ${safeName}` : ''
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ta collection t'attend sur Memorabilius</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,Helvetica Neue,Arial,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#003DA6;padding:28px 40px;text-align:center;">
      <img src="data:image/png;base64,${LOGO_B64}" alt="Memorabilius" style="height:40px;display:inline-block;">
    </div>
    <div style="padding:36px 40px 32px;">
      <p style="font-size:15px;color:#202124;margin:0 0 18px;">Salut${greeting},</p>
      <p style="font-size:15px;color:#3c3c3c;line-height:1.7;margin:0 0 18px;">
        Tu t'es inscrit sur Memorabilius mais tu n'as pas encore ajouté de cartes.
      </p>
      <p style="font-size:15px;color:#3c3c3c;line-height:1.7;margin:0 0 18px;">
        C'est plus simple que tu ne le penses&nbsp;: prends une photo de n'importe quelle carte,
        <strong style="color:#202124;">l'IA l'identifie automatiquement</strong> et l'ajoute à ta galerie en quelques secondes.
      </p>
      <p style="font-size:15px;color:#3c3c3c;line-height:1.7;margin:0 0 28px;">
        Ta galerie est publique et partageable dès le départ&nbsp;— envoie le lien à n'importe qui
        pour montrer ta collection, trouver des trades ou comparer des setlists.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://www.memorabilius.fr/scanner"
           style="display:inline-block;background:#003DA6;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:6px;">
          &#8594; Scanner ma première carte
        </a>
      </div>
      <div style="margin-top:28px;padding-top:24px;border-top:1px solid #e8e8e8;">
        <p style="font-size:14px;color:#5f6368;margin:0 0 4px;">À bientôt,</p>
        <p style="font-size:14px;font-weight:600;color:#003DA6;margin:0;">L'équipe Memorabilius</p>
      </div>
    </div>
    <div style="background:#f8f8f8;padding:16px 40px;border-top:1px solid #e8e8e8;text-align:center;">
      <p style="font-size:11px;color:#9aa0a6;margin:0;">
        Tu reçois cet e-mail car tu as un compte Memorabilius.&nbsp;
        <a href="https://www.memorabilius.fr" style="color:#9aa0a6;">memorabilius.fr</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Récupère directement les users sans cartes via RPC SQL
    const { data: targets, error: rpcErr } = await admin.rpc('get_users_without_cards')
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

    if (targets.length === 0) {
      return NextResponse.json({ sent: 0, total: 0, message: 'Aucun utilisateur sans carte.' })
    }

    const resend = getResend()
    let sent = 0
    const errors: string[] = []

    for (const u of targets) {
      const name = (u.display_name || '') as string
      try {
        await resend.emails.send({
          from: 'Memorabilius <contact@memorabilius.fr>',
          to: u.email!,
          subject: "📦 Ta collection t'attend sur Memorabilius",
          html: buildEmail(name),
        })
        sent++
      } catch {
        errors.push(u.email!)
      }
    }

    return NextResponse.json({ sent, total: targets.length, errors })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
