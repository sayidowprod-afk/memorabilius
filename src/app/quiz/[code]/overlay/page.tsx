'use client'
import { use } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY_DEEP, FDLC_CHOICE_COLORS, FDLC_RED } from '@/lib/fdlcBranding'
import SignatureCrop from '@/components/SignatureCrop'
import { useLiveQuizPoll, formatResponseMs } from '@/lib/useLiveQuizPoll'
import ConfettiBurst from '@/components/ConfettiBurst'
import QuizAnimStyles from '@/components/QuizAnimStyles'
import WaveText from '@/components/WaveText'
import JoinQrBadge from '@/components/JoinQrBadge'

// Panneau vertical COMPACT (~demi-écran, docké à droite, fond transparent) --
// pensé pour être ajouté comme Browser Source à côté d'une webcam sans
// couvrir toute la scène. Voir /quiz/[code]/overlay/big pour la variante
// grand format, opaque, pensée pour occuper un large bandeau/fond dédié.
// Haut : la question (ou la signature pour une manche "quiz autographes"),
// les choix ne se révèlent QUE quand l'animateur clique "Révéler" (voir
// /api/live-quiz, qui filtre déjà round_correct_index côté serveur -- rien
// de sensible n'atterrit ici avant). Bas : pendant la question, un
// classement en direct de qui a répondu le plus vite (sans révéler qui a
// juste) ; sinon, le classement cumulé avec points.
//
// Animations (demande : "rendre le tout vivant pour le stream") : chaque
// nouvelle ligne du fil "plus rapides" rebondit à son apparition (montage
// DOM naturel de React sur un tableau qui ne fait que grandir pendant une
// manche -- pas besoin de logique de diff), le compteur de votes pulse à
// chaque nouveau vote, confettis + halo vert à la révélation.
export default function QuizOverlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()
  const { poll, remaining, voteBump, justRevealed } = useLiveQuizPoll(code)

  // Le fond transparent est garanti par le layout serveur du segment
  // (src/app/quiz/layout.tsx), présent dès le premier HTML -- plus besoin de
  // l'injecter ici après coup.
  if (!poll) return null

  const { session, tally, totalAnswers, leaderboard, speedFeed } = poll
  const hasRound = session.status === 'question' || session.status === 'reveal'
  const revealed = session.status === 'reveal'
  const maxTally = Math.max(1, ...tally)
  const showSpeedFeed = session.status === 'question'
  const beforeFirstQuestion = !hasRound && leaderboard.length === 0

  return (
    <div style={{
      minHeight: '100dvh', position: 'relative', background: 'transparent', fontFamily: 'system-ui, sans-serif', color: 'white',
      display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', padding: '36px',
    }}>
      <QuizAnimStyles />
      {!beforeFirstQuestion && (
        <div style={{ position: 'absolute', bottom: 20, right: 24, zIndex: 3 }}>
          <JoinQrBadge code={session.code} size={58} />
        </div>
      )}
      <div style={{
        width: 'min(46vw, 620px)', minHeight: 0, maxHeight: 'calc(100dvh - 72px)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Question / signature + choix (revele seulement a status='reveal') */}
        <Card style={{ position: 'relative', overflow: 'hidden' }}>
          <ConfettiBurst active={justRevealed} />
          {/* Filigrane centre, jamais pivote (voir overlay/big/page.tsx pour
              le raisonnement -- le premier essai pivote/colle dans un coin
              faisait "bloc plaque au hasard"). */}
          <img src={FDLC_LOGO_URL} alt="" style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            height: '160%', width: 'auto', opacity: 0.05, pointerEvents: 'none', filter: 'grayscale(1)',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                border: `1.5px solid ${FDLC_RED}`,
              }}>
                <img src={FDLC_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.title}
              </div>
            </div>
            {remaining !== null && session.status === 'question' && (
              <div className={remaining <= 5 ? 'quiz-anim-pulse' : undefined} style={{
                fontSize: 15, fontWeight: 900, padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                background: remaining <= 5 ? '#c8102e' : 'rgba(255,255,255,0.12)',
              }}>⏱ {remaining}s</div>
            )}
          </div>

          {beforeFirstQuestion ? (
            <div style={{ padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className={fdlcFont.className} style={{ fontSize: 18, textAlign: 'center' }}>Le quiz va bientôt commencer...</div>
              <JoinQrBadge code={session.code} size={150} hero />
            </div>
          ) : !hasRound ? (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px 0' }}>
              <WaveText text="En attente de la prochaine question..." />
            </div>
          ) : session.roundType === 'autograph' && session.promptImage ? (
            <div>
              <div className={fdlcFont.className} style={{ fontSize: 20, marginBottom: 14, lineHeight: 1.3 }}>✍️ Quelle est cette signature ?</div>
              <div style={{ maxWidth: 260, margin: '0 auto 16px' }}>
                <SignatureCrop {...session.promptImage} />
              </div>
            </div>
          ) : (
            <div className={fdlcFont.className} style={{ fontSize: 24, marginBottom: 16, lineHeight: 1.3 }}>{session.question}</div>
          )}

          {/* Propositions visibles dès le début de la question -- seuls la
              mise en avant du bon choix, la barre de vote et le % restent
              reserves a la revelation. */}
          {hasRound && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(session.choices || []).map((choice, i) => {
                const count = tally[i] ?? 0
                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
                const isCorrect = revealed && session.correctIndex === i
                return (
                  <div key={i} className="quiz-anim-pop" style={{ display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 70}ms` }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, background: FDLC_CHOICE_COLORS[i], flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13,
                      boxShadow: isCorrect ? '0 0 0 3px #2ecc71' : 'none',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, position: 'relative', height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                      {revealed && (
                        <div style={{
                          position: 'absolute', inset: 0, width: `${Math.max(4, (count / maxTally) * 100)}%`,
                          background: isCorrect ? 'linear-gradient(90deg, #1e9e57, #2ecc71)' : 'rgba(255,255,255,0.16)',
                          transition: 'width 0.6s ease',
                        }} />
                      )}
                      <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 13px' }}>
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{choice}</span>
                        {revealed && <span style={{ fontSize: 12.5, fontWeight: 900, color: 'rgba(255,255,255,0.65)' }}>{pct}%</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {revealed && (
                <div className={voteBump ? 'quiz-anim-bump' : undefined} style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'inline-block' }}>
                  {totalAnswers} vote{totalAnswers > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Bas : vitesse en direct pendant la question, classement sinon */}
        <Card style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
              {showSpeedFeed ? '⚡ Les plus rapides' : '🏆 Classement'}
            </div>
            {showSpeedFeed && (
              <span className={voteBump ? 'quiz-anim-bump' : undefined} style={{ fontSize: 12, fontWeight: 900, color: '#2ecc71', display: 'inline-block' }}>
                {totalAnswers}
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {showSpeedFeed ? (
              speedFeed.length === 0 ? (
                <EmptyRow>En attente des premières réponses...</EmptyRow>
              ) : speedFeed.map((s, i) => (
                <Row key={i} rank={i + 1} pop>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{s.pseudo}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'rgba(255,255,255,0.45)' }}>{formatResponseMs(s.ms)}</span>
                </Row>
              ))
            ) : (
              leaderboard.length === 0 ? (
                <EmptyRow>Personne n'a encore marqué de points.</EmptyRow>
              ) : leaderboard.map((e, i) => (
                <Row key={i} rank={i + 1} gold={i === 0}>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{e.pseudo}</span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
                </Row>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      // Degrades superposes (lueur rouge en coin + fines rayures en biais)
      // plutot que l'aplat uni d'origine, jugee un peu terne pour le stream.
      background: `
        radial-gradient(circle at 100% 0%, ${FDLC_RED}22, transparent 55%),
        repeating-linear-gradient(135deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 12px),
        ${FDLC_NAVY_DEEP}e6
      `,
      backdropFilter: 'blur(6px)', borderRadius: 20,
      padding: '20px 24px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function Row({ rank, gold, pop, children }: { rank: number; gold?: boolean; pop?: boolean; children: React.ReactNode }) {
  return (
    <div className={pop ? 'quiz-anim-row-in' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 20, flexShrink: 0, fontSize: 13, fontWeight: 900, color: gold ? '#e8b400' : 'rgba(255,255,255,0.5)' }}>{rank}</span>
      {children}
    </div>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{children}</div>
}
