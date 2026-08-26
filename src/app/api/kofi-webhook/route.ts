import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

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

    // Vérifier le token Ko-fi (fail closed : sans token configuré, on refuse tout —
    // sinon n'importe qui peut POST un faux don et se marquer comme donateur)
    const expectedToken = process.env.KOFI_WEBHOOK_TOKEN
    if (!expectedToken || typeof payload.verification_token !== 'string' || !safeEqual(payload.verification_token, expectedToken)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const email: string | undefined = payload.email
    if (!email) return NextResponse.json({ ok: true }) // don't fail — Ko-fi retries on error

    // Ne marquer "donateur" que pour un vrai don/abonnement avec un montant positif —
    // sinon un test webhook (montant 0) ou une commande boutique marquait n'importe
    // quel compte comme donateur à vie, sans jamais pouvoir être révoqué.
    const eventType: string | undefined = payload.type
    const amount = parseFloat(payload.amount ?? '0')
    const isRealContribution = (eventType === 'Donation' || eventType === 'Subscription') && amount > 0
    if (!isRealContribution) {
      return NextResponse.json({ ok: true })
    }

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
