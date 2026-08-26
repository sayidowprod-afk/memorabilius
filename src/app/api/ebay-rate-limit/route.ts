import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 15

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getToken(appId: string, certId: string): Promise<string | null> {
  try {
    const creds = Buffer.from(`${appId}:${certId}`).toString('base64')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
      cache: 'no-store',
    })
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

// Route de diagnostic (quota eBay), jamais appelée par le client — mais
// restait totalement ouverte sans authentification : n'importe qui pouvait
// la boucler pour consommer le quota eBay partagé et lire les chiffres
// d'usage de l'app. Reservé aux admins, même pattern que translate-guide.
export async function GET(req: NextRequest) {
  const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(authToken)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const appId  = process.env.EBAY_APP_ID
  const certId = process.env.EBAY_CERT_ID
  if (!appId || !certId) return NextResponse.json({ error: 'missing credentials' }, { status: 500 })

  const token = await getToken(appId, certId)
  if (!token) return NextResponse.json({ error: 'oauth failed' }, { status: 502 })

  const res = await fetch('https://api.ebay.com/developer/analytics/v1_beta/rate_limit', {
    headers: { 'Authorization': `Bearer ${token}` },
    cache: 'no-store',
  })

  const body = await res.text()
  if (!res.ok) return NextResponse.json({ error: `eBay ${res.status}`, raw: body }, { status: res.status })

  const data = JSON.parse(body)

  // Flatten pour lisibilité : un tableau de { resource, quota, used, remaining, reset }
  const rows: object[] = []
  for (const api of data.rateLimits || []) {
    for (const res of api.resources || []) {
      for (const rate of res.rates || []) {
        rows.push({
          api: api.apiName,
          resource: res.name,
          limit: rate.limit,
          used: rate.remaining !== undefined ? rate.limit - rate.remaining : undefined,
          remaining: rate.remaining,
          reset: rate.reset,
          timeUnit: rate.timeUnit,
        })
      }
    }
  }

  return NextResponse.json({ rows, raw: data })
}
