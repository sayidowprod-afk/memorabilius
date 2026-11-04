import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// Le planificateur de GitHub Actions lance les workflows hebdomadaires avec plusieurs heures de retard (voire pas du tout) :
// ce cron Vercel, lui, part à l'heure et demande à GitHub de lancer le workflow. Si un envoi a déjà réussi aujourd'hui
// (lancement manuel ou retardé), on ne fait rien : pas de doublon sur Discord.
// Variable Vercel requise : GH_DISPATCH_TOKEN (jeton GitHub « fine-grained », dépôt memorabilius, permission Actions : lecture et écriture).
const REPO = process.env.GITHUB_REPOSITORY || 'sayidowprod-afk/memorabilius'
const WORKFLOWS = new Set(['classement-hebdo.yml', 'carte-mystere.yml', 'vendredi-carte-semaine.yml'])

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const w = req.nextUrl.searchParams.get('w') || ''
  if (!WORKFLOWS.has(w)) return NextResponse.json({ error: 'workflow inconnu' }, { status: 400 })
  const token = process.env.GH_DISPATCH_TOKEN
  if (!token) return NextResponse.json({ launched: false, note: 'GH_DISPATCH_TOKEN manquant' })

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  const today = new Date().toISOString().slice(0, 10)
  const runs = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${w}/runs?status=success&created=>=${today}&per_page=1`, { headers, cache: 'no-store' })
  if (!runs.ok) return NextResponse.json({ launched: false, error: `lecture des lancements : ${runs.status}` }, { status: 502 })
  const { total_count } = await runs.json()
  if (total_count > 0) return NextResponse.json({ launched: false, note: 'déjà envoyé aujourd’hui' })

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${w}/dispatches`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main' }),
  })
  if (!res.ok) return NextResponse.json({ launched: false, error: `lancement : ${res.status}` }, { status: 502 })
  return NextResponse.json({ launched: true })
}
