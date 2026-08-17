'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'

const STORAGE_KEY = 'onboarding_done'
const ACCENT = '#003DA6'

export default function OnboardingModal() {
  const { dark } = useTheme()
  const { t } = useLang()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      setVisible(true)
    })
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function goToAdd() {
    dismiss()
    if (userId) router.push(`/galerie/${userId}/ajouter`)
  }

  function goStep(n: number) {
    setStep(n)
    if (trackRef.current) trackRef.current.style.transform = `translateX(${-n * 100}%)`
  }

  if (!visible) return null

  const bg      = dark ? '#17151F' : '#ffffff'
  const bg2     = dark ? '#211E2D' : '#F3F4F8'
  const txt     = dark ? '#F0EDE8' : '#1A1728'
  const txt2    = dark ? '#8B849E' : '#6B6480'
  const overlay = dark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: overlay,
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        background: bg,
        borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 480,
        boxShadow: '0 -24px 80px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Barre de progression */}
        <div style={{ display: 'flex', gap: 6, padding: '18px 24px 0', justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              height: 4, flex: 1, maxWidth: 60, borderRadius: 2,
              background: i <= step ? ACCENT : bg2,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Slider */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <div
            ref={trackRef}
            style={{ display: 'flex', transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1)' }}
          >
            {/* Étape 1 — Bienvenue */}
            <Slide>
              <Illo>
                <CardStack />
              </Illo>
              <Title txt={txt}><span dangerouslySetInnerHTML={{ __html: t('onboardm_step1_title') }} /></Title>
              <Sub txt={txt2}>
                {t('onboardm_step1_sub')}<br />
                <Accent>{t('onboardm_step1_accent')}</Accent>, {t('onboardm_step1_sub2')}
              </Sub>
              <BtnRow>
                <BtnSkip bg2={bg2} txt2={txt2} onClick={dismiss}>{t('onboardm_skip')}</BtnSkip>
                <BtnNext onClick={() => goStep(1)}>{t('onboardm_start')}</BtnNext>
              </BtnRow>
            </Slide>

            {/* Étape 2 — Features */}
            <Slide>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {[
                  { icon: '📷', title: t('onboardm_feat1_title'), sub: t('onboardm_feat1_sub') },
                  { icon: '📦', title: t('onboardm_feat2_title'), sub: t('onboardm_feat2_sub') },
                  { icon: '🔁', title: t('onboardm_feat3_title'), sub: t('onboardm_feat3_sub') },
                ].map(f => (
                  <div key={f.title} style={{ display: 'flex', alignItems: 'center', gap: 14, background: bg2, borderRadius: 14, padding: '13px 16px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: `${ACCENT}22`, border: `1px solid ${ACCENT}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: txt, marginBottom: 2 }}>{f.title}</div>
                      <div style={{ fontSize: 12, color: txt2, lineHeight: 1.4 }}>{f.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Title txt={txt}>{t('onboardm_step2_title')}</Title>
              <Sub txt={txt2}>{t('onboardm_step2_sub')} <Accent>{t('onboardm_step2_accent')}</Accent>.</Sub>
              <BtnRow>
                <BtnSkip bg2={bg2} txt2={txt2} onClick={() => goStep(0)}>{t('onboardm_back')}</BtnSkip>
                <BtnNext onClick={() => goStep(2)}>{t('onboardm_next')}</BtnNext>
              </BtnRow>
            </Slide>

            {/* Étape 3 — CTA */}
            <Slide style={{ alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <AddVisual txt2={txt2} />
              </div>
              <Title txt={txt}>{t('onboardm_step3_title')}</Title>
              <Sub txt={txt2} style={{ textAlign: 'center' }}>
                {t('onboardm_step3_sub')}<br /><Accent>{t('onboardm_step3_accent')}</Accent>
              </Sub>
              <BtnRow style={{ width: '100%' }}>
                <BtnSkip bg2={bg2} txt2={txt2} onClick={() => goStep(1)}>{t('onboardm_back')}</BtnSkip>
                <BtnNext onClick={goToAdd}>{t('onboardm_add_card')}</BtnNext>
              </BtnRow>
            </Slide>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sous-composants de mise en page ───────────────────────────── */

function Slide({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ minWidth: '100%', flexShrink: 0, padding: '24px 28px 36px', display: 'flex', flexDirection: 'column', ...style }}>
      {children}
    </div>
  )
}

function Illo({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
      {children}
    </div>
  )
}

function Title({ children, txt }: { children: React.ReactNode; txt: string }) {
  return <div style={{ fontSize: 22, fontWeight: 800, color: txt, lineHeight: 1.22, letterSpacing: '-0.4px', marginBottom: 8 }}>{children}</div>
}

function Sub({ children, txt, style }: { children: React.ReactNode; txt: string; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 15, color: txt, lineHeight: 1.55, marginBottom: 24, ...style }}>{children}</div>
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: ACCENT, fontWeight: 600 }}>{children}</span>
}

function BtnRow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', gap: 10, marginTop: 'auto', ...style }}>{children}</div>
}

function BtnSkip({ children, onClick, bg2, txt2 }: { children: React.ReactNode; onClick: () => void; bg2: string; txt2: string }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: `1.5px solid ${bg2}`, color: txt2,
      borderRadius: 14, padding: '14px 18px', fontSize: 15, fontWeight: 600,
      cursor: 'pointer', flexShrink: 0,
    }}>
      {children}
    </button>
  )
}

function BtnNext({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: ACCENT, color: '#fff', border: 'none',
      borderRadius: 14, padding: '14px 24px', fontSize: 15, fontWeight: 700,
      cursor: 'pointer', flex: 1,
    }}>
      {children}
    </button>
  )
}

/* ── Illustrations ──────────────────────────────────────────────── */

function CardStack() {
  const baseCard: React.CSSProperties = {
    position: 'absolute', width: 110, height: 154,
    borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
  }
  return (
    <div style={{ position: 'relative', width: 120, height: 168 }}>
      <div style={{ ...baseCard, background: 'linear-gradient(135deg,#2A2060,#1A1040)', top: 8, left: 8, transform: 'rotate(-8deg)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} />
      <div style={{ ...baseCard, background: 'linear-gradient(135deg,#1E3A5F,#0D2240)', top: 4, left: 4, transform: 'rotate(-3deg)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
      <div style={{ ...baseCard, background: 'linear-gradient(135deg,#1A1040,#2A1060)', top: 0, left: 0, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', padding: 12 }}>
        <span style={{ background: ACCENT, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          RC PSA 10
        </span>
      </div>
    </div>
  )
}

function AddVisual({ txt2 }: { txt2: string }) {
  const { t } = useLang()
  return (
    <div style={{
      width: 130, height: 130, borderRadius: 22,
      background: `${ACCENT}15`,
      border: `2px dashed ${ACCENT}66`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <div style={{ fontSize: 44, color: ACCENT, lineHeight: 1, fontWeight: 300 }}>+</div>
      <div style={{ fontSize: 12, color: txt2, fontWeight: 600, letterSpacing: '0.3px' }}>{t('onboardm_new_card')}</div>
    </div>
  )
}
