'use client'
import { toast } from '@/lib/toast'
import { useState, use, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import CardScanner from '@/components/CardScanner'
import CameraCapture from '@/components/CameraCapture'
import CollectionTagSelect from '@/components/CollectionTagSelect'
import { SELECTABLE_FORMATS, getFormat } from '@/lib/cardFormats'
import BinderLibrary from '@/components/BinderLibrary'

const CARD_RATIO = 2.5 / 3.5
const ACCENT = '#003DA6'

// Réduit une photo importée à ~1600px max avant de la manipuler. Une photo de
// téléphone (12 Mpx) décodée en plusieurs bitmaps pleine résolution (scanner +
// OpenCV + Gemini) saturait la mémoire et faisait crasher le navigateur mobile
// vers la 3e photo. 1600px suffit largement pour la détection et le recadrage.
function downscaleToDataURL(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const dataUrl = c.toDataURL('image/jpeg', 0.9)
      c.width = 0; c.height = 0 // libère le backing store
      resolve(dataUrl)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image illisible')) }
    img.src = url
  })
}

// Marques connues (pour séparer marque / collection dans une désignation Beckett).
// Ordre : les libellés les plus longs d'abord pour matcher « Upper Deck » avant « UD ».
const KNOWN_BRANDS: { match: RegExp; brand: string }[] = [
  { match: /^upper\s+deck/i, brand: 'Upper Deck' },
  { match: /^ud\b/i,          brand: 'Upper Deck' },
  { match: /^o-?pee-?chee/i,  brand: 'O-Pee-Chee' },
  { match: /^panini/i,        brand: 'Panini' },
  { match: /^topps/i,         brand: 'Topps' },
  { match: /^bowman/i,        brand: 'Bowman' },
  { match: /^donruss/i,       brand: 'Donruss' },
  { match: /^fleer/i,         brand: 'Fleer' },
  { match: /^score/i,         brand: 'Score' },
  { match: /^leaf/i,          brand: 'Leaf' },
  { match: /^sage/i,          brand: 'Sage' },
  { match: /^futera/i,        brand: 'Futera' },
  { match: /^pinnacle/i,      brand: 'Pinnacle' },
  { match: /^sp\b/i,          brand: 'SP' },
]

