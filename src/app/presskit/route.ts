import { NextRequest, NextResponse } from 'next/server'

// memorabilius.fr/presskit -> le dossier de presse PDF, genere a la demande (chiffres du jour, langue du visiteur).
export function GET(req: NextRequest) {
  const lang = new URL(req.url).searchParams.get('lang')
  return NextResponse.redirect(new URL('/api/presskit' + (lang ? `?lang=${encodeURIComponent(lang)}` : ''), req.url), 307)
}
