import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Instantiated inside the handler to avoid build-time env var resolution
function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

function monthName(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function buildEmail(opts: {
  name: string
  month: string
  newCards: number
  rcCount: number
  autoCount: number
  patchCount: number
  numCount: number
  rank: number
  totalCollectors: number
  totalCards: number
  highlights: { player: string; year: string; brand: string; type: string }[]
  galerieUrl: string
}) {
  const { name, month, newCards, rcCount, autoCount, patchCount, numCount, rank, totalCollectors, totalCards, highlights, galerieUrl } = opts

  const medals = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
  const typeLabel = (t: string) => t === 'RC' ? '🌟 Rookie' : t === 'Auto' ? '✍️ Auto' : t === 'Patch' ? '🧩 Patch' : t === 'Num' ? '🔢 Numérotée' : t

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ton Wrap ${month} — Memorabilius</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f4f6fa; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #121212; }
  .wrap { max-width: 600px; margin: 30px auto; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,0.10); }
  .header { background: linear-gradient(135deg, #003DA6 0%, #0057D9 100%); padding: 40px 40px 32px; text-align: center; }
  .header-logo { color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .header-title { color: white; font-size: 32px; font-weight: 900; line-height: 1.1; }
  .header-sub { color: rgba(255,255,255,0.75); font-size: 16px; margin-top: 6px; }
  .body { padding: 36px 40px; }
  .greeting { font-size: 16px; line-height: 1.6; color: #444; margin-bottom: 28px; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card { background: #f7f9ff; border: 1.5px solid #e8edf8; border-radius: 14px; padding: 18px 14px; text-align: center; }
  .stat-value { font-size: 30px; font-weight: 900; color: #003DA6; line-height: 1; }
  .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #888; margin-top: 5px; letter-spacing: 0.5px; }
  .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 12px; }
  .rank-block { background: linear-gradient(135deg, #fff8e1, #fffde7); border: 1.5px solid #ffe082; border-radius: 14px; padding: 20px 24px; display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
  .rank-medal { font-size: 42px; line-height: 1; }
  .rank-text { font-size: 15px; color: #555; }
  .rank-text strong { color: #121212; font-size: 18px; }
  .highlights { border-radius: 14px; overflow: hidden; border: 1.5px solid #eee; margin-bottom: 28px; }
  .highlight-row { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #f5f5f5; }
  .highlight-row:last-child { border-bottom: none; }
  .hi-type { font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 5px; background: #003DA6; color: white; white-space: nowrap; }
  .hi-info { font-size: 13px; color: #333; }
  .hi-info strong { font-weight: 800; }
  .breakdown { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 28px; }
  .bd-item { display: flex; align-items: center; gap: 10px; background: #f9f9f9; border-radius: 10px; padding: 12px 16px; }
  .bd-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .bd-label { font-size: 12px; color: #888; font-weight: 700; flex: 1; }
  .bd-value { font-size: 15px; font-weight: 900; color: #121212; }
  .cta { text-align: center; margin-bottom: 28px; }
  .cta a { display: inline-block; background: #003DA6; color: white; font-size: 14px; font-weight: 800; padding: 15px 40px; border-radius: 50px; text-decoration: none; }
  .footer { text-align: center; padding: 24px 40px; border-top: 1px solid #f0f0f0; color: #bbb; font-size: 12px; }
  @media (max-width: 480px) {
    .body { padding: 24px 20px; }
    .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .stat-value { font-size: 22px; }
    .breakdown { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-logo">Memorabilius</div>
    <div class="header-title">Ton Wrap ${month}</div>
    <div class="header-sub">Voilà ce qui s'est passé dans ta collection</div>
  </div>
  <div class="body">
    <p class="greeting">Hey <strong>${name}</strong> 👋<br>
    ${newCards > 0
      ? `En ${month}, tu as ajouté <strong>${newCards} carte${newCards > 1 ? 's' : ''}</strong> à ta collection. Voici ton bilan complet.`
      : `Pas de nouvelles cartes en ${month}, mais ta collection continue de valoir le détour !`
    }</p>

    <div class="section-title">📦 Ce mois</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${newCards}</div>
        <div class="stat-label">Cartes ajoutées</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalCards}</div>
        <div class="stat-label">Total collection</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${medals}</div>
        <div class="stat-label">Classement</div>
      </div>
    </div>

    <div class="section-title">🏆 Classement communauté</div>
    <div class="rank-block">
      <div class="rank-medal">${rank <= 3 ? medals : '🎯'}</div>
      <div class="rank-text">
        <strong>${rank <= 3 ? medals + ' ' : '#' + rank + ' '}sur ${totalCollectors} collectionneurs</strong><br>
        ${rank === 1 ? 'Tu es en tête de la communauté !' : rank <= 5 ? 'Dans le top 5, excellent !' : rank <= 10 ? 'Dans le top 10, bien joué !' : 'Continue à collecter pour grimper !'}
      </div>
    </div>

    <div class="section-title">📊 Détail des ajouts</div>
    <div class="breakdown">
      <div class="bd-item"><div class="bd-dot" style="background:#e67e22"></div><div class="bd-label">Rookies</div><div class="bd-value">${rcCount}</div></div>
      <div class="bd-item"><div class="bd-dot" style="background:#2e7d32"></div><div class="bd-label">Autos</div><div class="bd-value">${autoCount}</div></div>
      <div class="bd-item"><div class="bd-dot" style="background:#1976d2"></div><div class="bd-label">Patch</div><div class="bd-value">${patchCount}</div></div>
      <div class="bd-item"><div class="bd-dot" style="background:#7b1fa2"></div><div class="bd-label">Numérotées</div><div class="bd-value">${numCount}</div></div>
    </div>

    ${highlights.length > 0 ? `
    <div class="section-title">✨ Tes highlights du mois</div>
    <div class="highlights">
      ${highlights.map(h => `
      <div class="highlight-row">
        <div class="hi-type">${typeLabel(h.type)}</div>
        <div class="hi-info"><strong>${h.player}</strong> · ${h.year} ${h.brand}</div>
      </div>`).join('')}
    </div>` : ''}

    <div class="cta">
      <a href="${galerieUrl}">Voir ma galerie →</a>
    </div>
  </div>
  <div class="footer">
    Mémorabilis · Tu reçois ce mail car tu as un compte actif.<br>
    Pour ne plus recevoir le wrap mensuel, modifie tes préférences dans ton profil.
  </div>
</div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Range: 1st of last month to 1st of this month
  const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLabel = monthName(monthStart)

  // Get all active users (with email via auth.users)
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (!authUsers) return NextResponse.json({ error: 'No users' }, { status: 500 })

  // Get all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, stats_total, stats_rc, stats_auto, stats_patch, stats_num, wrap_opt_out')

  if (!profiles) return NextResponse.json({ error: 'No profiles' }, { status: 500 })

  // Community rank (sorted by stats_total desc)
  const ranked = [...profiles].sort((a, b) => (b.stats_total || 0) - (a.stats_total || 0))
  const totalCollectors = ranked.length

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memorabilius.vercel.app'

  // ?test=true : envoie uniquement à l'email spécifié en ?email=
  const testEmail = req.nextUrl.searchParams.get('email')
  const testMode = req.nextUrl.searchParams.get('test') === 'true'

  let sent = 0
  const errors: string[] = []

  for (const authUser of authUsers.users) {
    if (!authUser.email) continue
    if (testMode && authUser.email !== testEmail) continue

    const profile = profiles.find(p => p.id === authUser.id)
    if (!profile) continue
    if (profile.wrap_opt_out) continue

    const name = profile.display_name || authUser.email.split('@')[0]
    const rank = ranked.findIndex(p => p.id === authUser.id) + 1

    // Cards added this month
    const { data: newCardsData } = await supabase
      .from('cartes_manuelles')
      .select('player_name, year, brand, is_rc, is_auto, is_patch, is_numbered')
      .eq('user_id', authUser.id)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString())

    const newCards = newCardsData?.length || 0
    const rcCount = newCardsData?.filter(c => c.is_rc).length || 0
    const autoCount = newCardsData?.filter(c => c.is_auto).length || 0
    const patchCount = newCardsData?.filter(c => c.is_patch).length || 0
    const numCount = newCardsData?.filter(c => c.is_numbered).length || 0

    // Highlights: RC first, then auto, then patch, then num (max 5)
    const highlights = [
      ...(newCardsData?.filter(c => c.is_rc).slice(0, 2).map(c => ({ player: c.player_name, year: c.year, brand: c.brand, type: 'RC' })) || []),
      ...(newCardsData?.filter(c => c.is_auto && !c.is_rc).slice(0, 2).map(c => ({ player: c.player_name, year: c.year, brand: c.brand, type: 'Auto' })) || []),
      ...(newCardsData?.filter(c => c.is_patch && !c.is_rc && !c.is_auto).slice(0, 1).map(c => ({ player: c.player_name, year: c.year, brand: c.brand, type: 'Patch' })) || []),
    ].slice(0, 5)

    const html = buildEmail({
      name,
      month: monthLabel,
      newCards,
      rcCount,
      autoCount,
      patchCount,
      numCount,
      rank,
      totalCollectors,
      totalCards: profile.stats_total || 0,
      highlights,
      galerieUrl: `${baseUrl}/galerie/${authUser.id}`,
    })

    try {
      await getResend().emails.send({
        from: 'Memorabilius <contact@memorabilius.fr>',
        to: authUser.email,
        subject: `Ton Wrap ${monthLabel} 🏀 — Memorabilius`,
        html,
      })
      sent++
    } catch (e: any) {
      errors.push(`${authUser.email}: ${e.message}`)
    }

    // Avoid rate limiting
    await new Promise(r => setTimeout(r, 100))
  }

  return NextResponse.json({ sent, errors, month: monthLabel })
}
