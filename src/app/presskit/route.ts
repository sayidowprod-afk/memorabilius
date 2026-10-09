import { NextRequest, NextResponse } from 'next/server'

// memorabilius.fr/presskit -> le dossier de presse (PDF public, libre d'acces).
export function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/presskit/Memorabilius-Presskit.pdf', req.url), 307)
}
