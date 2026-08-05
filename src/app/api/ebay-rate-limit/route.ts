import { NextResponse } from 'next/server'

export const maxDuration = 15

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

export async function GET() {
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
