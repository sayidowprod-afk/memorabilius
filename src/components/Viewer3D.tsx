'use client'
import { useRef, useCallback, useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import CardVideoExport from '@/components/CardVideoExport'
import CardValueModule from '@/components/CardValueModule'
import SameCardCollectors from '@/components/SameCardCollectors'
import CollectionTagSelect from '@/components/CollectionTagSelect'
import BookletViewer from '@/components/BookletViewer'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  isManuelle?: boolean; id_manuelle?: string; collection_tag?: string
  booklet?: boolean; il?: string; ir?: string
}

export default function Viewer3D({ popup, accent, onClose, getTags, userId, userSlug, isOwner, onCollectionTagChange, onAddToMyGallery, initialAddState }: {
  popup: Card
  accent: string
  onClose: () => void
  getTags: (d: Card) => React.ReactNode
  userId?: string
  userSlug?: string
  isOwner?: boolean
  currentUserId?: string
  onCollectionTagChange?: (card: Card, tag: string) => void
  onAddToMyGallery?: () => Promise<'added' | 'duplicate'>
  initialAddState?: 'idle' | 'added' | 'duplicate'
}) {
  const { dark } = useTheme()
  const bg = dark ? '#1a1a1a' : '#fff'
  const zoneBg = dark ? '#111' : '#f8f8f8'
  const infoBg = dark ? '#1a1a1a' : 'white'
  const textColor = dark ? '#eee' : '#111'
  const borderColor = dark ? '#2a2a2a' : '#eee'
  const metaColor = dark ? '#888' : '#999'

  const [tagInput, setTagInput] = useState(popup.collection_tag || '')
  const [tagSaving, setTagSaving] = useState(false)

  const saveTag = async () => {
    if (!onCollectionTagChange) return
    setTagSaving(true)
    await onCollectionTagChange(popup, tagInput.trim())
    setTagSaving(false)
  }

  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(1)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [showVideo, setShowVideo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slabMode, setSlabMode] = useState(false)
  const [addState, setAddState] = useState<'idle' | 'loading' | 'added' | 'duplicate'>(initialAddState ?? 'idle')
  const { lang } = useLang()

  // Parse grade: "PSA 9", "BGS 9.5", or just "9" / "10" → slab info
  const gradeInfo = (() => {
    const g = popup.g?.trim()
    if (!g || g.toLowerCase() === 'raw') return null

    const psaLabels: Record<number, string> = { 10: 'GEM MT', 9: 'MINT', 8: 'NM-MT', 7: 'NM', 6: 'EX-MT', 5: 'EX', 4: 'VG-EX', 3: 'VG', 2: 'GOOD', 1: 'POOR' }
    const colors: Record<string, { top: string; text: string; accent: string }> = {
      PSA: { top: '#c8102e', text: '#fff', accent: '#e8c840' },
      BGS: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
      SGC: { top: '#006633', text: '#fff', accent: '#fff' },
      CGC: { top: '#003399', text: '#fff', accent: '#fff' },
      BVG: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
    }

    // "PSA 9", "BGS 9.5" etc.
    const withCompany = g.match(/^(PSA|BGS|SGC|CGC|BVG)\s*([\d.]+)$/i)
    if (withCompany) {
      const company = withCompany[1].toUpperCase()
      const num = parseFloat(withCompany[2])
      const label = company === 'PSA' ? (psaLabels[num] || 'GRADED') : company === 'BGS' ? 'PRISTINE' : 'AUTHENTIC'
      return { company, grade: withCompany[2], label, color: colors[company] || colors.PSA }
    }

    // Just a number: "9", "10", "8.5"
    const numOnly = g.match(/^([\d.]+)$/)
    if (numOnly) {
      const num = parseFloat(numOnly[1])
      return { company: 'PSA', grade: numOnly[1], label: psaLabels[num] || 'GRADED', color: colors.PSA }
    }

    // Any non-raw value (e.g. "Graded", "Auth")
    return { company: 'GRADE', grade: g, label: 'CERTIFIED', color: colors.PSA }
  })()

  const handleShare = () => {
    if (!userId) return
    const url = `${window.location.origin}/galerie/${userId}?card=${encodeURIComponent(popup.f)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const applyTransform = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
    }
    if (wrapRef.current) {
      wrapRef.current.style.transform = `scale(${scale.current})`
    }
  }, [])

  const reset = useCallback(() => {
    rotX.current = 0
    rotY.current = 0
    scale.current = 1
    applyTransform()
  }, [applyTransform])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    lastX.current = e.clientX
    lastY.current = e.clientY
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  const onDoubleClick = useCallback(() => { reset() }, [reset])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001), 4)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) reset()
      lastTap.current = now
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }
  }, [reset])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touch1.current.x
      const dy = e.touches[0].clientY - touch1.current.y
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      rotY.current += dx * 0.4
      rotX.current -= dy * 0.4
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      scale.current = Math.min(Math.max(0.5, scale.current * (dist / lastDist.current)), 4)
      lastDist.current = dist
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    }
  }, [applyTransform])

  useEffect(() => {
    const prevent = (e: Event) => { if (isDragging.current) e.preventDefault() }
    document.addEventListener('selectstart', prevent)
    document.addEventListener('mouseup', () => { isDragging.current = false })
    return () => {
      document.removeEventListener('selectstart', prevent)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: bg, zIndex: 9999999,
      display: 'flex', overflow: 'hidden',
    }}>
      <style>{`
        .viewer-layout { display: flex; width: 100%; height: 100%; overflow: hidden; }
        .viewer-zone { flex: 1.2; position: relative; overflow: hidden; background: ${zoneBg}; display: flex; align-items: center; justify-content: center; perspective: 2000px; cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
        .viewer-info { flex: 0.8; padding: 30px; display: flex; flex-direction: column; justify-content: center; background: ${infoBg}; overflow-y: auto; color: ${textColor}; }
        .viewer-card { width: 560px; height: 784px; }
        @media (max-width: 1200px) { .viewer-card { width: 420px; height: 588px; } }
        @media (max-width: 600px) {
          .viewer-layout { flex-direction: column; }
          .viewer-zone { flex: 0 0 65% !important; width: 100% !important; }
          .viewer-info { flex: 1 !important; width: 100% !important; padding: 10px 14px !important; justify-content: flex-start !important; }
          .viewer-info h2 { font-size: 1rem !important; margin: 2px 0 !important; }
          .viewer-card { width: 240px !important; height: 336px !important; }
          .viewer-hint { display: none !important; }
        }
      `}</style>
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 10, fontSize: 18, cursor: 'pointer',
        background: dark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)', width: 32, height: 32, borderRadius: '50%',
        border: `1px solid ${borderColor}`, color: textColor, display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10001,
      }}>×</button>

      <div className="viewer-layout">
        {popup.booklet ? (
          <div className="viewer-zone" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <BookletViewer
              frontCover={popup.f}
              backCover={popup.b}
              interiorLeft={popup.il}
              interiorRight={popup.ir}
              accent={accent}
            />
          </div>
        ) : (
        <div className="viewer-zone"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          onTouchEnd={() => { isDragging.current = false }}
        >
          {/* Slab mode toggle */}
          {gradeInfo && (
            <button onClick={(e) => { e.stopPropagation(); setSlabMode(s => !s) }} style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              background: slabMode ? gradeInfo.color.top : 'rgba(0,0,0,0.45)',
              color: 'white', border: 'none', borderRadius: 20, padding: '6px 14px',
              fontWeight: 800, fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: '0.2s',
            }}>
              {slabMode ? '🃏 Carte seule' : `🏅 Slab ${gradeInfo.company}`}
            </button>
          )}

          <div ref={wrapRef} style={{ willChange: 'transform' }}>
            {slabMode && gradeInfo ? (
              /* ── SLAB VIEW ── */
              (() => {
                const isPSA = gradeInfo.company === 'PSA' || gradeInfo.company === 'GRADE'
                const isBGS = gradeInfo.company === 'BGS' || gradeInfo.company === 'BVG'
                const isSGC = gradeInfo.company === 'SGC'
                const isCGC = gradeInfo.company === 'CGC'
                // Deterministic cert number from card data
                const certSeed = (popup.n + popup.y + popup.s).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const certNum = String((certSeed * 7919 + 10000000) % 90000000 + 10000000).slice(0, 8)
                const setLine = [popup.y, popup.br, popup.s].filter(Boolean).join(' ').toUpperCase()

                return (
                  <div ref={cardRef} style={{ position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform' }}>
                    <style>{`
                      .slb-wrap {
                        width: 300px;
                        border-radius: 5px; overflow: hidden;
                        box-shadow:
                          0 0 0 2px rgba(255,255,255,0.6),
                          0 0 0 14px rgba(200,218,242,0.75),
                          0 0 0 16px rgba(165,190,220,0.5),
                          0 30px 80px rgba(0,0,0,0.7),
                          inset 0 0 20px rgba(255,255,255,0.15);
                        background: linear-gradient(160deg,rgba(235,243,255,0.5) 0%,rgba(210,228,248,0.45) 60%,rgba(195,218,242,0.5) 100%);
                      }
                      @media (max-width:1200px) { .slb-wrap { width:250px; } }
                      @media (max-width:600px)  { .slb-wrap { width:190px; } }
                      .slb-win { background:#0a0a0a; padding:7px; }
                      .slb-win-inner {
                        width:100%; aspect-ratio:5/7; overflow:hidden; border-radius:2px;
                        box-shadow:inset 0 0 12px rgba(0,0,0,0.7);
                      }
                      .slb-win-inner img { width:100%; height:100%; object-fit:cover; display:block; }

                      /* ── PSA ── */
                      .psa-lbl { background:#fff; border-bottom:1px solid #ddd; font-family:'Arial',sans-serif; }
                      .psa-body { padding:6px 10px 4px 10px; display:flex; justify-content:space-between; align-items:stretch; }
                      .psa-left { flex:1; display:flex; flex-direction:column; justify-content:center; gap:1px; min-width:0; }
                      .psa-set  { font-size:7.5px; font-weight:700; color:#333; letter-spacing:0.4px; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                      .psa-name { font-size:11px; font-weight:900; color:#111; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                      .psa-var  { font-size:7.5px; font-weight:600; color:#555; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                      .psa-right { display:flex; flex-direction:column; align-items:flex-end; justify-content:center; padding-left:8px; flex-shrink:0; }
                      .psa-gname { font-size:8px; font-weight:800; color:#222; letter-spacing:1px; text-transform:uppercase; text-align:right; }
                      .psa-gnum  { font-size:38px; font-weight:900; color:#111; line-height:1; text-align:right; }
                      .psa-bar  { background:#1c1c1c; display:flex; align-items:center; justify-content:space-between; padding:4px 8px 4px 8px; gap:6px; }
                      .psa-badge { background:#c8102e; color:#fff; font-weight:900; font-size:10px; padding:2px 7px; border-radius:2px; letter-spacing:1.5px; flex-shrink:0; }
                      .psa-bc   { flex:1; font-family:monospace; font-size:18px; color:rgba(255,255,255,0.6); letter-spacing:-3px; overflow:hidden; text-align:center; }
                      .psa-cert { font-size:7.5px; color:rgba(255,255,255,0.65); font-weight:700; letter-spacing:0.5px; flex-shrink:0; }

                      /* ── BGS ── */
                      .bgs-lbl { background:#f7f4ea; border-bottom:1px solid #d4c98a; font-family:'Arial',sans-serif; display:flex; align-items:stretch; }
                      .bgs-b { width:38px; background:#1a1a1a; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                      .bgs-b-letter { font-size:26px; font-weight:900; color:#e8c840; letter-spacing:-1px; font-style:italic; line-height:1; }
                      .bgs-main { flex:1; padding:5px 8px; display:flex; align-items:stretch; gap:4px; min-width:0; }
                      .bgs-info { flex:1; display:flex; flex-direction:column; justify-content:center; gap:1px; min-width:0; }
                      .bgs-set  { font-size:7px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                      .bgs-name { font-size:10px; font-weight:900; color:#111; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                      .bgs-var  { font-size:7px; font-weight:600; color:#666; text-transform:uppercase; }
                      .bgs-cert { font-size:6.5px; font-weight:700; color:#888; letter-spacing:0.3px; margin-top:2px; }
                      .bgs-grade { display:flex; flex-direction:column; align-items:center; justify-content:center; flex-shrink:0; padding:0 4px; border-left:1px solid #d4c98a; }
                      .bgs-gnum { font-size:32px; font-weight:900; color:#1a1a1a; line-height:1; }
                      .bgs-gname { font-size:6px; font-weight:800; color:#1a1a1a; letter-spacing:0.5px; text-transform:uppercase; text-align:center; }

                      /* ── SGC ── */
                      .sgc-lbl { background:#fff; border-bottom:1px solid #ccc; font-family:'Arial',sans-serif; display:flex; align-items:stretch; }
                      .sgc-side { width:36px; background:#006633; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
                      .sgc-logo { font-size:13px; font-weight:900; color:#fff; letter-spacing:1px; writing-mode:vertical-rl; text-orientation:mixed; transform:rotate(180deg); }
                      .sgc-body { flex:1; padding:5px 8px; display:flex; justify-content:space-between; align-items:center; min-width:0; }
                      .sgc-info { flex:1; min-width:0; }
                      .sgc-set  { font-size:7.5px; font-weight:700; color:#333; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                      .sgc-name { font-size:11px; font-weight:900; color:#111; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                      .sgc-var  { font-size:7px; color:#555; text-transform:uppercase; }
                      .sgc-cert { font-size:6.5px; color:#aaa; margin-top:2px; font-weight:700; }
                      .sgc-gbox { background:#006633; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px 10px; flex-shrink:0; border-radius:3px; margin-left:6px; }
                      .sgc-gnum { font-size:30px; font-weight:900; color:#fff; line-height:1; }
                      .sgc-gname { font-size:6px; font-weight:800; color:rgba(255,255,255,0.8); text-transform:uppercase; letter-spacing:0.5px; }

                      /* ── CGC ── */
                      .cgc-lbl { background:#fff; border-bottom:2px solid #003399; font-family:'Arial',sans-serif; }
                      .cgc-top { background:#003399; padding:4px 10px; display:flex; justify-content:space-between; align-items:center; }
                      .cgc-brand { font-size:13px; font-weight:900; color:#fff; letter-spacing:2px; }
                      .cgc-gnum  { font-size:22px; font-weight:900; color:#fff; line-height:1; }
                      .cgc-body  { padding:4px 10px; display:flex; justify-content:space-between; align-items:center; }
                      .cgc-info  { flex:1; min-width:0; }
                      .cgc-set   { font-size:7.5px; font-weight:700; color:#333; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                      .cgc-name  { font-size:11px; font-weight:900; color:#111; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                      .cgc-var   { font-size:7px; color:#555; text-transform:uppercase; }
                      .cgc-gname { font-size:8px; font-weight:800; color:#003399; text-align:right; }
                      .cgc-cert  { font-size:6.5px; color:#aaa; font-weight:700; text-align:right; }
                    `}</style>

                    <div className="slb-wrap">
                      {/* ── PSA label ── */}
                      {isPSA && (
                        <div className="psa-lbl">
                          <div className="psa-body">
                            <div className="psa-left">
                              <span className="psa-set">{setLine}</span>
                              <span className="psa-name">{popup.n.toUpperCase()}</span>
                              {popup.v && <span className="psa-var">{popup.v.toUpperCase()}</span>}
                            </div>
                            <div className="psa-right">
                              <span className="psa-gname">{gradeInfo.label}</span>
                              <span className="psa-gnum">{gradeInfo.grade}</span>
                            </div>
                          </div>
                          <div className="psa-bar">
                            <span className="psa-badge">PSA</span>
                            <span className="psa-bc">{'|'+'||'+'|||'+'||'+'|||||'+'||'+'|||'+'|'}</span>
                            <span className="psa-cert">{certNum}</span>
                          </div>
                        </div>
                      )}

                      {/* ── BGS/Beckett label ── */}
                      {isBGS && (
                        <div className="bgs-lbl">
                          <div className="bgs-b"><span className="bgs-b-letter">B</span></div>
                          <div className="bgs-main">
                            <div className="bgs-info">
                              <span className="bgs-set">{setLine}</span>
                              <span className="bgs-name">{popup.n.toUpperCase()}</span>
                              {popup.v && <span className="bgs-var">{popup.v.toUpperCase()}</span>}
                              <span className="bgs-cert">{certNum}</span>
                            </div>
                            <div className="bgs-grade">
                              <span className="bgs-gnum">{gradeInfo.grade}</span>
                              <span className="bgs-gname">{gradeInfo.label}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── SGC label ── */}
                      {isSGC && (
                        <div className="sgc-lbl">
                          <div className="sgc-side"><span className="sgc-logo">SGC</span></div>
                          <div className="sgc-body">
                            <div className="sgc-info">
                              <span className="sgc-set">{setLine}</span>
                              <span className="sgc-name">{popup.n.toUpperCase()}</span>
                              {popup.v && <span className="sgc-var">{popup.v.toUpperCase()}</span>}
                              <div className="sgc-cert">{certNum}</div>
                            </div>
                            <div className="sgc-gbox">
                              <span className="sgc-gnum">{gradeInfo.grade}</span>
                              <span className="sgc-gname">{gradeInfo.label}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── CGC label ── */}
                      {isCGC && (
                        <div className="cgc-lbl">
                          <div className="cgc-top">
                            <span className="cgc-brand">CGC</span>
                            <span className="cgc-gnum">{gradeInfo.grade}</span>
                          </div>
                          <div className="cgc-body">
                            <div className="cgc-info">
                              <span className="cgc-set">{setLine}</span>
                              <span className="cgc-name">{popup.n.toUpperCase()}</span>
                              {popup.v && <span className="cgc-var">{popup.v.toUpperCase()}</span>}
                            </div>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',flexShrink:0,paddingLeft:6}}>
                              <span className="cgc-gname">{gradeInfo.label}</span>
                              <span className="cgc-cert">{certNum}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* card window */}
                      <div className="slb-win">
                        <div className="slb-win-inner">
                          <img src={popup.f} draggable={false} alt={popup.n} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()
            ) : (
              /* ── CARD VIEW (original) ── */
              <div ref={cardRef} className="viewer-card" style={{
                position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform',
              }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <img src={popup.f} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={popup.n} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <img src={popup.b} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={popup.n} />
                </div>
              </div>
            )}
          </div>
          <p className="viewer-hint" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Glisser · Scroll pour zoomer · Double-clic pour reset
          </p>
        </div>
        )}

        <div className="viewer-info">
          <div style={{ color: accent, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>{popup.t}</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '3px 0' }}>{popup.n}</h2>
          <div style={{ fontSize: '0.9rem', color: accent, fontWeight: 700, marginBottom: 8, fontStyle: 'italic' }}>{popup.v}</div>
          {getTags(popup)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: `1px solid ${borderColor}`, marginTop: 10, paddingTop: 10 }}>
            {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
              <div key={l}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>{l}</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Ma collection (tag) — owner seulement */}
          {isOwner && onCollectionTagChange && userId && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase', marginBottom: 5 }}>
                Ma collection
              </label>
              <CollectionTagSelect
                userId={userId}
                value={tagInput}
                onChange={async (tag) => {
                  setTagInput(tag)
                  setTagSaving(true)
                  await onCollectionTagChange(popup, tag)
                  setTagSaving(false)
                }}
              />
            </div>
          )}

          {/* Boutons actions */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowVideo(true)} style={{
              flex: 1, background: '#0d0d1f', color: 'white', border: 'none',
              borderRadius: 10, padding: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 14,
            }}>
              🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export as video'}
            </button>
            {userId && (
              <button onClick={handleShare} style={{
                background: copied ? '#2e7d32' : (dark ? '#2a2a2a' : '#f0f0f0'), color: copied ? 'white' : (dark ? '#eee' : '#333'),
                border: 'none', borderRadius: 10, padding: '12px 14px',
                fontWeight: 800, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
                transition: '0.2s',
              }}>
                {copied ? '✓ Copié' : '🔗 Partager'}
              </button>
            )}
          </div>

          {/* Ajouter à ma galerie — visiteur connecté seulement */}
          {!isOwner && onAddToMyGallery && (
            <div style={{ marginTop: 10 }}>
              <button
                disabled={addState === 'loading' || addState === 'added' || addState === 'duplicate'}
                onClick={async () => {
                  setAddState('loading')
                  const result = await onAddToMyGallery()
                  setAddState(result)
                }}
                style={{
                  width: '100%', border: 'none', borderRadius: 10, padding: '12px',
                  fontWeight: 800, cursor: addState === 'idle' ? 'pointer' : 'default', fontSize: 14,
                  background: addState === 'added' ? '#2e7d32' : addState === 'duplicate' ? (dark ? '#2a2a2a' : '#f0f0f0') : '#003DA6',
                  color: addState === 'duplicate' ? (dark ? '#aaa' : '#666') : 'white',
                  transition: '0.2s',
                }}
              >
                {addState === 'loading' ? '...' : addState === 'added' ? (lang === 'fr' ? '✓ Ajoutée à ta galerie !' : '✓ Added to your gallery!') : addState === 'duplicate' ? (lang === 'fr' ? 'Déjà dans ta galerie' : 'Already in your gallery') : (lang === 'fr' ? '+ J\'ai cette carte' : '+ I have this card')}
              </button>
            </div>
          )}

          <CardValueModule
            cardName={popup.n}
            set={`${popup.br} ${popup.s}`.trim()}
            year={popup.y}
            num={popup.num}
            variant={popup.v}
            rc={popup.rc}
            auto={popup.auto}
            patch={popup.patch}
            accent={accent}
            img={popup.f}
          />

          {popup.n && (
            <SameCardCollectors
              cardName={popup.n}
              year={popup.y}
              brand={popup.br}
              set={popup.s}
              variant={popup.v}
              num={popup.num}
              rc={popup.rc}
              auto={popup.auto}
              patch={popup.patch}
              excludeUserId={userId}
              accent={accent}
            />
          )}

          {showVideo && <CardVideoExport card={popup} accent={accent} onClose={() => setShowVideo(false)} />}
        </div>
      </div>
    </div>
  )
}
