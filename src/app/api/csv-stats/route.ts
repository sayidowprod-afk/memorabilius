import { NextRequest, NextResponse } from 'next/server'
import { fetchCsvCapped, parseCardStats } from '@/lib/csvParse'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })
  if (!url.startsWith('https://docs.google.com/spreadsheets/')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const text = await fetchCsvCapped(url, { next: { revalidate: 3600 } })
    if (!text) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    return NextResponse.json(parseCardStats(text))
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
