'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadUprightImage } from '@/lib/uprightImage'

interface CardDetails {
  rc: boolean; patch: boolean; num: string | null; annee: string | null
  marque: string | null; collection: string | null; ownerName: string | null
}
interface Candidate extends CardDetails { id: string; nom: string; equipe: string | null; image: string; isHorizontal: boolean }
interface Alternate extends CardDetails { id: string; equipe: string | null; image: string; isHorizontal: boolean }
interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string
  crop_x: number; crop_y: number; crop_w: number; crop_h: number; rotation_deg: number
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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uprightSrc, setUprightSrc] = useState<string | null>(null)
  const [rotationOverride, setRotationOverride] = useState<number | null>(null)
  const [altList, setAltList] = useState<Alternate[] | null>(null)
  const [altIdx, setAltIdx] = useState(-1)
  const [loadingAlt, setLoadingAlt] = useState(false)
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
  // Carte active affichee : celle proposee par /autograph-candidates, ou une
  // alternative choisie via "Autre carte" (doublon du meme joueur chez un
  // autre utilisateur -- utile quand la photo par defaut est floue, mal
  // cadree, ou a un is_horizontal errone en base).
  const active: Alternate | null =
    altIdx >= 0 && altList ? altList[altIdx]
    : current ? { ...current }
    : null
  // Override local en degres pour corriger l'orientation a la main sans
  // toucher aux donnees source, reinitialise a chaque nouvelle image. Bouton
  // "Pivoter" cycle +90 a chaque clic (0 -> 90 -> 180 -> 270 -> 0...).
  const baseRotation = active?.isHorizontal ? 90 : 0
  const effectiveRotation = rotationOverride ?? baseRotation

  useEffect(() => {
    setBox(DEFAULT_BOX)
    setUprightSrc(null)
    setRotationOverride(null)
    setAltList(null)
    setAltIdx(-1)
  }, [current?.id])

  useEffect(() => {
    setBox(DEFAULT_BOX)
    setRotationOverride(null)
  }, [altIdx])

  useEffect(() => {
    setUprightSrc(null)
    if (!active) return
    let cancelled = false
    loadUprightImage(active.image, effectiveRotation)
      .then(canvas => { if (!cancelled) setUprightSrc(canvas.toDataURL('image/jpeg', 0.92)) })
      .catch(e => { console.error('[autograph-quiz] upright load failed', e); if (!cancelled) setUprightSrc(active.image) })
    return () => { cancelled = true }
  }, [active?.id, effectiveRotation])

  // Pioche une autre carte AUTO du meme joueur (doublon chez un autre
  // utilisateur) -- charge la liste une seule fois puis cycle dedans.
  const findAnotherCard = async () => {
    if (!current || !token) return
    setLoadingAlt(true)
    try {
      let list = altList
      if (!list) {
        const res = await fetch(`/api/admin/autograph-alternates?name=${encodeURIComponent(current.nom)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        list = (json.alternates || []) as Alternate[]
        // La carte initiale (current) fait toujours partie du cycle, en premier.
        if (!list.some(a => a.id === current.id)) {
          list = [{ ...current }, ...list]
        }
        setAltList(list)
      }
      if (list.length <= 1) { alert('Aucune autre carte trouvée pour ce joueur.'); return }
      const curId = altIdx >= 0 ? list[altIdx].id : current.id
      const curPos = list.findIndex(a => a.id === curId)
      setAltIdx((curPos + 1) % list.length)
    } catch (e: any) {
      alert('Erreur : ' + (e.message || e))
    } finally {
      setLoadingAlt(false)
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
    if (!current || !active || !token || box.w < 0.02 || box.h < 0.02) { alert('Dessine une zone de signature avant de valider.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/autograph-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sourceCardId: active.id, playerName: current.nom, team: active.equipe,
          imageRecto: active.image, cropX: box.x, cropY: box.y, cropW: box.w, cropH: box.h,
          rotationDeg: effectiveRotation,
          rc: active.rc, patch: active.patch, num: active.num, annee: active.annee,
          marque: active.marque, collection: active.collection, ownerName: active.ownerName,
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
          const canvas = await loadUprightImage(c.image_recto, c.rotation_deg)
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
              <p style={{ color: '#888', fontSize: 13, margin: '0 0 14px' }}>{active?.equipe}</p>
            </div>
            <button onClick={() => setRotationOverride((effectiveRotation + 90) % 360)} className="btn-main" style={{ fontSize: 12, padding: '6px 12px' }}>
              🔄 Pivoter ({effectiveRotation}°)
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
            <button onClick={findAnotherCard} disabled={loadingAlt} className="btn-main" style={{ flex: 1, minWidth: 140 }}>
              {loadingAlt ? 'Recherche...' : '🔀 Autre carte'}
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
                <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', borderRadius: 8, background: '#eee' }}>
                  <UprightThumb src={c.image_recto} rotationDeg={c.rotation_deg} alt={c.player_name} />
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

function UprightThumb({ src, rotationDeg, alt }: { src: string; rotationDeg: number; alt: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    loadUprightImage(src, rotationDeg)
      .then(canvas => { if (!cancelled) setDataUrl(canvas.toDataURL('image/jpeg', 0.85)) })
      .catch(() => { if (!cancelled) setDataUrl(src) })
    return () => { cancelled = true }
  }, [src, rotationDeg])
  if (!dataUrl) return null
  return <img src={dataUrl} alt={alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
}
