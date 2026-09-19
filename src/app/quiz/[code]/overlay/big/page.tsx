'use client'
import { use } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY, FDLC_NAVY_DEEP, FDLC_RED, FDLC_CHOICE_COLORS } from '@/lib/fdlcBranding'
import SignatureCrop from '@/components/SignatureCrop'
import { useLiveQuizPoll } from '@/lib/useLiveQuizPoll'

// Variante GRAND FORMAT de l'overlay -- pensée pour occuper toute une zone
// dédiée de la scène (ex: le grand bandeau bleu d'un habillage existant),
// pas juste un coin transparent par-dessus une caméra. Fond opaque à elle
// (pas besoin d'être composée par-dessus autre chose) : le Browser Source
// dans OBS/Streamlabs doit juste être dimensionné/positionné sur cette zone.
// Même logique de révélation que la version compacte (/quiz/[code]/overlay) :
// rien de sensible avant que l'animateur clique "Révéler".
export default function QuizOverlayBigPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()
  const { poll, remaining } = useLiveQuizPoll(code)

  if (!poll) {
    return <div style={{ minHeight: '100dvh', background: FDLC_NAVY_DEEP }} />
  }

  const { session, tally, totalAnswers, leaderboard, speedFeed } = poll
  const hasRound = session.status === 'question' || session.status === 'reveal'
  const revealed = session.status === 'reveal'
  const maxTally = Math.max(1, ...tally)
  const showSpeedFeed = session.status === 'question'
  const bottomList = showSpeedFeed ? speedFeed : leaderboard
  const bottomEmpty = showSpeedFeed ? speedFeed.length === 0 : leaderboard.length === 0

  return (
    <div style={{
      minHeight: '100dvh', position: 'relative', overflow: 'hidden',
      background: `radial-gradient(circle at 50% -20%, ${FDLC_NAVY} 0%, ${FDLC_NAVY_DEEP} 60%)`,
      fontFamily: 'system-ui, sans-serif', color: 'white', display: 'flex', flexDirection: 'column',
      padding: '40px 56px',
    }}>
      {/* Filigrane logo en fond, tres discret -- donne un peu de vie a l'ecran meme en lobby */}
      <img src={FDLC_LOGO_URL} alt="" style={{
        position: 'absolute', right: '-6%', top: '-6%', width: '46%', height: 'auto',
        opacity: 0.06, transform: 'rotate(-8deg)', pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, position: 'relative' }}>
        <img src={FDLC_LOGO_URL} alt="" style={{ height: 46, width: 46, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
        <div>
          <div className={fdlcFont.className} style={{ fontSize: 22, lineHeight: 1.1 }}>{session.title}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Fédération de la Carte</div>
        </div>
        {remaining !== null && session.status === 'question' && (
          <div style={{
            marginLeft: 'auto', fontSize: 22, fontWeight: 900, padding: '8px 22px', borderRadius: 999,
            background: remaining <= 5 ? FDLC_RED : 'rgba(255,255,255,0.1)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}>⏱ {remaining}s</div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 28, position: 'relative' }}>
        {/* Question / signature */}
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          {!hasRound ? (
            <div style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.4)', padding: '30px 0' }}>
              En attente de la prochaine question...
            </div>
          ) : session.roundType === 'autograph' && session.promptImage ? (
            <div>
              <div className={fdlcFont.className} style={{ fontSize: 30, marginBottom: 18 }}>✍️ Quelle est cette signature ?</div>
              <div style={{ maxWidth: 340, margin: '0 auto' }}>
                <SignatureCrop {...session.promptImage} style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.55)' }} />
              </div>
            </div>
          ) : (
            <div className={fdlcFont.className} style={{ fontSize: 42, lineHeight: 1.25, maxWidth: 900, margin: '0 auto' }}>{session.question}</div>
          )}
        </div>

        {/* Choix : uniquement a la revelation, en grandes barres pleine largeur */}
        {hasRound && revealed && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, width: '100%', margin: '0 auto' }}>
            {(session.choices || []).map((choice, i) => {
              const count = tally[i] ?? 0
              const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
              const isCorrect = session.correctIndex === i
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: FDLC_CHOICE_COLORS[i], flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18,
                    boxShadow: isCorrect ? '0 0 0 4px #2ecc71' : 'none',
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, position: 'relative', height: 54, borderRadius: 14, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', inset: 0, width: `${Math.max(5, (count / maxTally) * 100)}%`,
                      background: isCorrect ? 'linear-gradient(90deg, #1e9e57, #2ecc71)' : 'rgba(255,255,255,0.18)',
                      transition: 'width 0.6s ease',
                    }} />
                    <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
                      <span style={{ fontSize: 20, fontWeight: 800 }}>{choice}</span>
                      <span style={{ fontSize: 17, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              {totalAnswers} vote{totalAnswers > 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Bas : vitesse en direct pendant la question, classement sinon -- grille 2 colonnes pour remplir l'espace */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, textAlign: 'center' }}>
            {showSpeedFeed ? '⚡ Les plus rapides' : '🏆 Classement'}
          </div>
          {bottomEmpty ? (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              {showSpeedFeed ? 'En attente des premières réponses...' : "Personne n'a encore marqué de points."}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', maxWidth: 760, margin: '0 auto', width: '100%' }}>
              {showSpeedFeed
                ? (speedFeed as string[]).map((pseudo, i) => (
                    <BigRow key={i} rank={i + 1}>
                      <span style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>{pseudo}</span>
                    </BigRow>
                  ))
                : (leaderboard as { pseudo: string; score: number }[]).map((e, i) => (
                    <BigRow key={i} rank={i + 1} gold={i === 0}>
                      <span style={{ flex: 1, fontSize: 18, fontWeight: 800 }}>{e.pseudo}</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
                    </BigRow>
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BigRow({ rank, gold, children }: { rank: number; gold?: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.05)', border: gold ? '1px solid #e8b400' : '1px solid transparent',
    }}>
      <span style={{ width: 22, flexShrink: 0, fontSize: 16, fontWeight: 900, color: gold ? '#e8b400' : 'rgba(255,255,255,0.5)' }}>{rank}</span>
      {children}
    </div>
  )
}
