'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadUprightImage } from '@/lib/uprightImage'

interface Candidate { id: string; nom: string; equipe: string | null; image: string; isHorizontal: boolean }
interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string
  crop_x: number; crop_y: number; crop_w: number; crop_h: number; is_horizontal: boolean
}
interface Box { x: number; y: number; w: number; h: number }

const DEFAULT_BOX: Box = { x: 0.2, y: 0.55, w: 0.5, h: 0.2 }

// Prépa du quiz "devine le joueur" (émission) : passe en revue les cartes AUTO
// basket (une par joueur, voir /api/admin/autograph-candidates), positionne la
// zone de signature (détection IA + ajustement à la main), valide. Les entrées
// validées alimentent /admin/autograph-quiz/presenter, l'outil utilisé pendant
// l'émission.
export default function AutographQuizAdminPage() {
  const [authError, setAuthError] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [approved, setApproved] = useState<QuizCard[]>([])
  const [idx, setIdx] = useState(0)
  const [box, setBox] = useState<Box>(DEFAULT_BOX)
  const [detecting, setDetecting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uprightSrc, setUprightSrc] = useState<string | null>(null)
  const [orientationOverride, setOrientationOverride] = useState<boolean | null>(null)
  const imgWrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startY: number } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setAuthError('Connecte-toi avec ton compte admin.'); setLoading(false); return }
      setToken(session.access_token)
      try {
        const [candRes, quizRes] = await Promise.all([
          fetch('/api/admin/autograph-candidates', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/admin/autograph-quiz', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ])
        if (candRes.status === 403 || quizRes.status === 403) { setAuthError('Accès réservé aux admins.'); setLoading(false); return }
        const candJson = await candRes.json()
        const quizJson = await quizRes.json()
        const approvedList: QuizCard[] = quizJson.cards || []
        setApproved(approvedList)
        const approvedNames = new Set(approvedList.map((c: QuizCard) => c.player_name.trim().toLowerCase()))
        setCandidates((candJson.candidates || []).filter((c: Candidate) => !approvedNames.has(c.nom.trim().toLowerCase())))
      } catch (e: any) {
        setAuthError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const current = candidates[idx]
  // Certaines cartes ont is_horizontal mal renseigne en base (erreur de saisie
  // sur CETTE carte precise -- pas un bug de rotation) : override local pour
  // corriger a la main sans toucher aux donnees source, reinitialise a chaque
  // nouveau candidat.
  const effectiveHorizontal = orientationOverride ?? current?.isHorizontal ?? false

  useEffect(() => {
    setBox(DEFAULT_BOX)
    setUprightSrc(null)
    setOrientationOverride(null)
  }, [current?.id])

  useEffect(() => {
    setUprightSrc(null)
    if (!current) return
    let cancelled = false
    loadUprightImage(current.image, effectiveHorizontal)
      .then(canvas => { if (!cancelled) setUprightSrc(canvas.toDataURL('image/jpeg', 0.92)) })
      .catch(e => { console.error('[autograph-quiz] upright load failed', e); if (!cancelled) setUprightSrc(current.image) })
    return () => { cancelled = true }
  }, [current?.id, effectiveHorizontal])

  const detectSignature = async () => {
    if (!current || !token) return
    setDetecting(true)
    try {
      const res = await fetch('/api/admin/detect-autograph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: current.image, rotate: effectiveHorizontal }),
      })
      const json = await res.json()
      if (res.ok && json.confidence > 0.15) {
        setBox({ x: json.x, y: json.y, w: json.w, h: json.h })
      } else {
        alert('Signature non détectée avec confiance, ajuste le cadre à la main.')
      }
    } catch (e: any) {
      alert('Erreur détection : ' + (e.message || e))
    } finally {
      setDetecting(false)
    }
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = imgWrapRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    dragRef.current = { startX: x, startY: y }
    setBox({ x, y, w: 0, h: 0 })
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const rect = imgWrapRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    const { startX, startY } = dragRef.current
    setBox({ x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(x - startX), h: Math.abs(y - startY) })
  }
  const onMouseUp = () => { dragRef.current = null }

  const validate = async () => {
    if (!current || !token || box.w < 0.02 || box.h < 0.02) { alert('Dessine une zone de signature avant de valider.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/autograph-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceCardId: current.id, playerName: current.nom, team: current.equipe,
          imageRecto: current.image, cropX: box.x, cropY: box.y, cropW: box.w, cropH: box.h,
          isHorizontal: effectiveHorizontal,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setApproved(prev => [...prev, json.card])
      setCandidates(prev => prev.filter((_, i) => i !== idx))
    } catch (e: any) {
      alert('Erreur : ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  const skip = () => setCandidates(prev => prev.filter((_, i) => i !== idx))

  const removeApproved = async (id: string) => {
    if (!token) return
    if (!confirm('Retirer cette carte du quiz ?')) return
    await fetch('/api/admin/autograph-quiz', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    setApproved(prev => prev.filter(c => c.id !== id))
  }

  const [zipping, setZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState(0)

  // Dossier d'images (1 par joueur, redressees si carte horizontale) pour la
  // tier-list -- reutilise les memes cartes que le quiz, pas une nouvelle
  // selection.
  const downloadZip = async () => {
    if (approved.length === 0) return
    setZipping(true)
    setZipProgress(0)
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const toSlug = (s: string) => (s || 'joueur').replace(/[^a-z0-9]/gi, '_').slice(0, 60)

      let done = 0
      for (const c of approved) {
        try {
          const canvas = await loadUprightImage(c.image_recto, c.is_horizontal)
          const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
          if (blob) zip.file(`${toSlug(c.player_name)}.jpg`, blob)
        } catch (e) {
          console.error('[autograph-quiz] zip: skipped', c.player_name, e)
        }
        done++
        setZipProgress(Math.round((done / approved.length) * 100))
      }

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'autographes_tierlist.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally {
      setZipping(false)
      setZipProgress(0)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (authError) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{authError}</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>🖋️ Quiz autographes</h1>
        <Link href="/admin/autograph-quiz/presenter" className="btn-main btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
          Ouvrir le présentateur →
        </Link>
      </div>

      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        {approved.length} carte(s) validée(s) · {candidates.length} candidate(s) restante(s)
      </p>

      {!current ? (
        <p style={{ textAlign: 'center', color: '#888', marginTop: 60 }}>
          {approved.length === 0 ? 'Aucun candidat trouvé (cartes AUTO basket).' : 'Toutes les candidates ont été traitées 🎉'}
        </p>
      ) : (
        <div style={{ background: 'var(--card-bg, #fff)', border: '1px solid #eee', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 4px' }}>{current.nom}</p>
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 14px' }}>{current.equipe}</p>
            </div>
            <button onClick={() => setOrientationOverride(v => !(v ?? current.isHorizontal))} className="btn-main" style={{ fontSize: 12, padding: '6px 12px' }}>
              🔄 Pivoter
            </button>
          </div>

          <div
            ref={imgWrapRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ position: 'relative', width: '100%', maxWidth: 400, margin: '0 auto', cursor: 'crosshair', userSelect: 'none' }}
          >
            {uprightSrc ? (
              <img src={uprightSrc} alt={current.nom} draggable={false} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
            ) : (
              <div style={{ aspectRatio: '2.5/3.5', background: '#eee', borderRadius: 8 }} />
            )}
            <div style={{
              position: 'absolute', left: `${box.x * 100}%`, top: `${box.y * 100}%`,
              width: `${box.w * 100}%`, height: `${box.h * 100}%`,
              border: '2px solid #e74c3c', background: 'rgba(231,76,60,0.15)', pointerEvents: 'none',
            }} />
          </div>
          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', margin: '8px 0 0' }}>
            Clique-glisse sur l'image pour dessiner/ajuster la zone de signature
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={detectSignature} disabled={detecting} className="btn-main" style={{ flex: 1, minWidth: 140 }}>
              {detecting ? 'Détection...' : '✨ Détecter (IA)'}
            </button>
            <button onClick={skip} className="btn-main" style={{ flex: 1, minWidth: 100 }}>Passer</button>
            <button onClick={validate} disabled={saving} className="btn-main btn-primary" style={{ flex: 1, minWidth: 140 }}>
              {saving ? 'Enregistrement...' : '✓ Valider'}
            </button>
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#888', textTransform: 'uppercase', margin: 0 }}>Validées</h2>
            <button onClick={downloadZip} disabled={zipping} className="btn-main" style={{ fontSize: 12, padding: '6px 14px' }}>
              {zipping ? `Préparation... ${zipProgress}%` : `📦 Dossier ZIP (${approved.length})`}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10, marginTop: 10 }}>
            {approved.map(c => (
              <div key={c.id} style={{ position: 'relative' }}>
                <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', borderRadius: 8 }}>
                  <img src={c.image_recto} alt={c.player_name} style={c.is_horizontal
                    ? { position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' }
                    : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
                  } />
                  <button onClick={() => removeApproved(c.id)} style={{
                    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', fontSize: 12, cursor: 'pointer', zIndex: 1,
                  }}>✕</button>
                </div>
                <p style={{ fontSize: 10, fontWeight: 700, margin: '4px 0 0', textAlign: 'center' }}>{c.player_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
