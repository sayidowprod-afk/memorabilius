'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Card3DInline from '@/components/Card3DInline'
import TeamBadge from '@/components/TeamBadge'
import type { CardMeta } from '@/app/api/admin/player-sheets-card-search/route'
import TeamHistory from '@/components/TeamHistory'
import type { TeamStint } from '@/lib/espnHeadshot'
import { eur, toEur, type CardMarket, type Seg } from '@/lib/playerCardMarket'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_BLUE, FDLC_RED, FDLC_NAVY } from '@/lib/fdlcBranding'

export interface PresenterSheet {
  player_name: string
  card_image_recto: string | null; card_image_recto_hd: string | null
  card_image_verso: string | null; card_image_verso_hd: string | null
  card_is_horizontal: boolean
  card_meta: CardMeta | null
  stat_saison: string | null; stat_poste: string | null; stat_country: string | null; stat_age: string | null
  stat_matches: string | null; stat_minutes: string | null
  stat_points: string | null; stat_rebonds: string | null; stat_passes: string | null; stat_autres: string | null
  notes: string | null
  team_history?: TeamStint[] | null
  card_market?: CardMarket | null
}

// Image plutôt qu'emoji -- pas de police couleur pour les drapeaux sur
// Windows/Chrome desktop (affiche juste les 2 lettres du code).
function flagImgUrl(code: string | null | undefined): string | null {
  const c = (code || '').trim().toLowerCase()
  if (c.length !== 2) return null
  return `https://flagcdn.com/w80/${c}.png`
}

