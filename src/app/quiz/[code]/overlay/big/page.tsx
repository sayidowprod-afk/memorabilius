'use client'
import { use } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY, FDLC_NAVY_DEEP, FDLC_RED, FDLC_CHOICE_COLORS } from '@/lib/fdlcBranding'
import SignatureCrop from '@/components/SignatureCrop'
import { useLiveQuizPoll, formatResponseMs } from '@/lib/useLiveQuizPoll'
import ConfettiBurst from '@/components/ConfettiBurst'
import QuizAnimStyles from '@/components/QuizAnimStyles'
import WaveText from '@/components/WaveText'
import JoinQrBadge from '@/components/JoinQrBadge'

// Variante GRAND FORMAT de l'overlay -- pensée pour occuper toute une zone
// dédiée de la scène (ex: le grand bandeau bleu d'un habillage existant),
// pas juste un coin transparent par-dessus une caméra. Fond opaque à elle
// (pas besoin d'être composée par-dessus autre chose) : le Browser Source
// dans OBS/Streamlabs doit juste être dimensionné/positionné sur cette zone.
// Cadre coins arrondis + bordure rouge pour matcher le reste de l'habillage
// (bandeau TIERLIST, cadres caméra) -- premier essai sans cadre jugé "pas
// comme demandé". Le contenu remplit toute la hauteur du cadre via flex
// (plus d'espace mort en bas quand il y a peu de lignes au classement).
// Même logique de révélation que la version compacte (/quiz/[code]/overlay) :
// rien de sensible avant que l'animateur clique "Révéler".
export default function QuizOverlayBigPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()
  const { poll, remaining, voteBump, justRevealed } = useLiveQuizPoll(code)

  if (!poll) {
    return <div style={{ minHeight: '100dvh', background: FDLC_NAVY_DEEP }} />
  }

  const { session, tally, totalAnswers, leaderboard, speedFeed } = poll
  const hasRound = session.status === 'question' || session.status === 'reveal'
  const revealed = session.status === 'reveal'
  const maxTally = Math.max(1, ...tally)
  const showSpeedFeed = session.status === 'question'
  const bottomEmpty = showSpeedFeed ? speedFeed.length === 0 : leaderboard.length === 0

  return (
    <div style={{ minHeight: '100dvh', background: 'transparent', padding: 18, fontFamily: 'system-ui, sans-serif', color: 'white' }}>
      <QuizAnimStyles />
      <div style={{
        position: 'relative', overflow: 'hidden', height: 'calc(100dvh - 36px)',
        background: `radial-gradient(circle at 50% -20%, ${FDLC_NAVY} 0%, ${FDLC_NAVY_DEEP} 60%)`,
        border: `4px solid ${FDLC_RED}`, borderRadius: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', padding: '32px 44px',
      }}>
        <ConfettiBurst active={justRevealed} />
        <div style={{ position: 'absolute', bottom: 20, right: 24, zIndex: 3 }}>
          <JoinQrBadge code={session.code} />
        </div>
        {/* Filigrane logo en fond, tres discret -- donne un peu de vie a l'ecran meme en lobby */}
        <img src={FDLC_LOGO_URL} alt="" style={{
          position: 'absolute', right: '-6%', top: '-6%', width: '46%', height: 'auto',
          opacity: 0.06, transform: 'rotate(-8deg)', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexShrink: 0, position: 'relative' }}>
          <img src={FDLC_LOGO_URL} alt="" style={{ height: 52, width: 52, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className={fdlcFont.className} style={{ fontSize: 24, lineHeight: 1.1 }}>{session.title}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5 }}>Fédération de la Carte</div>
          </div>
          {remaining !== null && session.status === 'question' && (
            <div className={remaining <= 5 ? 'quiz-anim-pulse' : undefined} style={{
              marginLeft: 'auto', flexShrink: 0, fontSize: 28, fontWeight: 900, padding: '10px 26px', borderRadius: 999,
              background: remaining <= 5 ? FDLC_RED : 'rgba(255,255,255,0.14)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>⏱ {remaining}s</div>
          )}
        </div>

        {/* Corps : question/choix a gauche, classement/vitesse a droite --
            avant, tout etait empile dans une seule colonne (question + 4
            choix + minuteur + fil "plus rapides" bien rempli), ce qui
            forcait des tailles de police reduites pour que ca tienne, et
            provoquait meme un chevauchement avec l'en-tete quand ca
            debordait. Deux colonnes cote a cote : chacune a moins de choses
            a caser en hauteur, donc peut se permettre du plus grand. */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 40, position: 'relative' }}>
          <div style={{ flex: '1.35 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, overflowY: 'auto' }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              {!hasRound ? (
                <div style={{ fontSize: 30, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
                  <WaveText text="En attente de la prochaine question..." />
                </div>
              ) : session.roundType === 'autograph' && session.promptImage ? (
                <div>
                  <div className={fdlcFont.className} style={{ fontSize: 30, marginBottom: 18 }}>✍️ Quelle est cette signature ?</div>
                  <div style={{ maxWidth: 340, margin: '0 auto' }}>
                    <SignatureCrop {...session.promptImage} style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.55)' }} />
                  </div>
                </div>
              ) : (
                <div className={fdlcFont.className} style={{ fontSize: 52, lineHeight: 1.18 }}>{session.question}</div>
              )}
            </div>

            {/* Propositions visibles dès le début de la question (pas
                seulement à la révélation) -- seuls la mise en avant du bon
                choix, la barre de vote et le % restent reserves a la
                revelation. */}
            {hasRound && (
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 18, width: '100%' }}>
                {(session.choices || []).map((choice, i) => {
                  const count = tally[i] ?? 0
                  const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                  const isCorrect = revealed && session.correctIndex === i
                  return (
                    <div key={i} className="quiz-anim-pop" style={{ display: 'flex', alignItems: 'center', gap: 18, animationDelay: `${i * 70}ms` }}>
                      <div style={{
                        width: 50, height: 50, borderRadius: 14, background: FDLC_CHOICE_COLORS[i], flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22,
                        boxShadow: isCorrect ? '0 0 0 4px #2ecc71' : 'none',
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0, position: 'relative', height: 64, borderRadius: 16, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', border: `1px solid ${FDLC_RED}2e` }}>
                        {revealed && (
                          <div style={{
                            position: 'absolute', inset: 0, width: `${Math.max(5, (count / maxTally) * 100)}%`,
                            background: isCorrect ? 'linear-gradient(90deg, #1e9e57, #2ecc71)' : 'rgba(255,255,255,0.18)',
                            transition: 'width 0.6s ease',
                          }} />
                        )}
                        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
                          <span style={{ fontSize: 24, fontWeight: 800 }}>{choice}</span>
                          {revealed && <span style={{ fontSize: 19, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{pct}%</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {revealed && (
                  <div className={voteBump ? 'quiz-anim-bump' : undefined} style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textAlign: 'center', display: 'inline-block', width: '100%' }}>
                    {totalAnswers} vote{totalAnswers > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vitesse en direct pendant la question, classement sinon -- colonne pleine hauteur */}
          <div style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', borderLeft: `2px solid ${FDLC_RED}44`, paddingLeft: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 2 }}>
                {showSpeedFeed ? '⚡ Les plus rapides' : '🏆 Classement'}
              </div>
              {showSpeedFeed && (
                <span className={voteBump ? 'quiz-anim-bump' : undefined} style={{ fontSize: 17, fontWeight: 900, color: '#2ecc71', display: 'inline-block' }}>
                  {totalAnswers}
                </span>
              )}
            </div>
            {bottomEmpty ? (
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
                {showSpeedFeed ? 'En attente des premières réponses...' : "Personne n'a encore marqué de points."}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', minHeight: 0 }}>
                {showSpeedFeed
                  ? speedFeed.map((s, i) => (
                      <BigRow key={i} rank={i + 1} pop>
                        <span style={{ flex: 1, fontSize: 20, fontWeight: 800 }}>{s.pseudo}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>{formatResponseMs(s.ms)}</span>
                      </BigRow>
                    ))
                  : leaderboard.map((e, i) => (
                      <BigRow key={i} rank={i + 1} gold={i === 0}>
                        <span style={{ flex: 1, fontSize: 20, fontWeight: 800 }}>{e.pseudo}</span>
                        <span style={{ fontSize: 20, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
                      </BigRow>
                    ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BigRow({ rank, gold, pop, children }: { rank: number; gold?: boolean; pop?: boolean; children: React.ReactNode }) {
  return (
    <div className={pop ? 'quiz-anim-row-in' : undefined} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 14,
      background: 'rgba(255,255,255,0.06)', border: gold ? `1px solid #e8b400` : `1px solid ${FDLC_RED}33`,
    }}>
      <span style={{ width: 22, flexShrink: 0, fontSize: 16, fontWeight: 900, color: gold ? '#e8b400' : 'rgba(255,255,255,0.5)' }}>{rank}</span>
      {children}
    </div>
  )
}
