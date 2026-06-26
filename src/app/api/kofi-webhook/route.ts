import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Ko-fi envoie multipart/form-data ou application/x-www-form-urlencoded avec un champ "data" JSON
    let payload: any = null

    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      const formData = await req.formData().catch(() => null)
      if (formData) {
        const raw = formData.get('data')
        if (raw) payload = JSON.parse(raw as string)
      }
    }

    if (!payload) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

    // Vérifier le token Ko-fi
    const expectedToken = process.env.KOFI_WEBHOOK_TOKEN
    if (expectedToken && payload.verification_token !== expectedToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const email: string | undefined = payload.email
    if (!email) return NextResponse.json({ ok: true }) // don't fail — Ko-fi retries on error

    // Trouver l'utilisateur via la fonction SQL (SECURITY DEFINER → accès auth.users)
    const { data: userId } = await supabaseAdmin.rpc('match_donor_by_email', { p_email: email.toLowerCase() })

    if (!userId) {
      // Email inconnu — on log mais on répond 200 pour éviter les retries Ko-fi
      console.warn('[kofi-webhook] aucun user pour email:', email)
      return NextResponse.json({ ok: true })
    }

    await supabaseAdmin.from('profiles').update({ is_donor: true }).eq('id', userId)

    console.log('[kofi-webhook] donateur marqué:', userId, 'type:', payload.type, 'montant:', payload.amount)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[kofi-webhook] erreur:', err)
    return NextResponse.json({ ok: true }) // 200 pour éviter les retries Ko-fi
  }
}