// Charte du podcast Fédération de la Carte (bleu / rouge / blanc, typo impact) : la page est capturée
// dans le grand cadre de l'habillage du podcast, donc elle n'utilise plus les couleurs de l'équipe.
function StatCard({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={{
      background: '#fefefe', borderRadius: 14, // pas #fff : le thème sombre du site (globals.css) assombrit les div à fond #fff
      padding: compact ? '14px 12px 12px' : '18px 20px', position: 'relative', overflow: 'hidden', minWidth: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: FDLC_RED }} />
      <div className={fdlcFont.className} style={{ fontSize: compact ? 12 : 13, letterSpacing: compact ? 1.2 : 1.6, textTransform: 'uppercase', color: FDLC_BLUE, marginBottom: 6, marginTop: 4, whiteSpace: 'nowrap' }}>{label}</div>
      <div className={fdlcFont.className} style={{ fontSize: compact ? 36 : 42, color: FDLC_NAVY, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

const nf = (n: number) => n.toLocaleString('fr-FR')

// Petite tuile de la colonne « Marché des cartes » (même charte que StatCard, en plus compact).
function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#fefefe', borderRadius: 12, padding: '14px 14px 10px', position: 'relative', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: FDLC_RED }} />
      <div className={fdlcFont.className} style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: FDLC_BLUE, marginTop: 3, marginBottom: 4 }}>{label}</div>
      <div className={fdlcFont.className} style={{ fontSize: value.length > 6 ? 24 : 30, color: FDLC_NAVY, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, fontWeight: 700, color: '#5b6785', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

// Colonne de droite : stats cartes mondiales (catalogue TCDB + annonces eBay), calculées depuis l'admin (fiche joueur).
function CardMarketColumn({ data }: { data: CardMarket }) {
  const c = data.catalog, m = data.market
  const usd = (n: number) => eur(toEur(n, m))
  const seg = (label: string, s: Seg | null | undefined) =>
    s ? <MiniStat key={label} label={label} value={usd(s.median)} sub={`${s.n} annonces · ${usd(s.min)} – ${usd(s.max)}`} />
      : <MiniStat key={label} label={label} value="—" sub="pas assez d’annonces" />
  const title = (t: string) => <div className={fdlcFont.className} style={{ fontSize: 14, letterSpacing: 1.8, textTransform: 'uppercase', color: '#fff', marginBottom: 10 }}>{t}</div>
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {c && (
        <div>
          {title('Dans le monde')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            <MiniStat label="Cartes" value={nf(c.total)} sub={`${nf(c.sets)} sets`} />
            <MiniStat label="RC" value={nf(c.rc)} />
            <MiniStat label="Autos" value={nf(c.auto)} />
            <MiniStat label="Patchs" value={nf(c.patch)} />
            {c.firstYear && c.lastYear && <MiniStat label="Années" value={c.firstYear === c.lastYear ? String(c.firstYear) : `${c.firstYear}–${String(c.lastYear).slice(2)}`} />}
            {c.topBrands[0] && <MiniStat label="N°1" value={c.topBrands[0].brand} sub={`${nf(c.topBrands[0].count)} cartes`} />}
          </div>
        </div>
      )}
      {m && (
        <div>
          {title('Prix médian sur eBay')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {seg('RC', m.rc)}{seg('Autos', m.auto)}{seg('Patchs', m.patch)}{seg('PSA 10', m.psa10)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 8 }}>
            Annonces en cours{m.listings != null ? ` (${nf(m.listings)} pour ce joueur)` : ''} · prix demandés, convertis en euros
          </div>
        </div>
      )}
    </div>
  )
}

// Affichage de la page de présentation (capturée dans le cadre du podcast) : séparé de la page pour pouvoir l'essayer
// en local avec des données d'exemple (voir /dev-presentation), sans session admin.
export default function PlayerSheetPresenterView({ sheet, team, teamAbbr, sheetId, order, idx, prevId, nextId, goTo }: {
  sheet: PresenterSheet; team: { id: string; name: string }; teamAbbr: string; sheetId: string
  order: string[]; idx: number; prevId: string | null; nextId: string | null; goTo: (id: string | null) => void
}) {
  // Tient tout sur l'ecran : on reduit l'ensemble au lieu de le laisser deborder. Mesure de la
  // taille de mise en page (offsetHeight/Width), non affectee par le scale.
  // Petits ecrans / mobile : pas de reduction, on garde le defilement normal.
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => {
      if (window.innerWidth < 1100) { setScale(1); return }
      const h = el.offsetHeight, w = el.offsetWidth
      if (!h || !w) return
      const next = Math.max(0.45, Math.min(1, window.innerHeight / h, window.innerWidth / w))
      setScale(prev => (Math.abs(prev - next) < 0.005 ? prev : next))
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [sheetId, sheet])

  const flag = flagImgUrl(sheet.stat_country)
  const infoBadges = [
    sheet.stat_poste && { label: 'Poste', value: sheet.stat_poste },
    sheet.stat_age && { label: 'Âge', value: sheet.stat_age },
    sheet.stat_saison && { label: 'Expérience', value: sheet.stat_saison },
  ].filter(Boolean) as { label: string; value: string }[]
  const stats = [
    sheet.stat_points && { label: 'Points', value: sheet.stat_points },
    sheet.stat_rebonds && { label: 'Rebonds', value: sheet.stat_rebonds },
    sheet.stat_passes && { label: 'Passes', value: sheet.stat_passes },
    sheet.stat_matches && { label: 'Matchs', value: sheet.stat_matches },
    sheet.stat_minutes && { label: 'Min / match', value: sheet.stat_minutes },
  ].filter(Boolean) as { label: string; value: string }[]

  // Avec les stats cartes : grille à 3 colonnes (carte | joueur + stats | marché) et notes sur toute la largeur en bas.
  const wide = !!(sheet.card_market && (sheet.card_market.catalog || sheet.card_market.market))
  // Parcours chargé (plus de 5 équipes, ex. Dennis Schröder) : en bandeau sur toute la largeur sous l'en-tête, tuiles réduites.
  const nStints = Array.isArray(sheet.team_history) ? sheet.team_history.length : 0
  const manyStints = nStints > 5
  const parcoursEl = Array.isArray(sheet.team_history) && sheet.team_history.length > 1 ? (
    <div style={wide ? (manyStints ? { zoom: nStints > 8 ? 0.72 : 0.85 } : { flexShrink: 0, maxWidth: '45%' }) : undefined}>
      <div className={fdlcFont.className} style={{ fontSize: 14, letterSpacing: 1.8, textTransform: 'uppercase', color: '#fff', marginBottom: 10 }}>Parcours</div>
      <TeamHistory history={sheet.team_history} variant="dark" />
    </div>
  ) : null
  const notesEl = sheet.notes ? (
    <div style={{
      fontSize: wide ? 18 : 17, lineHeight: 1.5, color: FDLC_NAVY, fontStyle: 'italic',
      background: '#fefefe', borderLeft: `6px solid ${FDLC_RED}`,
      borderRadius: 14, padding: wide ? '16px 24px' : '20px 24px', whiteSpace: 'pre-wrap',
    }}>
      {sheet.notes}
    </div>
  ) : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999, overflow: 'auto', color: '#fff',
      background: FDLC_BLUE, boxShadow: `inset 0 0 0 5px ${FDLC_RED}`,
    }}>
      <Link href={`/admin/player-sheets/${teamAbbr}/${sheetId}`} style={{
        position: 'fixed', top: 20, right: 24, width: 42, height: 42, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
      }}>✕</Link>

      {order.length > 1 && (
        <div style={{
          // Discret : petit, coin bas droit, quasi transparent (visible au survol).
          position: 'fixed', bottom: 10, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          opacity: 0.18, transition: 'opacity .2s',
        }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.18' }}>
          <button onClick={() => goTo(prevId)} disabled={!prevId} aria-label="Joueur précédent"
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: prevId ? 'pointer' : 'default', opacity: prevId ? 1 : 0.3 }}>‹</button>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
          <button onClick={() => goTo(nextId)} disabled={!nextId} aria-label="Joueur suivant"
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: nextId ? 'pointer' : 'default', opacity: nextId ? 1 : 0.3 }}>›</button>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(scale < 1 ? { height: '100%', overflow: 'hidden' } : { minHeight: '100%' }),
      }}>
      {wide && <style>{`
        .pv-wide { display: grid; grid-template-columns: 440px minmax(0, 940px); column-gap: 48px; align-items: center; justify-content: center; width: min(1500px, 100vw); box-sizing: border-box; }
        .pv-card { grid-column: 1; grid-row: 1; }
        .pv-main { grid-column: 2; grid-row: 1; }
        @media (max-width: 1100px) { .pv-wide { display: flex; flex-direction: column; align-items: center; width: auto; } .pv-main { width: 100%; max-width: 640px; } }
      `}</style>}
      <div ref={contentRef} className={wide ? 'pv-wide' : undefined} style={{
        ...(wide
          ? { padding: '50px 40px' }
          : { display: 'flex', flexWrap: 'wrap-reverse', alignItems: 'center', justifyContent: 'center', gap: 72, padding: '70px 40px' }),
        transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: 'center center',
      }}>
        <div className={wide ? 'pv-card' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', bottom: -20, transform: 'translateX(-50%)',
              width: '78%', height: 40, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.45), transparent 72%)', filter: 'blur(6px)',
            }} />
            {sheet.card_image_recto && (
              <Card3DInline
                key={sheetId}
                front={sheet.card_image_recto_hd || sheet.card_image_recto}
                back={sheet.card_image_verso_hd || sheet.card_image_verso || undefined}
                isHorizontal={sheet.card_is_horizontal}
                accent={FDLC_RED}
                maxWidth={wide ? 440 : 520}
              />
            )}
          </div>
          {sheet.card_meta && (sheet.card_meta.brand || sheet.card_meta.year || sheet.card_meta.number || sheet.card_meta.owner) && (
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 10, textAlign: 'center' }}>
              {[sheet.card_meta.brand, sheet.card_meta.year, sheet.card_meta.number ? `#${sheet.card_meta.number}` : null].filter(Boolean).join(' · ')}
              {sheet.card_meta.owner && <span> · Collection de {sheet.card_meta.owner}</span>}
            </div>
          )}
        </div>

        <div className={wide ? 'pv-main' : undefined} style={{ ...(wide ? {} : { maxWidth: 580 }), width: '100%', display: 'flex', flexDirection: 'column', gap: wide ? 22 : 28 }}>
          <div style={wide ? { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 } : undefined}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 16,
              background: FDLC_RED, borderRadius: 999, padding: '6px 18px 6px 8px',
            }}>
              <span style={{ background: '#fff', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TeamBadge teamId={team.id} size={26} />
              </span>
              <div className={fdlcFont.className} style={{ fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: '#fff' }}>{team.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {flag && <img src={flag} alt="" style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />}
              <div className={fdlcFont.className} style={{
                fontSize: 'clamp(36px, 5.2vw, 62px)', lineHeight: 1.1, paddingBottom: 4, textTransform: 'uppercase', color: '#fff',
              }}>
                {sheet.player_name}
              </div>
            </div>
            {infoBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {infoBadges.map(b => (
                  <span key={b.label} style={{
                    fontSize: 14, fontWeight: 700, color: FDLC_NAVY,
                    background: '#fff', borderRadius: 999, padding: '6px 14px',
                  }}>
                    <span style={{ color: FDLC_RED, fontWeight: 800 }}>{b.label} : </span>{b.value}
                  </span>
                ))}
              </div>
            )}
          </div>
          {wide && !manyStints && parcoursEl}
          </div>
          {wide && manyStints && parcoursEl}

          {stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: wide ? `repeat(${stats.length}, minmax(0, 1fr))` : 'repeat(auto-fit, minmax(130px, 1fr))', gap: wide ? 10 : 12 }}>
              {stats.map(s => <StatCard key={s.label} {...s} compact={wide} />)}
            </div>
          )}

          {wide && sheet.card_market && <CardMarketColumn data={sheet.card_market} />}

          {!wide && parcoursEl}

          {sheet.stat_autres && (
            <div style={{
              fontSize: 18, fontWeight: 700, color: '#fff',
              borderLeft: `5px solid ${FDLC_RED}`, paddingLeft: 16,
            }}>
              {sheet.stat_autres}
            </div>
          )}

          {notesEl}
        </div>
      </div>
      </div>
    </div>
  )
}
