'use client'
// Ajout en lot : plusieurs cartes d'un coup, avec recto ET verso pour chacune.
// Les photos sont réduites, envoyées, puis (au choix) identifiées par l'IA existante (/api/scan-card, 1 scan par carte).
// Une carte non identifiée est enregistrée « À compléter » : rien n'est perdu.
import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useIsAppUI } from '@/lib/useIsNative'
import { NAV_TOTAL_HEIGHT_CSS } from '@/lib/nativeLayout'
import { cropQuad, type Quad } from '@/lib/perspectiveCrop'
import { detectCornersYOLO, waitForYOLO } from '@/lib/cornerDetectorYolo'
import CornerEditor from '@/components/CornerEditor'
import { detectBinderCards } from '@/lib/binderDetect'

type Photo = { file: File; url: string }
type SrcRef = { full: HTMLCanvasElement; quad: Quad }
// cropped : la photo est déjà une carte découpée (page de classeur) ; src : la grande photo d'origine, pour réajuster les coins
type Entry = { id: number; recto: Photo; verso: Photo | null; cropped?: boolean; src?: { recto: SrcRef; verso?: SrcRef } }
type Status = 'wait' | 'detect' | 'upload' | 'scan' | 'done' | 'todo' | 'error'
type Mode = 'alt' | 'split' | 'single'

const MAX_CARDS = 30
let nextId = 1

const photoOf = (file: File): Photo => ({ file, url: URL.createObjectURL(file) })

function buildEntries(photos: Photo[], mode: Mode): Entry[] {
  if (mode === 'single') return photos.slice(0, MAX_CARDS).map(p => ({ id: nextId++, recto: p, verso: null }))
  if (mode === 'split') {
    const half = Math.floor(photos.length / 2)
    return Array.from({ length: Math.min(half, MAX_CARDS) }, (_, i) => ({ id: nextId++, recto: photos[i], verso: photos[half + i] ?? null }))
  }
  const out: Entry[] = []
  for (let i = 0; i < photos.length && out.length < MAX_CARDS; i += 2) out.push({ id: nextId++, recto: photos[i], verso: photos[i + 1] ?? null })
  return out
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* repli ci-dessous */ }
  return await new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(u); res(img) }; img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image illisible')) }; img.src = u
  })
}

async function resize(file: File, max: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const img = await decode(file)
  const w0 = 'naturalWidth' in img ? img.naturalWidth : img.width
  const h0 = 'naturalHeight' in img ? img.naturalHeight : img.height
  const scale = Math.min(1, max / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale))
  const c = document.createElement('canvas'); c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, w, h)
  const blob: Blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encodage impossible')), 'image/jpeg', quality))
  return { blob, w, h }
}

// Recadre une photo de carte seule avec le détecteur de coins maison (YOLO) : même résultat que l'ajout à l'unité, sans l'écran de réglage.
// Si rien de fiable n'est trouvé, la photo d'origine est gardée telle quelle.
async function autoCrop(file: File): Promise<File> {
  try {
    const img = await decode(file)
    const W = 'naturalWidth' in img ? img.naturalWidth : img.width, H = 'naturalHeight' in img ? img.naturalHeight : img.height
    const full = document.createElement('canvas'); full.width = W; full.height = H; full.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0)
    const small = document.createElement('canvas'); const k = Math.min(1, 1280 / Math.max(W, H)); small.width = Math.round(W * k); small.height = Math.round(H * k)
    small.getContext('2d')!.drawImage(full, 0, 0, small.width, small.height)
    const el = await new Promise<HTMLImageElement>((res, rej) => small.toBlob(b => {
      if (!b) return rej(new Error('encodage impossible'))
      const u = URL.createObjectURL(b); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im) }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image illisible')) }; im.src = u
    }, 'image/jpeg', 0.9))
    const pts = await detectCornersYOLO(el)
    if (!pts || pts.length !== 4) return file
    const q: Quad = { topLeft: { x: pts[0].x / small.width, y: pts[0].y / small.height }, topRight: { x: pts[1].x / small.width, y: pts[1].y / small.height }, bottomRight: { x: pts[2].x / small.width, y: pts[2].y / small.height }, bottomLeft: { x: pts[3].x / small.width, y: pts[3].y / small.height } }
    const ps = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft]
    const area = Math.abs(ps.reduce((a, p, i) => { const r = ps[(i + 1) % 4]; return a + (p.x * r.y - r.x * p.y) }, 0)) / 2
    const w = (Math.hypot((q.topRight.x - q.topLeft.x) * W, (q.topRight.y - q.topLeft.y) * H) + Math.hypot((q.bottomRight.x - q.bottomLeft.x) * W, (q.bottomRight.y - q.bottomLeft.y) * H)) / 2
    const h = (Math.hypot((q.bottomLeft.x - q.topLeft.x) * W, (q.bottomLeft.y - q.topLeft.y) * H) + Math.hypot((q.bottomRight.x - q.topRight.x) * W, (q.bottomRight.y - q.topRight.y) * H)) / 2
    const ratio = w / Math.max(1, h)
    const plausible = area > 0.1 && ((ratio > 0.55 && ratio < 0.95) || (ratio > 1.05 && ratio < 1.8)) && ps.every(p => p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02)
    if (!plausible) return file
    return new File([await cropQuad(full, q, 3200)], file.name.replace(/\.\w+$/, '') + '_recadree.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

const toBase64 = (blob: Blob) => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(blob) })

