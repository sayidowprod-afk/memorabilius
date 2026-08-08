import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SKIP = /^\/(admin|api|_next|favicon)/

export async function POST(req: NextRequest) {
  try {
    const { path, token } = await req.json() as { path?: string; token?: string }
    const country = (req.headers.get('x-vercel-ip-country') || 'XX').slice(0, 2).toUpperCase()

    if (path && !SKIP.test(path)) {
      await admin.from('page_views').insert({ path: path.slice(0, 255), country })
    }

    if (token && country !== 'XX') {
      const { data: { user } } = await admin.auth.getUser(token)
      if (user?.id) {
        await admin.from('user_countries').upsert(
          { user_id: user.id, country, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      }
    }
  } catch {}
  return NextResponse.json({ ok: true })
}
