import { createServerClient, type CookieOptions } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

const FRANCOPHONE = new Set([
  'FR','BE','CH','LU','MC','SN','CI','ML','BF','NE','TD','TG','BJ','GN','RW',
  'MG','CM','DZ','MA','TN','MR','DJ','CD','CG','GA','HT','MU','SC','KM','CF',
  'BI','VU','GQ','GP','MQ','GF','RE','YT','NC','PF','WF','PM','MF',
])
const GERMAN = new Set(['DE','AT','LI'])

function countryToLang(req: NextRequest): string {
  const c = req.headers.get('x-vercel-ip-country') || ''
  if (FRANCOPHONE.has(c)) return 'fr'
  if (GERMAN.has(c)) return 'de'
  if (c) return 'en'
  return 'fr'
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh la session à chaque requête pour éviter l'expiration silencieuse
  await supabase.auth.getSession()

  // Geo-lang : cookie lu côté client par LangProvider (non httpOnly)
  response.cookies.set('geo-lang', countryToLang(request), {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
