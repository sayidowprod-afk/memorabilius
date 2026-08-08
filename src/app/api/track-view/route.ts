import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Pages internes à ne pas tracker
const SKIP = /^\/(admin|api|_next|favicon)/

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json() as { path?: string }
    if (!path || SKIP.test(path)) return NextResponse.json({ ok: true })

    const country = (req.headers.get('x-vercel-ip-country') || 'XX').slice(0, 2).toUpperCase()

    await admin.from('page_views').insert({ path: path.slice(0, 255), country })
  } catch {
    // fire-and-forget : jamais d'erreur côté client
  }
  return NextResponse.json({ ok: true })
}