// Décompose une désignation type Beckett en champs.
// Ex : « 2007-08 UD Black 50th Anniversary Autographs #BR Bill Russell »
//   → année 2007-08 · marque Upper Deck · collection « Black 50th Anniversary Autographs »
//   · n° BR · joueur Bill Russell · auto ✓
function parseDesignation(raw: string) {
  const out: {
    annee?: string; marque?: string; collection?: string; nom?: string
    card_number?: string; num?: string; auto?: boolean; rc?: boolean; patch?: boolean; printing_plate?: boolean
  } = {}
  let s = ` ${raw.trim().replace(/\s+/g, ' ')} `

  // Numérotation (ex : 25/99)
  const numMatch = s.match(/\b(\d{1,5}\/\d{1,5})\b/)
  if (numMatch) { out.num = numMatch[1]; s = s.replace(numMatch[0], ' ') }

  // N° de carte (#BR, #1, #HTR-IFS…)
  const cardMatch = s.match(/#\s*([A-Za-z0-9][A-Za-z0-9-]*)/)
  let hashIndex = -1
  if (cardMatch) { out.card_number = cardMatch[1]; hashIndex = cardMatch.index ?? -1 }

  // Année en tête (2023, 2007-08, 2007-2008)
  const yearMatch = s.match(/\b((?:19|20)\d{2}(?:-\d{2,4})?)\b/)
  let afterYearIndex = 0
  if (yearMatch) { out.annee = yearMatch[1]; afterYearIndex = (yearMatch.index ?? 0) + yearMatch[0].length }

  // Caractéristiques
  if (/\bauto(?:graph)?s?\b/i.test(s)) out.auto = true
  if (/\brookie\b|\brc\b|\byrc\b/i.test(s)) out.rc = true
  if (/\bpatch\b/i.test(s)) out.patch = true
  if (/\bprinting\s+plate\b|\bprint\s+plate\b|\bplate\b/i.test(s)) out.printing_plate = true

  // Bloc « marque + collection » : entre l'année et le #
  const midEnd = hashIndex >= 0 ? hashIndex : s.length
  let mid = s.slice(afterYearIndex, midEnd).replace(/#.*/, '').trim()
  // Retire une numérotation résiduelle du bloc
  mid = mid.replace(/\b\d{1,5}\/\d{1,5}\b/g, '').trim()

  for (const b of KNOWN_BRANDS) {
    if (b.match.test(mid)) {
      out.marque = b.brand
      const rest = mid.replace(b.match, '').trim()
      if (rest) out.collection = rest
      break
    }
  }
  if (!out.marque && mid) out.collection = mid

  // Joueur : texte après le # (hors n° de carte). Beckett place le joueur en fin.
  if (hashIndex >= 0 && cardMatch) {
    const afterHash = s.slice(hashIndex + cardMatch[0].length)
    let player = afterHash
      .replace(/\b\d{1,5}\/\d{1,5}\b/g, '')
      .replace(/\bprinting\s+plate\b|\bprint\s+plate\b/gi, '')
      .replace(/\b(auto(?:graph)?s?|rookie|rc|yrc|patch|plate|mem|relic|serial|numbered)\b/gi, '')
      .replace(/\s+/g, ' ').trim()
    // Garde jusqu'à ~4 mots (nom + prénom, éventuel Jr./III)
    if (player) out.nom = player.split(' ').slice(0, 4).join(' ')
  }

  return out
}

function ImageUploader({ side, label, preview, uploading, aspect, lang, onClear, onFileChange, onCameraClick }: {
  side: 'recto' | 'verso' | 'il' | 'ir'; label: string; preview: string | null; uploading: boolean; aspect?: string
  lang: string; onClear: () => void; onFileChange: (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso' | 'il' | 'ir') => void; onCameraClick: (side: 'recto' | 'verso' | 'il' | 'ir') => void
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{label}</label>
      <div
        style={{ border: '2px dashed #ddd', borderRadius: 12, overflow: 'hidden', aspectRatio: aspect || '2.5/3.5', position: 'relative', cursor: 'pointer', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => document.getElementById(`upload-${side}`)?.click()}
      >
        {preview ? (
          <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={label} />
        ) : (
          <div style={{ textAlign: 'center', color: '#bbb', padding: 10 }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
            <p style={{ fontSize: 12, fontWeight: 600, margin: 0 }}>{uploading ? '...' : (lang === 'fr' ? 'Cliquer pour ajouter' : 'Click to add')}</p>
          </div>
        )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', fontWeight: 700 }}>Upload...</div>
          </div>
        )}
      </div>
      <input id={`upload-${side}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onFileChange(e, side)} />
      {!preview && !uploading && (
        <button type="button"
          onClick={() => onCameraClick(side)}
          style={{ marginTop: 6, width: '100%', background: '#f0f4ff', color: '#003DA6', border: 'none', borderRadius: 6, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'fr' ? '📸 Prendre une photo' : '📸 Take a photo'}
        </button>
      )}
      {preview && (
        <button type="button" onClick={onClear}
          style={{ marginTop: 6, width: '100%', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'fr' ? '🗑️ Supprimer' : '🗑️ Remove'}
        </button>
      )}
    </div>
  )
}

export default function AjouterCarte({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const { lang } = useLang()
  const [saving, setSaving] = useState(false)
  const [showDesignation, setShowDesignation] = useState(false)
  const [designation, setDesignation] = useState('')
  const [designationDone, setDesignationDone] = useState(false)
  const [uploadingRecto, setUploadingRecto] = useState(false)
  const [uploadingVerso, setUploadingVerso] = useState(false)
  const [previewRecto, setPreviewRecto] = useState<string | null>(null)
  const [previewVerso, setPreviewVerso] = useState<string | null>(null)
  const [previewIL, setPreviewIL] = useState<string | null>(null)
  const [previewIR, setPreviewIR] = useState<string | null>(null)
  const [uploadingIL, setUploadingIL] = useState(false)
  const [uploadingIR, setUploadingIR] = useState(false)
  const [form, setForm] = useState({
    nom: '', equipe: '', annee: '', marque: '', collection: '', variation: '',
    grade: 'Raw', cert_number: '', num: '', card_number: '', rc: false, auto: false, patch: false, printing_plate: false, booklet: false,
    is_horizontal: false, format: 'standard', collection_tag: '', disponible_vente: false,
    image_recto: '', image_verso: '', image_interieur_gauche: '', image_interieur_droite: '',
    verso_is_horizontal: null as boolean | null, // null = même orientation que le recto
  })

  type Side = 'recto' | 'verso' | 'il' | 'ir'
  const [scannerModal, setScannerModal] = useState<{ side: Side; src: string; frameRect?: { x: number; y: number; w: number; h: number } } | null>(null)
  const [cameraModal, setCameraModal] = useState<Side | null>(null)
  const [cropModal, setCropModal] = useState<{ side: Side; src: string } | null>(null)
  const [rotation, setRotation] = useState(0)

  // Image pan/zoom state (image moves under fixed frame)
  const [imgTransform, setImgTransform] = useState({ x: 0, y: 0, scale: 1 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Touch/drag refs
  const lastPointer = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const isDragging = useRef(false)
  const rotationRef = useRef(rotation)
  useEffect(() => { rotationRef.current = rotation }, [rotation])
  const cropRatioRef = useRef(CARD_RATIO)
  const isHorizontalRef = useRef(false)
  useEffect(() => { isHorizontalRef.current = form.format === 'horizontal' || form.is_horizontal }, [form.format, form.is_horizontal])

  const resetTransform = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return
    const img = imgRef.current
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight

    const frameW = cropRatioRef.current > 1
      ? Math.min(cw * 0.90, ch * 0.82 * cropRatioRef.current)
      : Math.min(cw * 0.82, ch * 0.90 * cropRatioRef.current)
    const frameH = frameW / cropRatioRef.current

    const angleRad = (rotationRef.current * Math.PI) / 180
    const absCos = Math.abs(Math.cos(angleRad))
    const absSin = Math.abs(Math.sin(angleRad))

    const displayW = img.width
    const displayH = img.height

    const scaleW = frameW / (displayW * absCos + displayH * absSin)
    const scaleH = frameH / (displayW * absSin + displayH * absCos)
    const scale = Math.max(scaleW, scaleH)

    setImgTransform({ x: 0, y: 0, scale })
  }, [])

  useEffect(() => {
    if (scannerModal && (scannerModal.side === 'il' || scannerModal.side === 'ir')) {
      setCropModal({ side: scannerModal.side, src: scannerModal.src })
      setRotation(0)
      setImgTransform({ x: 0, y: 0, scale: 1 })
      setScannerModal(null)
    }
  }, [scannerModal])

  useEffect(() => {
    if (cropModal) {
      const side = cropModal.side
      const rectoHorizontal = form.format === 'horizontal' || form.is_horizontal
      const wantHorizontal = side === 'il' || side === 'ir' ? true
        : side === 'verso' ? (form.verso_is_horizontal ?? rectoHorizontal)
        : rectoHorizontal
      isHorizontalRef.current = wantHorizontal
      cropRatioRef.current = (side === 'il' || side === 'ir' || wantHorizontal) ? 3.5 / 2.5 : getFormat(form.format).cropRatio
      setImgTransform({ x: 0, y: 0, scale: 1 })
    }
  }, [cropModal])

  useEffect(() => {
    if (cropModal && imgRef.current?.complete) {
      resetTransform()
    }
  }, [cropModal, resetTransform])

  // Wheel zoom sans scroll de page (passive: false obligatoire)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !cropModal) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * delta)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [cropModal])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso' | 'il' | 'ir') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const src = await downscaleToDataURL(file)
      if (side === 'il' || side === 'ir') {
        setCropModal({ side, src })
        setRotation(0)
        setImgTransform({ x: 0, y: 0, scale: 1 })
      } else {
        setScannerModal({ side, src })
      }
    } catch {
      toast.error(lang === 'fr' ? 'Image illisible, réessayez.' : 'Unreadable image, please retry.')
    }
  }

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  type DupCard = { id: string; nom: string; annee: number | null; marque: string | null; num: string | null; image_recto: string | null }
  const [dupWarning, setDupWarning] = useState<{ cards: DupCard[]; userId: string } | null>(null)
  const rectoBase64Ref = useRef<string | null>(null)
  // Après l'insertion : propose de ranger la carte dans un classeur de la bibliothèque
  const [binderPrompt, setBinderPrompt] = useState<{ userId: string; img: string; nom: string } | null>(null)
  const [showBinderPicker, setShowBinderPicker] = useState(false)

  // Détecte l'orientation réelle de l'image (fiable quelle que soit la source : recadrage
  // manuel avec le toggle dédié, ou scan auto par CardScanner où les coins ajustés par
  // l'utilisateur peuvent produire un rendu à l'horizontale sans passer par ce toggle).
  const detectBlobOrientation = (blob: Blob): Promise<boolean> => {
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > img.naturalHeight) }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false) }
      img.src = url
    })
  }

  const uploadBlob = async (blob: Blob, side: 'recto' | 'verso' | 'il' | 'ir') => {
    if (side === 'recto') setUploadingRecto(true)
    else if (side === 'verso') setUploadingVerso(true)
    else if (side === 'il') setUploadingIL(true)
    else setUploadingIR(true)
    setScannerModal(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false)
      router.push('/connexion')
      return
    }

    const path = `cartes/${user.id}/${Date.now()}_${side}.jpg`
    const file = new File([blob], `${Date.now()}_${side}.jpg`, { type: 'image/jpeg' })
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { toast.error('Erreur upload : ' + error.message); setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false); return }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl
    if (side === 'recto') { setForm(f => ({ ...f, image_recto: url })); setPreviewRecto(url); setUploadingRecto(false); analyzeCard(blob, false) }
    else if (side === 'verso') {
      const versoHorizontal = await detectBlobOrientation(blob)
      setForm(f => ({ ...f, image_verso: url, verso_is_horizontal: versoHorizontal }))
      setPreviewVerso(url); setUploadingVerso(false); analyzeCard(blob, true, rectoBase64Ref.current)
    }
    else if (side === 'il') { setForm(f => ({ ...f, image_interieur_gauche: url })); setPreviewIL(url); setUploadingIL(false) }
    else { setForm(f => ({ ...f, image_interieur_droite: url })); setPreviewIR(url); setUploadingIR(false) }
  }

  const analyzeCard = async (blob: Blob, isVerso = false, rectoBase64?: string | null) => {
    setScanning(true)
    setScanError(null)
    try {
      const base64 = await new Promise<string>(res => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })

      // Stocker le recto pour usage futur avec le verso
      if (!isVerso) rectoBase64Ref.current = base64

      // Si c'est le verso ET qu'on a le recto → envoyer les deux ensemble
      const body = isVerso && rectoBase64
        ? { imageBase64: rectoBase64, imageBase64Verso: base64, mimeType: 'image/jpeg' }
        : { imageBase64: base64, mimeType: 'image/jpeg' }

      const { data: { session: scanSession } } = await supabase.auth.getSession()

      // Recto uniquement : recherche eBay visuelle (max 3s) pour obtenir des titres de contexte
      // Les titres eBay contiennent souvent l'année, le set et la variation exacts
      let ebayHints: string[] = []
      if (!isVerso && scanSession) {
        try {
          const ebayRes = await Promise.race([
            fetch('/api/ebay-image-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${scanSession.access_token}` },
              body: JSON.stringify({ imageBase64: base64 }),
            }).then(r => r.json()),
            new Promise<null>(r => setTimeout(() => r(null), 3000)),
          ])
          if (ebayRes?.items?.length) {
            ebayHints = (ebayRes.items as { title: string }[]).slice(0, 5).map(i => i.title).filter(Boolean)
          }
        } catch { /* non-fatal */ }
      }

      const resp = await fetch('/api/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scanSession?.access_token}` },
        body: JSON.stringify({ ...body, ebayHints }),
      })
      const card = await resp.json()
      if (!resp.ok || card.error) {
        setScanError(card.error || `Erreur ${resp.status}`)
        return
      }
      setForm(f => ({
        ...f,
        // Verso avec recto : toujours écraser variation/collection/num (le verso fait autorité)
        // Verso seul (sans recto) : ne remplir que les champs vides
        nom:        (isVerso && !rectoBase64 && f.nom)        ? f.nom        : card.nom        || f.nom,
        equipe:     (isVerso && !rectoBase64 && f.equipe)     ? f.equipe     : card.equipe     || f.equipe,
        annee:      (isVerso && !rectoBase64 && f.annee)      ? f.annee      : card.annee      || f.annee,
        marque:     (isVerso && !rectoBase64 && f.marque)     ? f.marque     : card.marque     || f.marque,
        collection: card.collection || f.collection,
        variation:  card.variation  !== undefined ? card.variation : f.variation,
        num:         card.num         || f.num,
        card_number: card.card_number || f.card_number,
        grade:      (isVerso && !rectoBase64 && f.grade !== 'Raw') ? f.grade : card.grade || f.grade,
        rc:         f.rc   || (card.rc   ?? false),
        auto:       f.auto || (card.auto ?? false),
        patch:      f.patch || (card.patch ?? false),
      }))
    } catch (e: any) {
      setScanError(e.message)
    } finally {
      setScanning(false)
    }
  }

  const getDist = (touches: React.TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastPointer.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPointer.current.x
    const dy = e.clientY - lastPointer.current.y
    lastPointer.current = { x: e.clientX, y: e.clientY }
    setImgTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
  }

  const handleMouseUp = () => { isDragging.current = false }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      isDragging.current = false
      lastDist.current = getDist(e.touches)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPointer.current.x
      const dy = e.touches[0].clientY - lastPointer.current.y
      lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setImgTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }))
    } else if (e.touches.length === 2) {
      const dist = getDist(e.touches)
      const delta = dist / lastDist.current
      lastDist.current = dist
      setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, t.scale * delta)) }))
    }
  }

  const handleTouchEnd = () => { isDragging.current = false }

  const applyCropAndUpload = async () => {
    if (!cropModal || !containerRef.current || !imgRef.current) return
    const side = cropModal.side
    const cropRatio = cropRatioRef.current
    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight
    const isH = cropRatio > 1
    const frameW = isH
      ? Math.min(cw * 0.90, ch * 0.82 * cropRatio)
      : Math.min(cw * 0.82, ch * 0.90 * cropRatio)
    const frameH = frameW / cropRatio

    const img = imgRef.current
    const angleRad = (rotation * Math.PI) / 180

    // Reproduire l'état visuel du cadre sur un canvas intermédiaire de la taille du container
    // puis extraire le rectangle du cadre à pleine résolution
    const frameX = (cw - frameW) / 2
    const frameY = (ch - frameH) / 2

    // pixelScale : ratio pixels naturels / pixels CSS, plafonné à 2× le final (600px max → 1200px)
    const cssDisplayedW = img.naturalWidth * imgTransform.scale
    const rawPixelScale = img.naturalWidth / cssDisplayedW
    const pixelScale = Math.min(rawPixelScale, 1200 / frameW)

    const outCanvas = document.createElement('canvas')
    outCanvas.width = Math.round(frameW * pixelScale)
    outCanvas.height = Math.round(frameH * pixelScale)
    const outCtx = outCanvas.getContext('2d')!

    // Même transform que le CSS (translate + rotate + scale), décalé pour ne montrer que le cadre
    outCtx.translate(
      (cw / 2 + imgTransform.x - frameX) * pixelScale,
      (ch / 2 + imgTransform.y - frameY) * pixelScale
    )
    outCtx.rotate(angleRad)
    outCtx.scale(imgTransform.scale * pixelScale, imgTransform.scale * pixelScale)
    outCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

    const finalCanvas = document.createElement('canvas')
    const isLandscape = side === 'il' || side === 'ir' || isHorizontalRef.current
    finalCanvas.width = isLandscape ? 840 : 600
    finalCanvas.height = isLandscape ? 600 : 840
    const finalCtx = finalCanvas.getContext('2d')!
    finalCtx.drawImage(outCanvas, 0, 0, finalCanvas.width, finalCanvas.height)

    setCropModal(null)

    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setUploadingRecto(false); setUploadingVerso(false); setUploadingIL(false); setUploadingIR(false); return }
      await uploadBlob(blob, side)
    }, 'image/jpeg', 0.88)
  }

  const resetForm = () => {
    setForm({
      nom: '', equipe: '', annee: '', marque: '', collection: '', variation: '',
      grade: 'Raw', cert_number: '', num: '', card_number: '', rc: false, auto: false, patch: false, printing_plate: false, booklet: false,
      is_horizontal: false, format: 'standard', collection_tag: '', disponible_vente: false,
      image_recto: '', image_verso: '', image_interieur_gauche: '', image_interieur_droite: '',
      verso_is_horizontal: null,
    })
    setPreviewRecto(null); setPreviewVerso(null); setPreviewIL(null); setPreviewIR(null)
    setBinderPrompt(null); setShowBinderPicker(false)
    setDesignation(''); setDesignationDone(false); setShowDesignation(false)
    setScanError(null); rectoBase64Ref.current = null
  }

  const doInsert = async (uid: string) => {
    const { error } = await supabase.from('cartes_manuelles').insert({
      user_id: uid, nom: form.nom, equipe: form.equipe || null, annee: form.annee || null,
      marque: form.marque || null, collection: form.collection || null, variation: form.variation || null, grade: form.grade,
      num: form.num || null, card_number: form.card_number || null, cert_number: form.cert_number || null,
      rc: form.rc, auto: form.auto, patch: form.patch, printing_plate: form.printing_plate, booklet: form.booklet,
      format: form.format || 'standard',
      is_horizontal: form.format === 'horizontal',
      verso_is_horizontal: form.verso_is_horizontal,
      image_recto: form.image_recto || null, image_verso: form.image_verso || null,
      image_interieur_gauche: form.image_interieur_gauche || null,
      image_interieur_droite: form.image_interieur_droite || null,
      collection_tag: form.collection_tag || null,
      disponible_vente: form.disponible_vente,
    })
    if (error) { toast.error('Erreur : ' + error.message); setSaving(false); return }
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/card-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: uid }),
      }).catch(() => {})
      fetch('/api/wishlist-notify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          card: { nom: form.nom, annee: form.annee, marque: form.marque, collection: form.collection, variation: form.variation, num: form.num, rc: form.rc, auto: form.auto, patch: form.patch },
          cardUserId: uid,
        }),
      })
    })
    setSaving(false)
    if (form.image_recto) {
      setBinderPrompt({ userId: uid, img: form.image_recto, nom: form.nom })
    } else {
      router.push(`/galerie/${userId}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { toast.error(lang === 'fr' ? 'Le nom est obligatoire' : 'Name is required'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) { router.push('/connexion'); return }

    // Doublon = nom + année + marque + numérotation identiques (tout doit matcher, ex: 3/25 ≠ 5/25)
    // Si nom/année/marque est vide, on ne peut pas conclure → on laisse passer
    let dups: DupCard[] | null = null
    if (form.nom.trim() && form.annee && form.marque.trim()) {
      let q = supabase
        .from('cartes_manuelles')
        .select('id, nom, annee, marque, num, image_recto')
        .eq('user_id', user.id)
        .ilike('nom', form.nom.trim())
        .eq('annee', parseInt(form.annee))
        .ilike('marque', form.marque.trim())
      q = form.num.trim() ? q.eq('num', form.num.trim()) : q.is('num', null)
      const { data } = await q.limit(5)
      dups = data as DupCard[] | null
    }

    if (dups && dups.length > 0) {
      setDupWarning({ cards: dups as DupCard[], userId: user.id })
      setSaving(false)
      return
    }

    await doInsert(user.id)
  }

  // ImageUploader is defined at module scope (below) to prevent React from unmounting
  // it on every parent re-render — a nested component definition creates a new reference each time.

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 10px' }}>
      <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>
        ← {lang === 'fr' ? 'Retour à la galerie' : 'Back to gallery'}
      </Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>
        {lang === 'fr' ? '➕ Ajouter une carte' : '➕ Add a card'}
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Photos couvertures */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: form.booklet ? 16 : 24 }}>
          <ImageUploader side="recto" label={lang === 'fr' ? (form.booklet ? 'Couverture avant *' : 'Photo Recto *') : (form.booklet ? 'Front cover *' : 'Front Photo *')} preview={previewRecto} uploading={uploadingRecto} aspect={getFormat(form.format).displayRatio !== '2.5/3.5' ? getFormat(form.format).displayRatio : undefined} lang={lang} onClear={() => { setForm(f => ({ ...f, image_recto: '' })); setPreviewRecto(null) }} onFileChange={handleFileChange} onCameraClick={setCameraModal} />
          <ImageUploader side="verso" label={lang === 'fr' ? (form.booklet ? 'Couverture arrière' : 'Photo Verso') : (form.booklet ? 'Back cover' : 'Back Photo')} preview={previewVerso} uploading={uploadingVerso} aspect={(form.verso_is_horizontal ?? (form.format === 'horizontal' || form.is_horizontal)) ? '3.5/2.5' : (getFormat(form.format).displayRatio !== '2.5/3.5' ? getFormat(form.format).displayRatio : undefined)} lang={lang} onClear={() => { setForm(f => ({ ...f, image_verso: '' })); setPreviewVerso(null) }} onFileChange={handleFileChange} onCameraClick={setCameraModal} />
        </div>

        {/* Photos intérieures (booklet seulement) */}
        {form.booklet && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#7b1fa2', marginBottom: 10 }}>
              📖 {lang === 'fr' ? 'Pages intérieures' : 'Interior pages'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <ImageUploader side="il" label={lang === 'fr' ? 'Page gauche' : 'Left page'} preview={previewIL} uploading={uploadingIL} aspect="3.5/2.5" lang={lang} onClear={() => { setForm(f => ({ ...f, image_interieur_gauche: '' })); setPreviewIL(null) }} onFileChange={handleFileChange} onCameraClick={setCameraModal} />
              <ImageUploader side="ir" label={lang === 'fr' ? 'Page droite' : 'Right page'} preview={previewIR} uploading={uploadingIR} aspect="3.5/2.5" lang={lang} onClear={() => { setForm(f => ({ ...f, image_interieur_droite: '' })); setPreviewIR(null) }} onFileChange={handleFileChange} onCameraClick={setCameraModal} />
            </div>
          </div>
        )}

        {scanning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0f7ff', border: '1.5px solid #c0d8ff', borderRadius: 10, padding: '10px 16px', marginBottom: 4 }}>
            <div style={{ width: 16, height: 16, border: '2px solid #003DA6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#003DA6' }}>
              {lang === 'fr' ? 'Analyse IA en cours…' : 'AI analysis in progress…'}
            </span>
          </div>
        )}
        {scanError && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #ffc0c0', borderRadius: 10, padding: '10px 16px', marginBottom: 4, fontSize: 12, color: '#c0392b', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flexShrink: 0 }}>{scanError.startsWith('Trop de requêtes') ? '⏳' : '⚠️'}</span>
            <span>{scanError}</span>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Saisie rapide par désignation (façon Beckett) */}
          <div style={{ border: '1.5px dashed #cbd5e1', borderRadius: 12, padding: showDesignation ? 16 : 0, background: '#f8faff' }}>
            <button type="button" onClick={() => setShowDesignation(v => !v)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: showDesignation ? '0 0 12px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#003DA6', fontWeight: 800, fontSize: 13 }}>
              <span>⚡ {lang === 'fr' ? 'Remplir depuis une désignation (Beckett…)' : 'Fill from a designation (Beckett…)'}</span>
              <span style={{ fontSize: 16 }}>{showDesignation ? '▲' : '▼'}</span>
            </button>
            {showDesignation && (
              <>
                <textarea
                  value={designation}
                  onChange={e => { setDesignation(e.target.value); setDesignationDone(false) }}
                  rows={2}
                  placeholder={lang === 'fr'
                    ? 'Ex : 2007-08 UD Black 50th Anniversary Autographs #BR Bill Russell'
                    : 'Ex: 2007-08 UD Black 50th Anniversary Autographs #BR Bill Russell'}
                  style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1.5px solid #cbd5e1', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button type="button"
                    onClick={() => {
                      const parsed = parseDesignation(designation)
                      if (!designation.trim()) return
                      setForm(f => ({
                        ...f,
                        nom:         parsed.nom         ?? f.nom,
                        annee:       parsed.annee       ?? f.annee,
                        marque:      parsed.marque      ?? f.marque,
                        collection:  parsed.collection  ?? f.collection,
                        card_number: parsed.card_number ?? f.card_number,
                        num:         parsed.num         ?? f.num,
                        rc:    f.rc    || !!parsed.rc,
                        auto:  f.auto  || !!parsed.auto,
                        patch: f.patch || !!parsed.patch,
                        printing_plate: f.printing_plate || !!parsed.printing_plate,
                      }))
                      setDesignationDone(true)
                    }}
                    style={{ background: '#003DA6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                    {lang === 'fr' ? 'Remplir les champs' : 'Fill the fields'}
                  </button>
                  {designationDone && (
                    <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>
                      ✓ {lang === 'fr' ? 'Champs remplis — vérifiez ci-dessous' : 'Fields filled — check below'}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.4 }}>
                  {lang === 'fr'
                    ? 'Format : Année · Marque/Collection · #Numéro · Joueur. Les champs restent modifiables.'
                    : 'Format: Year · Brand/Set · #Number · Player. Fields stay editable.'}
                </p>
              </>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Nom du joueur *' : 'Player name *'}
            </label>
            <input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder={lang === 'fr' ? 'Ex : LeBron James' : 'Ex: LeBron James'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Équipe' : 'Team'}</label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder={lang === 'fr' ? 'Ex : Lakers' : 'Ex: Lakers'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Année' : 'Year'}</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder={lang === 'fr' ? 'Ex : 2023-24' : 'Ex: 2023-24'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Marque' : 'Brand'}</label>
              <input value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} placeholder={lang === 'fr' ? 'Ex : Panini, Topps…' : 'Ex: Panini, Topps…'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Collection' : 'Set'}</label>
              <input value={form.collection} onChange={e => setForm({ ...form, collection: e.target.value })} placeholder={lang === 'fr' ? 'Ex : Prizm, Chrome…' : 'Ex: Prizm, Chrome…'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Variation' : 'Variant'}</label>
              <input value={form.variation} onChange={e => setForm({ ...form, variation: e.target.value })} placeholder={lang === 'fr' ? 'Ex : Silver Prizm' : 'Ex: Silver Prizm'} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Grade</label>
              <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder={lang === 'fr' ? 'Ex : Raw, PSA 10, BGS 9.5…' : 'Ex: Raw, PSA 10, BGS 9.5…'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'N° de carte' : 'Card #'}</label>
              <input value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })} placeholder={lang === 'fr' ? 'Ex : 48, HTR-IFS, EC-1…' : 'Ex: 48, HTR-IFS, EC-1…'} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Numérotation' : 'Numbering'}</label>
              <input value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} placeholder={lang === 'fr' ? 'Ex : 48/99' : 'Ex: 48/99'} />
            </div>
          </div>

          {/* N° de certification — affiché pour une carte gradée (grade ≠ Raw) */}
          {form.grade.trim() && form.grade.trim().toLowerCase() !== 'raw' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'N° de certification' : 'Cert number'}</label>
              <input value={form.cert_number} onChange={e => setForm({ ...form, cert_number: e.target.value })} placeholder={lang === 'fr' ? 'Ex : 82659423 (au dos du slab)' : 'Ex: 82659423 (on the slab)'} />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Ajouter à la collection...' : 'Add to collection...'}
            </label>
            <CollectionTagSelect userId={userId} value={form.collection_tag} onChange={tag => setForm({ ...form, collection_tag: tag })} />
          </div>

          {/* Disponibilité vente / trade */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, border: `2px solid ${form.disponible_vente ? '#003DA6' : '#e0e0e0'}`, background: form.disponible_vente ? '#f0f4ff' : 'white', transition: '0.15s' }}>
            <div onClick={() => setForm(f => ({ ...f, disponible_vente: !f.disponible_vente }))}
              style={{ width: 36, height: 20, borderRadius: 10, background: form.disponible_vente ? '#003DA6' : '#ddd', position: 'relative', flexShrink: 0, transition: '0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: form.disponible_vente ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: form.disponible_vente ? '#003DA6' : '#666' }}>
              {lang === 'fr' ? '🏷️ Disponible à la vente / trade' : '🏷️ Available for sale / trade'}
            </span>
          </label>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>Format</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SELECTABLE_FORMATS.map(fmt => (
                <button key={fmt.id} type="button" onClick={() => setForm({ ...form, format: fmt.id, booklet: false })}
                  style={{
                    padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: '0.15s',
                    border: (!form.booklet && form.format === fmt.id) ? '2px solid #003DA6' : '2px solid #e0e0e0',
                    background: (!form.booklet && form.format === fmt.id) ? '#003DA6' : 'white',
                    color: (!form.booklet && form.format === fmt.id) ? 'white' : '#333',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64,
                  }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </button>
              ))}
              {/* Booklet = type de carte à part (carte multi-pages), placé avec les formats */}
              <button type="button" onClick={() => setForm(f => ({ ...f, booklet: !f.booklet }))}
                style={{
                  padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: '0.15s',
                  border: form.booklet ? '2px solid #7b1fa2' : '2px solid #e0e0e0',
                  background: form.booklet ? '#7b1fa2' : 'white',
                  color: form.booklet ? 'white' : '#333',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64,
                }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>📖</span>
                <span>Booklet</span>
              </button>
            </div>
            {form.booklet && <p style={{ fontSize: 12, color: '#888', margin: '8px 0 0' }}>{lang === 'fr' ? '4 photos requises (2 couvertures + 2 intérieurs)' : '4 photos required (2 covers + 2 interiors)'}</p>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>{lang === 'fr' ? 'Caractéristiques' : 'Features'}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { key: 'rc', label: 'RC', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', activeBg: '#2e7d32' },
                { key: 'patch', label: 'PATCH', activeBg: '#1976d2' },
                { key: 'printing_plate', label: 'PRINTING PLATE', activeBg: '#111827' },
              ].map(tag => (
                <button key={tag.key} type="button" onClick={() => setForm({ ...form, [tag.key]: !(form as any)[tag.key] })}
                  style={{
                    padding: '10px 20px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 900, fontSize: 13, transition: '0.2s',
                    background: (form as any)[tag.key] ? tag.activeBg : '#f0f0f0', color: (form as any)[tag.key] ? 'white' : '#333',
                  }}>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-main btn-primary" style={{ marginTop: 8 }}>
            {saving ? '...' : (lang === 'fr' ? '✅ Ajouter à ma galerie' : '✅ Add to my gallery')}
          </button>
        </div>
      </form>

      {/* Modal doublon */}
      {dupWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: '28px 24px', maxWidth: 420, width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, textAlign: 'center' }}>⚠️</div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#111', margin: '0 0 6px', textAlign: 'center' }}>
              {lang === 'fr' ? 'Carte déjà dans ta galerie ?' : 'Card already in your gallery?'}
            </h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px', textAlign: 'center' }}>
              {lang === 'fr'
                ? `Tu as déjà ${dupWarning.cards.length} carte${dupWarning.cards.length > 1 ? 's' : ''} avec ce nom.`
                : `You already have ${dupWarning.cards.length} card${dupWarning.cards.length > 1 ? 's' : ''} with this name.`}
            </p>
            {/* Aperçu des doublons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
              {dupWarning.cards.slice(0, 4).map(c => (
                <div key={c.id} style={{ textAlign: 'center' }}>
                  {c.image_recto
                    ? <img src={c.image_recto} alt={c.nom} style={{ width: 72, height: 100, objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                    : <div style={{ width: 72, height: 100, background: '#f0f0f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🃏</div>
                  }
                  <div style={{ fontSize: 10, color: '#999', marginTop: 4, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.annee}{c.marque ? ` · ${c.marque}` : ''}{c.num ? ` · ${c.num}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setDupWarning(null) }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid #e0e0e0', background: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#333' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={async () => { setDupWarning(null); setSaving(true); await doInsert(dupWarning.userId) }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: '#003DA6', color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                {lang === 'fr' ? 'Ajouter quand même' : 'Add anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proposition de rangement en bibliothèque, juste après l'ajout de la carte
          (portal : évite le piège "contain:layout" sur main > *:first-child qui casse
          position:fixed, voir globals.css et le fix appliqué à trades/page.tsx) */}
      {binderPrompt && !showBinderPicker && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: '28px 24px', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <img src={binderPrompt.img} alt="" style={{ width: 90, borderRadius: 8, margin: '0 auto 14px', display: 'block' }} />
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#111', margin: '0 0 6px' }}>
              {lang === 'fr' ? 'Carte ajoutée !' : 'Card added!'}
            </h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 18px' }}>
              {lang === 'fr' ? 'La ranger dans un classeur de ta bibliothèque ?' : 'File it into a binder in your library?'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button
                onClick={() => router.push(`/galerie/${userId}`)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid #e0e0e0', background: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: '#333' }}>
                {lang === 'fr' ? 'Non merci' : 'No thanks'}
              </button>
              <button
                onClick={() => setShowBinderPicker(true)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: ACCENT, color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                {lang === 'fr' ? '📔 Ranger' : '📔 File it'}
              </button>
            </div>
            <button
              onClick={resetForm}
              style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: `2px solid ${ACCENT}`, background: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: ACCENT }}>
              {lang === 'fr' ? '➕ Ajouter une autre carte' : '➕ Add another card'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {binderPrompt && showBinderPicker && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fafafa', borderRadius: 16, padding: 20, width: '100%', maxWidth: 700, maxHeight: '86vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <BinderLibrary
              userId={binderPrompt.userId}
              isOwner={true}
              accent={ACCENT}
              pendingCard={{ key: binderPrompt.img, img: binderPrompt.img, nom: binderPrompt.nom }}
              onPlaced={() => { setShowBinderPicker(false); setBinderPrompt(null); resetForm() }}
            />
          </div>
        </div>,
        document.body
      )}

      {cameraModal && (
        <CameraCapture
          ratio={(cameraModal === 'il' || cameraModal === 'ir' || (cameraModal === 'verso' ? (form.verso_is_horizontal ?? form.is_horizontal) : form.is_horizontal)) ? 3.5 / 2.5 : undefined}
          onCapture={(blob, frameRect) => {
            const url = URL.createObjectURL(blob)
            setCameraModal(null)
            // La détection auto (OpenCV/Gemini) suppose un ratio carte standard (~2.5:3.5).
            // Pour les formats dont le ratio réel diffère trop (carré, panorama, tobacco),
            // elle échoue systématiquement et déclenche à chaque fois le pipeline IA lourd
            // pour rien — on saute donc directement au recadrage manuel pour ces formats.
            const skipAutoDetect = ['square', 'panorama', 'tobacco'].includes(form.format)
            if (skipAutoDetect) {
              setCropModal({ side: cameraModal, src: url })
              setRotation(0)
              setImgTransform({ x: 0, y: 0, scale: 1 })
            } else {
              setScannerModal({ side: cameraModal, src: url, frameRect })
            }
          }}
          onClose={() => setCameraModal(null)}
        />
      )}

      {scannerModal && !(scannerModal.side === 'il' || scannerModal.side === 'ir') && (
        <CardScanner
          src={scannerModal.src}
          frameRect={scannerModal.frameRect}
          onResult={blob => uploadBlob(blob, scannerModal.side)}
          onFallback={() => {
            setCropModal({ side: scannerModal.side, src: scannerModal.src })
            setRotation(0)
            setImgTransform({ x: 0, y: 0, scale: 1 })
            setScannerModal(null)
          }}
          onClose={() => setScannerModal(null)}
        />
      )}

      {cropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {/* Sélecteur de format — ajuste la forme du cadre en direct (recto uniquement : le format
              détermine la forme physique de la carte, la même pour les deux faces) */}
          {cropModal.side === 'recto' && (
            <div style={{ width: '100%', background: '#1a1a1a', padding: '10px 12px', boxSizing: 'border-box', display: 'flex', gap: 6, overflowX: 'auto', justifyContent: 'flex-start', WebkitOverflowScrolling: 'touch' }}>
              {SELECTABLE_FORMATS.map(f => {
                const active = (form.format || 'standard') === f.id
                return (
                  <button key={f.id} type="button"
                    onClick={() => {
                      setForm(prev => ({ ...prev, format: f.id, is_horizontal: f.id === 'horizontal' }))
                      cropRatioRef.current = f.cropRatio
                      isHorizontalRef.current = f.id === 'horizontal'
                      requestAnimationFrame(resetTransform)
                    }}
                    style={{ flexShrink: 0, padding: '7px 11px', borderRadius: 8, border: active ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)', background: active ? 'rgba(255,255,255,0.18)' : 'transparent', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {f.icon} {f.label}
                  </button>
                )
              })}
            </div>
          )}
          {/* Orientation du verso, indépendante du recto (ex: recto vertical, verso à l'horizontale) */}
          {cropModal.side === 'verso' && (() => {
            const rectoHorizontal = form.format === 'horizontal' || form.is_horizontal
            const versoHorizontal = form.verso_is_horizontal ?? rectoHorizontal
            return (
              <div style={{ width: '100%', background: '#1a1a1a', padding: '10px 12px', boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
                <button type="button"
                  onClick={() => {
                    const next = !versoHorizontal
                    setForm(prev => ({ ...prev, verso_is_horizontal: next }))
                    isHorizontalRef.current = next
                    cropRatioRef.current = next ? 3.5 / 2.5 : getFormat(form.format).cropRatio
                    requestAnimationFrame(resetTransform)
                  }}
                  style={{ padding: '7px 14px', borderRadius: 8, border: versoHorizontal ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)', background: versoHorizontal ? 'rgba(255,255,255,0.18)' : 'transparent', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🔄 {lang === 'fr' ? 'Verso à l\'horizontale' : 'Horizontal back'} {versoHorizontal ? '✓' : ''}
                </button>
              </div>
            )
          })()}
          {/* Zone d'interaction : image mobile sous cadre fixe */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              position: 'relative',
              width: '100%',
              flex: 1,
              overflow: 'hidden',
              cursor: isDragging.current ? 'grabbing' : 'grab',
              touchAction: 'none',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Image libre (se déplace/zoom) */}
            <img
              ref={imgRef}
              src={cropModal.src}
              alt="To crop"
              onLoad={resetTransform}
              draggable={false}
              style={{
                position: 'absolute',
                maxWidth: 'none',
                transform: `translate(${imgTransform.x}px, ${imgTransform.y}px) scale(${imgTransform.scale}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
                transition: 'none',
              }}
            />

            {/* Overlay sombre autour du cadre */}
            {(() => {
              // Calculate frame dimensions relative to container for overlay cutout
              // We use CSS clip-path on 4 separate divs for the shadow
              return null
            })()}

            {/* Cadre fixe centré — juste les coins, pas de bordure pleine */}
            {(() => {
              const isInt = cropModal.side === 'il' || cropModal.side === 'ir'
              const isH = isInt || isHorizontalRef.current
              const fmtRatio = getFormat(form.format).cropRatio
              const ar = isH ? '3.5/2.5' : getFormat(form.format).displayRatio
              const w = isH ? `min(90%, calc(82vh * ${3.5/2.5}))` : `min(82%, calc(90vh * ${fmtRatio}))`
              return (
            <div style={{
              position: 'absolute',
              pointerEvents: 'none',
              width: w,
              aspectRatio: ar,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              borderRadius: 6,
            }}>
              {/* Coins décoratifs blancs */}
              {[
                { top: -2, left: -2, borderTop: '3px solid white', borderLeft: '3px solid white', borderRadius: '4px 0 0 0' },
                { top: -2, right: -2, borderTop: '3px solid white', borderRight: '3px solid white', borderRadius: '0 4px 0 0' },
                { bottom: -2, left: -2, borderBottom: '3px solid white', borderLeft: '3px solid white', borderRadius: '0 0 0 4px' },
                { bottom: -2, right: -2, borderBottom: '3px solid white', borderRight: '3px solid white', borderRadius: '0 0 4px 0' },
              ].map((style, i) => (
                <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...style }} />
              ))}
            </div>
              )
            })()}
          </div>

          {/* Panneau bas */}
          <div style={{ width: '100%', background: '#1a1a1a', padding: '14px 20px 20px', boxSizing: 'border-box' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', margin: '0 0 10px' }}>
              {lang === 'fr'
                ? 'Glissez pour repositionner · Pincez ou molette pour zoomer'
                : 'Drag to reposition · Pinch or scroll to zoom'}
            </p>

            {/* Slider zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', width: 52 }}>
                🔍 {Math.round(imgTransform.scale * 100)}%
              </span>
              <input
                type="range" min="-100" max="200"
                value={Math.round(Math.log2(imgTransform.scale) * 60)}
                onChange={e => {
                  const scale = Math.pow(2, Number(e.target.value) / 60)
                  setImgTransform(t => ({ ...t, scale: Math.max(0.1, Math.min(10, scale)) }))
                }}
                style={{ flex: 1, accentColor: '#fff', cursor: 'pointer', height: 4 }}
              />
              <button
                type="button"
                onClick={resetTransform}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.12)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {lang === 'fr' ? 'Recadrer' : 'Fit'}
              </button>
            </div>

            {/* Boutons rotation 90° */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
              <button type="button" onClick={() => setRotation(r => ((r - 90) % 360))}
                style={{ padding: '7px 18px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ↺ 90°
              </button>
              <button type="button" onClick={() => setRotation(r => ((r + 90) % 360))}
                style={{ padding: '7px 18px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                ↻ 90°
              </button>
            </div>

            {/* Slider rotation fine */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', width: 52 }}>🔄 {rotation}°</span>
              <input
                type="range" min="-180" max="180" value={rotation}
                onChange={e => setRotation(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#fff', cursor: 'pointer', height: 4 }}
              />
              <div style={{ width: 68 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCropModal(null)}
                style={{ flex: 1, padding: 14, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer', color: 'white', fontSize: 15 }}
              >
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={applyCropAndUpload}
                style={{ flex: 2, padding: 14, background: 'white', color: '#111', border: 'none', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
              >
                {lang === 'fr' ? 'Utiliser cette image' : 'Use this image'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