export default function AjoutLotPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const isAppUI = useIsAppUI()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [mode, setMode] = useState<Mode>('alt')
  const [entries, setEntries] = useState<Entry[]>([])
  const [useAI, setUseAI] = useState(true)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [status, setStatus] = useState<Record<number, { s: Status; msg?: string; nom?: string }>>({})
  const cancelRef = useRef(false)
  const binderRef = useRef<HTMLInputElement>(null)
  const [binderMsg, setBinderMsg] = useState<string | null>(null)
  const [binderBusy, setBinderBusy] = useState(false)
  const [debugImgs, setDebugImgs] = useState<string[]>([])
  const [autoCorners, setAutoCorners] = useState(true)
  const [editing, setEditing] = useState<{ id: number; side: 'recto' | 'verso' } | null>(null)
  const [grid, setGrid] = useState<[number, number]>([3, 3]) // [lignes, colonnes]

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (!user || user.id !== userId) router.replace('/connexion') })
  }, [userId, router])

  // reconstruit les paires quand les photos ou le mode changent
  const regroup = (p: Photo[], m: Mode) => { setEntries(buildEntries(p, m)); setStatus({}); setFinished(false) }
  const onPick = (files: FileList | null) => {
    if (!files?.length) return
    const next = [...photos, ...Array.from(files).filter(f => f.type.startsWith('image/')).map(photoOf)].slice(0, MAX_CARDS * 2)
    setPhotos(next); regroup(next, mode)
  }
  const changeMode = (m: Mode) => { setMode(m); regroup(photos, m) }
  const removeEntry = (id: number) => setEntries(es => es.filter(e => e.id !== id))
  const swap = (id: number) => setEntries(es => es.map(e => e.id === id && e.verso ? { ...e, recto: e.verso, verso: e.recto, src: e.src?.verso ? { recto: e.src.verso, verso: e.src.recto } : e.src } : e))
  // réajustement manuel des coins : on redécoupe la carte depuis la grande photo d'origine
  const saveCorners = async (q: Quad) => {
    if (!editing) return
    const { id, side } = editing
    const e = entries.find(x => x.id === id); const ref = e?.src?.[side]
    setEditing(null)
    if (!e || !ref) return
    const photo = photoOf(new File([await cropQuad(ref.full, q)], `classeur_${id}_${side}.jpg`, { type: 'image/jpeg' }))
    setEntries(es => es.map(x => x.id === id ? { ...x, [side]: photo, src: { ...x.src!, [side]: { full: ref.full, quad: q } } } : x))
  }
  const clearAll = () => { setPhotos([]); setEntries([]); setStatus({}); setFinished(false) }
  const set = (id: number, v: { s: Status; msg?: string; nom?: string }) => setStatus(s => ({ ...s, [id]: v }))

  // Page de classeur : aucune grille à placer. Le détecteur maison (YOLO dans le navigateur, le même que le scanner) cherche les cartes sur toute la photo,
  // en déduit le réseau régulier des pochettes pour retrouver celles qu'il a ratées, puis affine chaque carte (voir lib/binderDetect.ts).
  // Aucun appel serveur, aucun coût.
  const onBinderPick = async (files: FileList | null) => {
    if (!files?.length || binderBusy) return
    const pics = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 2)
    setBinderBusy(true); setBinderMsg('Chargement du détecteur…'); setDebugImgs([])
    try {
      const [rows, cols] = grid
      const n = rows * cols
      if (!(await waitForYOLO(30000))) throw new Error('le modèle de détection ne s’est pas chargé, réessaie.')
      const analyse = async (f: File, label: string) => {
        const src = await decode(f)
        const W = 'naturalWidth' in src ? src.naturalWidth : src.width, H = 'naturalHeight' in src ? src.naturalHeight : src.height
        const full = document.createElement('canvas'); full.width = W; full.height = H; full.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0)
        const res = await detectBinderCards(full, rows, cols, m => setBinderMsg(`${label} : ${m}`))
        const k = Math.min(1, 700 / W), cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k)
        const ctx = cv.getContext('2d')!; ctx.drawImage(full, 0, 0, cv.width, cv.height); ctx.lineWidth = 3; ctx.font = 'bold 26px sans-serif'
        res.slots.forEach((sl, i) => {
          const q = sl.quad, pts = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft]
          ctx.strokeStyle = ctx.fillStyle = sl.how === 'affinée' ? '#3ddc97' : '#ffd84d'
          ctx.beginPath(); pts.forEach((p, j) => { if (j) ctx.lineTo(p.x * k, p.y * k); else ctx.moveTo(p.x * k, p.y * k) }); ctx.closePath(); ctx.stroke()
          ctx.fillText(String(i + 1), q.topLeft.x * k + 8, q.topLeft.y * k + 28)
        })
        const norm = (p: { x: number; y: number }) => ({ x: p.x / W, y: p.y / H })
        const quads: Quad[] = res.slots.map(sl => ({ topLeft: norm(sl.quad.topLeft), topRight: norm(sl.quad.topRight), bottomRight: norm(sl.quad.bottomRight), bottomLeft: norm(sl.quad.bottomLeft) }))
        return { full, quads, lattice: res.lattice, weak: res.slots.filter(sl => sl.how !== 'affinée').length, overlay: cv.toDataURL('image/jpeg', 0.8) }
      }

      const A = await analyse(pics[0], 'Recto')
      const B = pics[1] ? await analyse(pics[1], 'Verso') : null
      setDebugImgs([A.overlay, ...(B ? [B.overlay] : [])])
      if (!A.quads.length) throw new Error('aucune carte trouvée sur la photo.')
      // verso en miroir : la case (ligne r, colonne c) du recto est à la colonne (cols-1-c) au verso
      const versoAt = (i: number) => { const r = Math.floor(i / cols), c = i % cols; return B!.quads[r * cols + (cols - 1 - c)] }
      const paired = !!B && A.lattice && B.lattice && A.quads.length === n && B.quads.length === n
      setBinderMsg('Découpage des cartes…')
      const added: Entry[] = []
      for (let i = 0; i < A.quads.length && entries.length + added.length < MAX_CARDS; i++) {
        const mk = async (x: { full: HTMLCanvasElement }, q: Quad, nm: string) => photoOf(new File([await cropQuad(x.full, q)], nm, { type: 'image/jpeg' }))
        const vq = paired && B ? versoAt(i) : null
        added.push({ id: nextId++, cropped: true, recto: await mk(A, A.quads[i], `classeur_${i + 1}_recto.jpg`), verso: vq && B ? await mk(B, vq, `classeur_${i + 1}_verso.jpg`) : null, src: { recto: { full: A.full, quad: A.quads[i] }, verso: vq && B ? { full: B.full, quad: vq } : undefined } })
      }
      setEntries(es => [...es, ...added]); setStatus({}); setFinished(false)
      const weak = A.weak + (paired && B ? B.weak : 0)
      setBinderMsg(`${added.length} carte${added.length > 1 ? 's' : ''} trouvée${added.length > 1 ? 's' : ''} sur ${n} attendues${weak ? ` · ${weak} emplacement${weak > 1 ? 's' : ''} estimé${weak > 1 ? 's' : ''} (contour jaune) : à vérifier` : ''}${B && !paired ? ' · verso non apparié (réseau de cartes incomplet)' : ''}. Vérifie-les (✕ pour retirer) puis lance l’ajout.`)
    } catch (e: any) { setBinderMsg('Échec : ' + (e?.message || 'erreur')) }
    finally { setBinderBusy(false) }
  }

  const run = async () => {
    if (running || !entries.length) return
    cancelRef.current = false; setRunning(true); setFinished(false)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || session.user.id !== userId) { router.replace('/connexion'); return }
    const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
    let aiOn = useAI
    let aiNote = ''
    for (const e of entries) {
      if (cancelRef.current) break
      try {
        let rectoFile = e.recto.file, versoFile = e.verso?.file ?? null
        if (autoCorners && !e.cropped) {
          set(e.id, { s: 'detect' })
          if (!(await waitForYOLO(30000))) throw new Error('détecteur de coins indisponible')
          rectoFile = await autoCrop(rectoFile)
          if (versoFile) versoFile = await autoCrop(versoFile)
        }
        set(e.id, { s: 'upload' })
        const ts = `${Date.now()}_${e.id}`
        const rStd = await resize(rectoFile, 1600, 0.88), rHd = await resize(rectoFile, 3200, 0.92)
        const up = async (blob: Blob, name: string) => {
          const path = `cartes/${userId}/${ts}_${name}.jpg`
          const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
          if (error) throw new Error('envoi de la photo : ' + error.message)
          return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        }
        const imageRecto = await up(rStd.blob, 'recto'), imageRectoHd = await up(rHd.blob, 'recto_hd')
        let imageVerso: string | null = null, imageVersoHd: string | null = null, versoHorizontal: boolean | null = null, vStd: { blob: Blob; w: number; h: number } | null = null
        if (versoFile) {
          vStd = await resize(versoFile, 1600, 0.88)
          const vHd = await resize(versoFile, 3200, 0.92)
          imageVerso = await up(vStd.blob, 'verso'); imageVersoHd = await up(vHd.blob, 'verso_hd')
          versoHorizontal = vStd.w > vStd.h
        }

        let card: any = null
        if (aiOn) {
          set(e.id, { s: 'scan' })
          const g1 = await resize(rectoFile, 1200, 0.9)
          const body: any = { imageBase64: await toBase64(g1.blob), mimeType: 'image/jpeg', itemType: 'card' }
          if (versoFile) body.imageBase64Verso = await toBase64((await resize(versoFile, 1200, 0.9)).blob)
          const resp = await fetch('/api/scan-card', { method: 'POST', headers: auth, body: JSON.stringify(body) })
          const d = await resp.json().catch(() => ({}))
          if (resp.ok && !d.error) card = d
          else if (resp.status === 429) { aiOn = false; aiNote = d.error || 'Limite d’identifications atteinte : les cartes suivantes sont enregistrées « À compléter ».' }
        }

        const nom = (card?.nom || '').trim()
        const horizontal = rStd.w > rStd.h
        const row = {
          user_id: userId, nom: nom || 'Carte à compléter', equipe: card?.equipe || null, annee: card?.annee || null, marque: card?.marque || null,
          collection: card?.collection || null, variation: card?.variation || null, num: card?.num || null, card_number: card?.card_number || null,
          grade: card?.grade || 'Raw', rc: !!card?.rc, auto: !!card?.auto, patch: !!card?.patch, printing_plate: false, booklet: false,
          format: horizontal ? 'horizontal' : 'standard', is_horizontal: horizontal, verso_is_horizontal: versoHorizontal,
          image_recto: imageRecto, image_verso: imageVerso, image_recto_hd: imageRectoHd, image_verso_hd: imageVersoHd,
          notes_perso: nom ? null : 'À compléter (ajout en lot)', notes_perso_public: false,
          disponible_vente: false, prix_vente: null, item_type: 'card',
        }
        const { error } = await supabase.from('cartes_manuelles').insert(row)
        if (error) throw new Error(error.message)
        fetch('/api/card-added', { method: 'POST', headers: auth, body: JSON.stringify({ userId, rc: row.rc, auto: row.auto, patch: row.patch, num: !!row.num }) }).catch(() => {})
        if (nom) fetch('/api/wishlist-notify', { method: 'PUT', headers: auth, body: JSON.stringify({ card: { nom, annee: row.annee, marque: row.marque, collection: row.collection, variation: row.variation, num: row.num, rc: row.rc, auto: row.auto, patch: row.patch }, cardUserId: userId }) }).catch(() => {})
        set(e.id, nom ? { s: 'done', nom } : { s: 'todo', msg: 'À compléter' })
      } catch (err: any) {
        set(e.id, { s: 'error', msg: err?.message || 'échec' })
      }
    }
    setRunning(false); setFinished(true)
    if (aiNote) toast.error(aiNote)
  }

  const counts = Object.values(status).reduce((a, v) => { a[v.s] = (a[v.s] || 0) + 1; return a }, {} as Record<string, number>)
  const okCount = (counts.done || 0) + (counts.todo || 0)
  const label: Record<Status, string> = { wait: 'En attente', detect: 'Détection des coins…', upload: 'Envoi des photos…', scan: 'Identification…', done: 'Ajoutée', todo: 'Ajoutée — à compléter', error: 'Échec' }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 120px' }}>
      <Link href={`/galerie/${userId}/ajouter`} style={{ fontSize: 13, textDecoration: 'underline' }}>← Ajouter une seule carte</Link>
      <h1 style={{ margin: '10px 0 4px' }}>Ajouter plusieurs cartes</h1>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 18px' }}>Choisis les photos de plusieurs cartes d’un coup, <b>recto et verso</b>. Elles sont envoyées en haute qualité, puis identifiées automatiquement. Tu pourras corriger chaque carte ensuite.</p>

      <div className="da-lot-box">
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = '' }} />
        <button type="button" className="da-confirm-btn primary" onClick={() => inputRef.current?.click()} disabled={running}>📷 Choisir des photos</button>
        <span style={{ fontSize: 13, color: 'var(--text2, #666)' }}>{photos.length} photo{photos.length > 1 ? 's' : ''} · {entries.length} carte{entries.length > 1 ? 's' : ''} (max {MAX_CARDS})</span>
        {photos.length > 0 && !running && <button type="button" className="da-lot-link" onClick={clearAll}>Tout effacer</button>}
      </div>

      <div className="da-lot-box" style={{ marginTop: 10 }}>
        <input ref={binderRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onBinderPick(e.target.files); e.target.value = '' }} />
        <button type="button" className="da-confirm-btn" onClick={() => binderRef.current?.click()} disabled={running || binderBusy}>📖 Page de classeur</button>
        <select aria-label="Disposition de la page" value={grid.join('x')} onChange={e => setGrid(e.target.value.split('x').map(Number) as [number, number])} disabled={running || binderBusy} style={{ padding: '8px 10px' }}>
          {['2x2', '3x3', '3x4', '4x3', '2x3', '3x2'].map(g => <option key={g} value={g}>{g.split('x').reverse().join(' × ')}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--text2, #666)', flex: '1 1 200px' }}>{binderMsg || 'Choisis 1 photo (recto) ou 2 photos (recto, puis verso de la page retournée) : les cartes sont repérées et découpées toutes seules. Le menu indique combien de cartes tu attends.'}</span>
      </div>
      {debugImgs.length > 0 && (
        <div style={{ margin: '10px 0' }}>
          <div className="da-lot-label">Cartes repérées par le détecteur</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{debugImgs.map((u, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={u} alt={i ? 'Détection verso' : 'Détection recto'} style={{ maxWidth: 320, width: '100%', border: '1px solid #3a4a8a' }} />)}</div>
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ margin: '14px 0' }}>
          <div className="da-lot-label">Comment sont rangées tes photos ?</div>
          <div className="da-lot-modes" role="radiogroup" aria-label="Rangement des photos">
            {([['alt', 'Recto, verso, recto, verso…'], ['split', 'Tous les rectos, puis tous les versos'], ['single', 'Recto seulement']] as const).map(([m, l]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => changeMode(m)} disabled={running}>{l}</button>
            ))}
          </div>
          <label className="da-lot-ai"><input type="checkbox" checked={autoCorners} onChange={e => setAutoCorners(e.target.checked)} disabled={running} /> Recadrer automatiquement les photos de cartes seules (détection des coins)</label>
          <label className="da-lot-ai"><input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} disabled={running} /> Identifier les cartes avec l’IA (1 identification par carte)</label>
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {entries.map((e, i) => {
          const st = status[e.id]
          return (
            <div key={e.id} className={'da-lot-row' + (st?.s === 'error' ? ' err' : '')}>
              <div className="da-lot-num">{i + 1}</div>
              <div className="da-lot-photos">
                <figure><img src={e.recto.url} alt={`Carte ${i + 1}, recto`} /><figcaption>Recto{e.src?.recto && !running && !finished && <> · <button type="button" className="da-lot-link" onClick={() => setEditing({ id: e.id, side: 'recto' })}>coins</button></>}</figcaption></figure>
                {e.verso ? <figure><img src={e.verso.url} alt={`Carte ${i + 1}, verso`} /><figcaption>Verso{e.src?.verso && !running && !finished && <> · <button type="button" className="da-lot-link" onClick={() => setEditing({ id: e.id, side: 'verso' })}>coins</button></>}</figcaption></figure> : <figure className="empty"><div>Pas de verso</div></figure>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{st?.nom || `Carte ${i + 1}`}</div>
                <div style={{ fontSize: 13, color: st?.s === 'error' ? '#ff8a8a' : st?.s === 'done' ? '#3ddc97' : 'var(--text2, #666)' }}>{st ? (st.s === 'error' ? `Échec : ${st.msg}` : label[st.s]) : label.wait}</div>
              </div>
              {!running && !finished && (
                <div className="da-lot-actions">
                  {e.verso && <button type="button" onClick={() => swap(e.id)} title="Inverser recto et verso" aria-label="Inverser recto et verso">⇄</button>}
                  <button type="button" onClick={() => removeEntry(e.id)} title="Retirer cette carte" aria-label="Retirer cette carte">✕</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editing && (() => { const ref = entries.find(x => x.id === editing.id)?.src?.[editing.side]; return ref ? <CornerEditor full={ref.full} quad={ref.quad} label={`Carte ${entries.findIndex(x => x.id === editing.id) + 1} · ${editing.side}`} onSave={saveCorners} onCancel={() => setEditing(null)} /> : null })()}

      {entries.length > 0 && (
        <div className="da-sticky-actions" style={{ bottom: isAppUI ? NAV_TOTAL_HEIGHT_CSS : 0 }}>
          {finished ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <b style={{ flex: 1, minWidth: 180 }}>{okCount} carte{okCount > 1 ? 's' : ''} ajoutée{okCount > 1 ? 's' : ''}{counts.error ? ` · ${counts.error} en échec` : ''}{counts.todo ? ` · ${counts.todo} à compléter` : ''}</b>
              <Link href={`/galerie/${userId}`} className="da-confirm-btn primary" style={{ textDecoration: 'none' }}>Voir ma galerie</Link>
              <button type="button" className="da-confirm-btn" onClick={clearAll}>Ajouter d’autres cartes</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {running && <button type="button" className="da-confirm-btn" onClick={() => { cancelRef.current = true }}>Arrêter</button>}
              <button type="button" className="btn-main btn-primary" style={{ flex: 1 }} disabled={running} onClick={run}>
                {running ? `Ajout en cours… ${okCount + (counts.error || 0)} / ${entries.length}` : `Ajouter ${entries.length} carte${entries.length > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
