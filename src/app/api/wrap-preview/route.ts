import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { signWrapUrl } from '@/lib/wrapSign'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getResend() { return new Resend(process.env.RESEND_API_KEY!) }

function monthName(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// Même template que le cron — importé inline pour éviter une dépendance circulaire
function buildEmail(opts: {
  name: string; month: string; newCards: number; rcCount: number; autoCount: number
  patchCount: number; numCount: number; rank: number; totalCollectors: number
  totalCards: number; highlights: { player: string; year: string; brand: string; type: string }[]
  galerieUrl: string; cardImages: string[]; squareUrl: string; storyUrl: string
}) {
  const { name, month, newCards, rcCount, autoCount, patchCount, numCount, rank, totalCollectors, totalCards, highlights, galerieUrl, cardImages, squareUrl, storyUrl } = opts
  const medals = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`
  const typeLabel = (t: string) => t === 'RC' ? '🌟 Rookie' : t === 'Auto' ? '✍️ Auto' : t === 'Patch' ? '🧩 Patch' : t

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
  .cards-grid { margin-bottom: 28px; }
  .cards-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .card-thumb { flex: 1; border-radius: 8px; overflow: hidden; background: #0d1a30; }
  .card-thumb img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: contain; display: block; }
  .dl-section { background: #f0f4ff; border: 1.5px solid #c7d6f5; border-radius: 14px; padding: 20px 24px; margin-bottom: 28px; text-align: center; }
  .dl-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #003DA6; letter-spacing: 1px; margin-bottom: 14px; }
  .dl-buttons { display: flex; gap: 10px; justify-content: center; }
  .dl-btn { display: inline-block; background: #003DA6; color: white; font-size: 13px; font-weight: 800; padding: 11px 22px; border-radius: 50px; text-decoration: none; }
  .dl-btn.secondary { background: white; color: #003DA6; border: 2px solid #003DA6; }
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
  .test-banner { background: #fff3cd; border-bottom: 2px solid #ffc107; padding: 10px 20px; text-align: center; font-size: 13px; font-weight: 700; color: #856404; }
</style>
</head>
<body>
<div class="wrap">
  <div class="test-banner">⚠️ EMAIL DE TEST — envoyé manuellement depuis le profil</div>
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
    ${cardImages.length > 0 ? (() => {
      const cols = cardImages.length <= 4 ? 2 : cardImages.length <= 9 ? 3 : 4
      const rows: string[][] = []
      for (let i = 0; i < cardImages.length; i += cols) rows.push(cardImages.slice(i, i + cols))
      return `<div class="section-title">🃏 Tes cartes du mois (${cardImages.length})</div>
    <div class="cards-grid">
      ${rows.map(row => `<div class="cards-row">${row.map(src => `<div class="card-thumb"><img src="${src}" /></div>`).join('')}</div>`).join('')}
    </div>`
    })() : ''}

    <div class="section-title">📦 Ce mois</div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${newCards}</div><div class="stat-label">Cartes ajoutées</div></div>
      <div class="stat-card"><div class="stat-value">${totalCards}</div><div class="stat-label">Total collection</div></div>
      <div class="stat-card"><div class="stat-value">${medals}</div><div class="stat-label">Classement</div></div>
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
    <div class="dl-section">
      <div class="dl-title">📸 Télécharger ton Wrap</div>
      <div class="dl-buttons">
        <a href="${squareUrl}" class="dl-btn">⬜ Carré 1080×1080</a>
        <a href="${storyUrl}" class="dl-btn secondary">📱 Story 1080×1920</a>
      </div>
    </div>
    <div class="cta"><a href="${galerieUrl}">Voir ma galerie →</a></div>
  </div>
  <div class="footer">Memorabilius · Email de test — non envoyé automatiquement.</div>
</div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

  // Période configurable : ?period=current (mois en cours) ou par défaut mois précédent
  const period = new URL(req.url).searchParams.get('period') || 'last'
  const now = new Date()
  const monthStart = period === 'current'
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthEnd = period === 'current'
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const monthLabel = monthName(monthStart)

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, stats_total')
    .eq('id', user.id)
    .single()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, stats_total')

  const ranked = [...(profiles || [])].sort((a, b) => (b.stats_total || 0) - (a.stats_total || 0))
  const rank = ranked.findIndex(p => p.id === user.id) + 1
  const totalCollectors = ranked.length

  const { data: newCardsData } = await supabase
    .from('cartes_manuelles')
    .select('nom, annee, marque, rc, auto, patch, num, image_recto')
    .eq('user_id', user.id)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString())

  const newCards = newCardsData?.length || 0
  const rcCount = newCardsData?.filter(c => c.rc).length || 0
  const autoCount = newCardsData?.filter(c => c.auto).length || 0
  const patchCount = newCardsData?.filter(c => c.patch).length || 0
  const numCount = newCardsData?.filter(c => c.num).length || 0

  const highlights = [
    ...(newCardsData?.filter(c => c.rc).slice(0, 2).map(c => ({ player: c.nom, year: c.annee, brand: c.marque, type: 'RC' })) || []),
    ...(newCardsData?.filter(c => c.auto && !c.rc).slice(0, 2).map(c => ({ player: c.nom, year: c.annee, brand: c.marque, type: 'Auto' })) || []),
    ...(newCardsData?.filter(c => c.patch && !c.rc && !c.auto).slice(0, 1).map(c => ({ player: c.nom, year: c.annee, brand: c.marque, type: 'Patch' })) || []),
  ].slice(0, 5)

  // Cartes avec image, triées RC > Auto > Patch > autres
  const withImg = (newCardsData || []).filter(c => c.image_recto)
  const cardImages = [
    ...withImg.filter(c => c.rc),
    ...withImg.filter(c => c.auto && !c.rc),
    ...withImg.filter(c => c.patch && !c.rc && !c.auto),
    ...withImg.filter(c => !c.rc && !c.auto && !c.patch),
  ].map(c => c.image_recto as string)

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.memorabilius.fr'
  const wrapYear = monthStart.getFullYear()
  const wrapMonth = monthStart.getMonth() + 1
  const makeWrapUrl = (fmt: string) => {
    const sig = signWrapUrl(user.id, wrapYear, wrapMonth, fmt)
    // & doit être &amp; dans les attributs href HTML — les clients email (Outlook…) cassent l'URL sinon
    return `${baseUrl}/api/wrap-image-public?uid=${user.id}&amp;y=${wrapYear}&amp;m=${wrapMonth}&amp;format=${fmt}&amp;sig=${sig}`
  }
  const html = buildEmail({
    name: profile?.display_name || user.email.split('@')[0],
    month: monthLabel,
    newCards, rcCount, autoCount, patchCount, numCount,
    rank, totalCollectors,
    totalCards: profile?.stats_total || 0,
    highlights,
    galerieUrl: `${baseUrl}/galerie/${user.id}`,
    cardImages,
    squareUrl: makeWrapUrl('square'),
    storyUrl: makeWrapUrl('story'),
  })

  try {
    await getResend().emails.send({
      from: 'Memorabilius <contact@memorabilius.fr>',
      to: user.email,
      subject: `[TEST] Ton Wrap ${monthLabel} 🏀 — Memorabilius`,
      html,
    })
    return NextResponse.json({ ok: true, email: user.email, month: monthLabel, newCards, period })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
