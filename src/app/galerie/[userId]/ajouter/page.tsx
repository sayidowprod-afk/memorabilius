'use client'
import { useState, use, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function AjouterCarte({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const { lang } = useLang()
  const [saving, setSaving] = useState(false)
  const [uploadingRecto, setUploadingRecto] = useState(false)
  const [uploadingVerso, setUploadingVerso] = useState(false)
  const [previewRecto, setPreviewRecto] = useState<string | null>(null)
  const [previewVerso, setPreviewVerso] = useState<string | null>(null)
  const [form, setForm] = useState({
    nom: '', equipe: '', annee: '', collection: '', variation: '',
    grade: 'Raw', num: '', rc: false, auto: false, patch: false,
    image_recto: '', image_verso: '',
  })

  const [cropModal, setCropModal] = useState<{ side: 'recto' | 'verso'; src: string } | null>(null)
  const [rotation, setRotation] = useState(0)
  
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, width: 150, height: 210 })
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const boxStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'recto' | 'verso') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result) {
        setCropModal({ side, src: reader.result as string })
        setRotation(0)
        setCropBox({ x: 50, y: 50, width: 160, height: 224 })
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const getEventCoords = (e: any) => {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, type: 'drag' | 'resize') => {
    // Bloque le déclenchement des gestes par défaut du navigateur
    if (e.cancelable) e.preventDefault()
    
    const coords = getEventCoords(e)
    if (type === 'drag') isDragging.current = true
    if (type === 'resize') isResizing.current = true

    dragStart.current = { x: coords.x, y: coords.y }
    boxStart.current = { ...cropBox }
  }

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current && !isResizing.current) return
      
      // CRUCIAL POUR MOBILE : Annule le défilement et le rebond de la page entière
      if (e.cancelable) e.preventDefault()

      if (!containerRef.current) return

      const coords = getEventCoords(e)
      const dx = coords.x - dragStart.current.x
      const dy = coords.y - dragStart.current.y
      const container = containerRef.current.getBoundingClientRect()

      const targetRatio = 2.5 / 3.5

      if (isDragging.current) {
        let newX = boxStart.current.x + dx
        let newY = boxStart.current.y + dy
        newX = Math.max(0, Math.min(container.width - cropBox.width, newX))
        newY = Math.max(0, Math.min(container.height - cropBox.height, newY))
        setCropBox(prev => ({ ...prev, x: newX, y: newY }))
      }

      if (isResizing.current) {
        let newWidth = boxStart.current.width + dx
        let newHeight = newWidth / targetRatio
        if (newWidth > 40 && (boxStart.current.x + newWidth) <= container.width && (boxStart.current.y + newHeight) <= container.height) {
          setCropBox(prev => ({ ...prev, width: newWidth, height: newHeight }))
        }
      }
    }

    const handlePointerUp = () => {
      isDragging.current = false
      isResizing.current = false
    }

    // Ajout des écouteurs globaux avec passive: false pour forcer la priorité sur le scroll natif
    window.addEventListener('mousemove', handlePointerMove, { passive: false })
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handlePointerMove, { passive: false })
    window.addEventListener('touchend', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  }, [cropBox])

  const applyCropAndUpload = async () => {
    if (!cropModal || !containerRef.current) return
    const side = cropModal.side
    
    if (side === 'recto') setUploadingRecto(true)
    else setUploadingVerso(true)
    
    const imgElement = containerRef.current.querySelector('img') as HTMLImageElement
    if (!imgElement) return

    const srcCanvas = document.createElement('canvas')
    const srcCtx = srcCanvas.getContext('2d')
    if (!srcCtx) return

    const angleRad = (rotation * Math.PI) / 180
    const absCos = Math.abs(Math.cos(angleRad))
    const absSin = Math.abs(Math.sin(angleRad))
    
    const rotWidth = imgElement.naturalWidth * absCos + imgElement.naturalHeight * absSin
    const rotHeight = imgElement.naturalWidth * absSin + imgElement.naturalHeight * absCos

    srcCanvas.width = rotWidth
    srcCanvas.height = rotHeight

    srcCtx.translate(rotWidth / 2, rotHeight / 2)
    srcCtx.rotate(angleRad)
    srcCtx.drawImage(imgElement, -imgElement.naturalWidth / 2, -imgElement.naturalHeight / 2)

    const scaleX = rotWidth / imgElement.width
    const scaleY = rotHeight / imgElement.height

    const finalCanvas = document.createElement('canvas')
    const finalCtx = finalCanvas.getContext('2d')
    if (!finalCtx) return

    finalCanvas.width = 600
    finalCanvas.height = 840

    const cropX = cropBox.x * scaleX
    const cropY = cropBox.y * scaleY
    const cropW = cropBox.width * scaleX
    const cropH = cropBox.height * scaleY

    finalCtx.drawImage(
      srcCanvas,
      cropX, cropY, cropW, cropH,
      0, 0, finalCanvas.width, finalCanvas.height
    )

    setCropModal(null)

    finalCanvas.toBlob(async (blob) => {
      if (!blob) { setUploadingRecto(false); setUploadingVerso(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const path = `cartes/${user.id}/${Date.now()}_${side}.jpg`
      const fileToUpload = new File([blob], `${Date.now()}_${side}.jpg`, { type: 'image/jpeg' })

      const { error } = await supabase.storage.from('avatars').upload(path, fileToUpload, { upsert: true })
      if (error) { 
        alert('Erreur upload : ' + error.message)
        setUploadingRecto(false); setUploadingVerso(false)
        return 
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl

      if (side === 'recto') {
        setForm(f => ({ ...f, image_recto: url }))
        setPreviewRecto(url)
        setUploadingRecto(false)
      } else {
        setForm(f => ({ ...f, image_verso: url }))
        setPreviewVerso(url)
        setUploadingVerso(false)
      }
    }, 'image/jpeg', 0.88)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { alert(lang === 'fr' ? 'Le nom est obligatoire' : 'Name is required'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) { router.push('/connexion'); return }

    const { error } = await supabase.from('cartes_manuelles').insert({
      user_id: user.id, nom: form.nom, equipe: form.equipe || null, annee: form.annee || null,
      collection: form.collection || null, variation: form.variation || null, grade: form.grade,
      num: form.num || null, rc: form.rc, auto: form.auto, patch: form.patch,
      image_recto: form.image_recto || null, image_verso: form.image_verso || null,
    })

    if (error) { alert('Erreur : ' + error.message); setSaving(false); return }
    router.push(`/galerie/${userId}`)
  }

  const ImageUploader = ({ side, label, preview, uploading }: { side: 'recto' | 'verso', label: string, preview: string | null, uploading: boolean }) => (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{label}</label>
      <div style={{ border: '2px dashed #ddd', borderRadius: 12, overflow: 'hidden', aspectRatio: '2.5/3.5', position: 'relative', cursor: 'pointer', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onClick={() => document.getElementById(`upload-${side}`)?.click()}>
        {preview ? (
          <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={label} />
        ) : (
          <div style={{ textAlign: 'center', color: '#bbb' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{uploading ? '...' : (lang === 'fr' ? 'Cliquer pour ajouter' : 'Click to add')}</p>
          </div>
        )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'white', fontWeight: 700 }}>{lang === 'fr' ? 'Upload...' : 'Uploading...'}</div>
          </div>
        )}
      </div>
      <input id={`upload-${side}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, side)} />
      {preview && (
        <button type="button" onClick={() => { setForm(f => ({ ...f, [`image_${side}`]: '' })); side === 'recto' ? setPreviewRecto(null) : setPreviewVerso(null) }}
          style={{ marginTop: 6, width: '100%', background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '6px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'fr' ? '🗑️ Supprimer' : '🗑️ Remove'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 10px' }}>
      <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>
        ← {lang === 'fr' ? 'Retour à la galerie' : 'Back to gallery'}
      </Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>
        {lang === 'fr' ? '➕ Ajouter une carte' : '➕ Add a card'}
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          <ImageUploader side="recto" label={lang === 'fr' ? 'Photo Recto *' : 'Front Photo *'} preview={previewRecto} uploading={uploadingRecto} />
          <ImageUploader side="verso" label={lang === 'fr' ? 'Photo Verso' : 'Back Photo'} preview={previewVerso} uploading={uploadingVerso} />
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              {lang === 'fr' ? 'Nom du joueur *' : 'Player name *'}
            </label>
            <input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="LeBron James" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Équipe' : 'Team'}</label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder="Lakers" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Année' : 'Year'}</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder="2023-24" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Collection / Marque' : 'Brand / Set'}</label>
              <input value={form.collection} onChange={e => setForm({ ...form, collection: e.target.value })} placeholder="Panini Prizm" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Variation' : 'Variant'}</label>
              <input value={form.variation} onChange={e => setForm({ ...form, variation: e.target.value })} placeholder="Silver Prizm" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Grade</label>
              <select value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                {['Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'BGS 10', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5'].map(g => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{lang === 'fr' ? 'Numérotation (ex: 48/99)' : 'Numbering (ex: 48/99)'}</label>
              <input value={form.num} onChange={e => setForm({ ...form, num: e.target.value })} placeholder="48/99" />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 10 }}>{lang === 'fr' ? 'Caractéristiques' : 'Features'}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'rc', label: 'RC', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', activeBg: '#2e7d32' },
                { key: 'patch', label: 'PATCH', activeBg: '#1976d2' },
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

      {/* Modale de recadrage optimisée avec isolation tactile totale */}
      {cropModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
          <div style={{ background: '#fff', padding: 20, borderRadius: 16, maxWidth: 520, width: '100%', textAlign: 'center', boxSizing: 'border-box' }}>
            <h3 style={{ margin: '0 0 10px', fontWeight: 800 }}>{lang === 'fr' ? 'Ajuster et faire pivoter la carte' : 'Adjust and rotate card'}</h3>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 15px' }}>
              {lang === 'fr' ? 'Glissez pour déplacer, étirez le coin bleu pour redimensionner.' : 'Drag to move, stretch the blue corner to resize.'}
            </p>
            
            {/* Conteneur principal de l'image : touchAction: 'none' pour bloquer le scroll natif */}
            <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '50vh', overflow: 'hidden', background: '#222', borderRadius: 8, userSelect: 'none', touchAction: 'none' }}>
              <img src={cropModal.src} alt="To crop" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '50vh', 
                  display: 'block', 
                  pointerEvents: 'none',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.1s linear'
                }} 
              />
              
              {/* Cadre de rognage interactif */}
              <div 
                onMouseDown={e => handlePointerDown(e, 'drag')}
                onTouchStart={e => handlePointerDown(e, 'drag')}
                style={{
                  position: 'absolute',
                  border: '3px solid #003DA6',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  cursor: 'move',
                  top: cropBox.y,
                  left: cropBox.x,
                  width: cropBox.width,
                  height: cropBox.height,
                  pointerEvents: 'auto',
                  touchAction: 'none' // Empêche tout effet de rebond ou scroll sur le cadre
                }}
              >
                <div style={{ position: 'absolute', inset: 0, border: '1px dashed rgba(255,255,255,0.6)' }} />
                
                {/* Poignée agrandie pour faciliter la saisie sur écran tactile */}
                <div 
                  onMouseDown={e => { e.stopPropagation(); handlePointerDown(e, 'resize') }}
                  onTouchStart={e => { e.stopPropagation(); handlePointerDown(e, 'resize') }}
                  style={{
                    position: 'absolute',
                    bottom: -14,
                    right: -14,
                    width: 28,
                    height: 28,
                    background: '#003DA6',
                    border: '3px solid white',
                    borderRadius: '50%',
                    cursor: 'se-resize',
                    pointerEvents: 'auto',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                    touchAction: 'none' // Empêche le conflit avec le comportement système
                  }} 
                />
              </div>
            </div>

            <div style={{ marginTop: 20, textAlign: 'left', background: '#f9f9f9', padding: '12px 16px', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>🔄 {lang === 'fr' ? 'Orientation / Rotation' : 'Orientation / Rotation'}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#003DA6', marginLeft: 'auto' }}>{rotation}°</span>
              </div>
              <input type="range" min="-180" max="180" value={rotation} onChange={e => setRotation(Number(e.target.value))} style={{ width: '100%', accentColor: '#003DA6', cursor: 'pointer' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setCropModal(null)} style={{ flex: 1, padding: 12, background: '#eee', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', color: '#555' }}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button type="button" onClick={applyCropAndUpload} style={{ flex: 1, padding: 12, background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'fr' ? 'Découper & Enregistrer' : 'Crop & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}