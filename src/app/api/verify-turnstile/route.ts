import { NextRequest, NextResponse } from 'next/server'

// Verifie un token Cloudflare Turnstile cote serveur (le secret ne doit
// jamais etre expose au client). Appele juste avant supabase.auth.signUp()
// sur /sinscrire pour bloquer les bots avant la creation du compte.
export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') return NextResponse.json({ success: false }, { status: 400 })

  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Cle pas encore configuree -- ne bloque pas l'inscription pour un
    // probleme de config serveur, mais log pour investigation.
    console.error('[verify-turnstile] TURNSTILE_SECRET_KEY manquante')
    return NextResponse.json({ success: true })
  }

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await r.json()
    return NextResponse.json({ success: !!data.success })
  } catch {
    return NextResponse.json({ success: false }, { status: 503 })
  }
}
