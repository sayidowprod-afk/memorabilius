'use client'
// Ajout en lot : plusieurs cartes d'un coup, avec recto ET verso pour chacune.
// Une seule liste de cartes (`entries`) reçoit toutes les sources : photos choisies, rafale caméra, page de classeur.
// Les photos sont réduites, envoyées, puis (au choix) identifiées par l'IA existante (/api/scan-card, 1 scan par carte).
// Une carte non identifiée est enregistrée « À compléter » : rien n'est perdu. On peut arrêter, reprendre, et réessayer les échecs.
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
import BurstCamera from '@/components/BurstCamera'
import CollectionTagSelect from '@/components/CollectionTagSelect'
import { detectBinderCards } from '@/lib/binderDetect'
import { draftPut, draftDelete, draftPutMeta, draftLoad, draftClear, type DraftEntry } from '@/lib/lotDraft'

type Photo = { file: File; url: string }
type SrcRef = { full: HTMLCanvasElement; quad: Quad }
type CropRes = { file: File; ok: boolean; quad?: Quad }
// cropped : la photo est déjà une carte découpée (page de classeur) ; src : la grande photo d'origine, pour réajuster les coins
// weak : emplacement simplement estimé (peut-être une pochette vide) ; skip : ignorée à l'ajout ; session/slot : d'où vient la carte dans la page de classeur
// rawRecto/rawVerso : photos d'origine gardées après le recadrage automatique (pour réajuster les coins) ; quadRecto/quadVerso : coins trouvés
// check : le recadrage automatique a échoué sur cette face (« à vérifier ») ; det : détection des coins faite dès l'ajout à la liste
type Entry = { id: number; recto: Photo; verso: Photo | null; cropped?: boolean; src?: { recto?: SrcRef; verso?: SrcRef }; weak?: boolean; skip?: boolean; session?: number; slot?: number
  rawRecto?: File; rawVerso?: File; quadRecto?: Quad; quadVerso?: Quad; check?: { recto?: boolean; verso?: boolean }; det?: 'pending' | 'done' }
type Status = 'wait' | 'detect' | 'upload' | 'scan' | 'done' | 'todo' | 'error'
type Mode = 'alt' | 'split' | 'single'
type Analysed = { full: HTMLCanvasElement; quads: Quad[]; weak: boolean[]; lattice: boolean; grid: [number, number]; overlay: string }
type Binder = { id: number; A: Analysed; B: Analysed | null }
type St = { s: Status; msg?: string; nom?: string }

const MAX_CARDS = 30
const MAX_SIDE = 4096 // taille maximale gardée en mémoire pour une photo de page de classeur
const PARALLEL = 3 // cartes envoyées en même temps
const GRIDS = ['3x3', '2x2', '3x2', '2x3', '3x4', '4x3'] // [lignes]x[colonnes]
let nextId = 1
let nextSession = 1

const photoOf = (file: File): Photo => ({ file, url: URL.createObjectURL(file) })
const isOver = (s?: Status) => s === 'done' || s === 'todo'

function buildEntries(photos: Photo[], mode: Mode): Entry[] {
  if (mode === 'single') return photos.map(p => ({ id: nextId++, recto: p, verso: null }))
  if (mode === 'split') {
    const half = Math.floor(photos.length / 2)
    return Array.from({ length: half }, (_, i) => ({ id: nextId++, recto: photos[i], verso: photos[half + i] ?? null }))
  }
  const out: Entry[] = []
  for (let i = 0; i < photos.length; i += 2) out.push({ id: nextId++, recto: photos[i], verso: photos[i + 1] ?? null })
  return out
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* repli ci-dessous */ }
  return await new Promise((res, rej) => {
    const img = new Image(); const u = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(u); res(img) }; img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image illisible')) }; img.src = u
  })
}
const dimsOf = (img: ImageBitmap | HTMLImageElement) => ({ w: 'naturalWidth' in img ? img.naturalWidth : img.width, h: 'naturalHeight' in img ? img.naturalHeight : img.height })

// Une photo décodée une seule fois, réduite à plusieurs tailles (au lieu de la décoder à chaque taille : moins de mémoire, plus rapide)
async function resizeMany(file: File, specs: { max: number; q: number }[]): Promise<{ blob: Blob; w: number; h: number }[]> {
  const img = await decode(file)
  try {
    const { w: w0, h: h0 } = dimsOf(img)
    const out: { blob: Blob; w: number; h: number }[] = []
    for (const { max, q } of specs) {
      const scale = Math.min(1, max / Math.max(w0, h0))
      const w = Math.max(1, Math.round(w0 * scale)), h = Math.max(1, Math.round(h0 * scale))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, w, h)
      const blob: Blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encodage impossible')), 'image/jpeg', q))
      c.width = c.height = 0
      out.push({ blob, w, h })
    }
    return out
  } finally { if ('close' in img) img.close() }
}

// Photo entière sur un canvas, limitée à MAX_SIDE pour ne pas saturer la mémoire du téléphone
async function loadCanvas(file: File): Promise<HTMLCanvasElement> {
  const img = await decode(file)
  try {
    const { w: W, h: H } = dimsOf(img)
    const k = Math.min(1, MAX_SIDE / Math.max(W, H))
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k)
    c.getContext('2d')!.drawImage(img as CanvasImageSource, 0, 0, c.width, c.height)
    return c
  } finally { if ('close' in img) img.close() }
}
const freeCanvas = (c: HTMLCanvasElement) => { c.width = 0; c.height = 0 }

// Recadre une photo de carte seule avec le détecteur de coins maison (YOLO) : même résultat que l'ajout à l'unité, sans l'écran de réglage.
// Si rien de fiable n'est trouvé, la photo d'origine est gardée telle quelle.
async function autoCrop(file: File): Promise<CropRes> {
  let full: HTMLCanvasElement | null = null
  try {
    full = await loadCanvas(file)
    const W = full.width, H = full.height
    const small = document.createElement('canvas'); const k = Math.min(1, 1280 / Math.max(W, H)); small.width = Math.round(W * k); small.height = Math.round(H * k)
    small.getContext('2d')!.drawImage(full, 0, 0, small.width, small.height)
    const el = await new Promise<HTMLImageElement>((res, rej) => small.toBlob(b => {
      if (!b) return rej(new Error('encodage impossible'))
      const u = URL.createObjectURL(b); const im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im) }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image illisible')) }; im.src = u
    }, 'image/jpeg', 0.9))
    const pts = await detectCornersYOLO(el)
    const sw = small.width, sh = small.height
    freeCanvas(small)
    if (!pts || pts.length !== 4) return { file, ok: false }
    const q: Quad = { topLeft: { x: pts[0].x / sw, y: pts[0].y / sh }, topRight: { x: pts[1].x / sw, y: pts[1].y / sh }, bottomRight: { x: pts[2].x / sw, y: pts[2].y / sh }, bottomLeft: { x: pts[3].x / sw, y: pts[3].y / sh } }
    const ps = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft]
    const area = Math.abs(ps.reduce((a, p, i) => { const r = ps[(i + 1) % 4]; return a + (p.x * r.y - r.x * p.y) }, 0)) / 2
    const w = (Math.hypot((q.topRight.x - q.topLeft.x) * W, (q.topRight.y - q.topLeft.y) * H) + Math.hypot((q.bottomRight.x - q.bottomLeft.x) * W, (q.bottomRight.y - q.bottomLeft.y) * H)) / 2
    const h = (Math.hypot((q.bottomLeft.x - q.topLeft.x) * W, (q.bottomLeft.y - q.topLeft.y) * H) + Math.hypot((q.bottomRight.x - q.topRight.x) * W, (q.bottomRight.y - q.topRight.y) * H)) / 2
    const ratio = w / Math.max(1, h)
    const plausible = area > 0.1 && ((ratio > 0.55 && ratio < 0.95) || (ratio > 1.05 && ratio < 1.8)) && ps.every(p => p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02)
    if (!plausible) return { file, ok: false }
    return { file: new File([await cropQuad(full, q, 3200)], file.name.replace(/\.\w+$/, '') + '_recadree.jpg', { type: 'image/jpeg' }), ok: true, quad: q }
  } catch { return { file, ok: false } } finally { if (full) freeCanvas(full) }
}

const toBase64 = (blob: Blob) => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(blob) })

// Analyse une page de classeur : cartes trouvées (en fractions de la photo), emplacements simplement estimés, image de contrôle
async function analyse(full: HTMLCanvasElement, rows: number, cols: number, label: string, say: (m: string) => void): Promise<Analysed> {
  const W = full.width, H = full.height
  const res = await detectBinderCards(full, rows, cols, m => say(`${label} : ${m}`))
  const k = Math.min(1, 700 / W), cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k)
  const ctx = cv.getContext('2d')!; ctx.drawImage(full, 0, 0, cv.width, cv.height); ctx.lineWidth = 3; ctx.font = 'bold 26px sans-serif'
  res.slots.forEach((sl, i) => {
    const q = sl.quad, pts = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft]
    ctx.strokeStyle = ctx.fillStyle = sl.how === 'prédite' ? '#ffd84d' : '#3ddc97'
    ctx.beginPath(); pts.forEach((p, j) => { if (j) ctx.lineTo(p.x * k, p.y * k); else ctx.moveTo(p.x * k, p.y * k) }); ctx.closePath(); ctx.stroke()
    ctx.fillText(String(i + 1), q.topLeft.x * k + 8, q.topLeft.y * k + 28)
  })
  const norm = (p: { x: number; y: number }) => ({ x: p.x / W, y: p.y / H })
  const quads: Quad[] = res.slots.map(sl => ({ topLeft: norm(sl.quad.topLeft), topRight: norm(sl.quad.topRight), bottomRight: norm(sl.quad.bottomRight), bottomLeft: norm(sl.quad.bottomLeft) }))
  const overlay = cv.toDataURL('image/jpeg', 0.8); freeCanvas(cv)
  return { full, quads, weak: res.slots.map(sl => sl.how === 'prédite'), lattice: res.lattice, grid: res.grid, overlay }
}

export default function AjoutLotPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const router = useRouter()
  const isAppUI = useIsAppUI()
  const inputRef = useRef<HTMLInputElement>(null)
  const binderRef = useRef<HTMLInputElement>(null)
  const versoRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('alt')
  const [entries, setEntries] = useState<Entry[]>([])
  const [useAI, setUseAI] = useState(true)
  // réglages appliqués à toutes les cartes de ce lot (comme dans l'ajout d'une seule carte)
  const [collectionTag, setCollectionTag] = useState('')
  const [forSale, setForSale] = useState(false)
  // collection propre à une carte ('' = celle du lot, NONE = aucune collection)
  const NONE = '__none'
  const [cardTag, setCardTag] = useState<Record<number, string>>({})
  const [allTags, setAllTags] = useState<string[]>([])
  useEffect(() => {
    let off = false
    ;(async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from('cartes_manuelles').select('collection_tag').eq('user_id', userId).not('collection_tag', 'is', null),
        supabase.from('carte_tags').select('collection_tag').eq('user_id', userId),
        supabase.from('card_collections').select('collection').eq('user_id', userId),
        supabase.from('collection_tab_settings').select('tag').eq('user_id', userId),
      ])
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const all = [...(a.data || []).map((r: any) => r.collection_tag), ...(b.data || []).map((r: any) => r.collection_tag), ...(c.data || []).map((r: any) => r.collection), ...(d.data || []).map((r: any) => r.tag)].filter(Boolean)
      if (!off) setAllTags([...new Set(all as string[])].sort())
    })().catch(() => {})
    return () => { off = true }
  }, [userId])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<Record<number, St>>({})
  const cancelRef = useRef(false)
  const [binder, setBinder] = useState<Binder | null>(null)
  const [binderMsg, setBinderMsg] = useState<string | null>(null)
  const [binderBusy, setBinderBusy] = useState(false)
  const [autoCorners, setAutoCorners] = useState(true)
  const [burst, setBurst] = useState(false)
  const [editing, setEditing] = useState<{ id: number; side: 'recto' | 'verso' } | null>(null)
  const [gridSel, setGridSel] = useState('auto')
  // toujours la dernière valeur, pour le nettoyage à la fermeture de la page
  const live = useRef<{ entries: Entry[]; binder: Binder | null }>({ entries: [], binder: null })
  useEffect(() => { live.current = { entries, binder } })
  const statusRef = useRef<Record<number, St>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (!user || user.id !== userId) router.replace('/connexion') })
  }, [userId, router])

  // libère les photos gardées en mémoire quand on quitte la page
  useEffect(() => () => {
    const { entries: es, binder: b } = live.current
    es.forEach(e => { URL.revokeObjectURL(e.recto.url); if (e.verso) URL.revokeObjectURL(e.verso.url) })
    if (b) { freeCanvas(b.A.full); if (b.B) freeCanvas(b.B.full) }
    es.forEach(e => { if (e.src) { if (e.src.recto) freeCanvas(e.src.recto.full); if (e.src.verso) freeCanvas(e.src.verso.full) } })
  }, [])

  // pendant l'envoi : prévient avant de fermer la page, et garde l'écran allumé (le téléphone ne doit pas se mettre en veille)
  useEffect(() => {
    if (!running) return
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    let lock: { release?: () => Promise<void> } | null = null
    ;(navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof lock> } }).wakeLock?.request('screen').then(l => { lock = l }).catch(() => {})
    return () => { window.removeEventListener('beforeunload', onLeave); lock?.release?.().catch(() => {}) }
  }, [running])

  const set = (id: number, v: St) => { statusRef.current = { ...statusRef.current, [id]: v }; setStatus(statusRef.current) }
  const freePhotos = (e: Entry) => { URL.revokeObjectURL(e.recto.url); if (e.verso) URL.revokeObjectURL(e.verso.url) }

  // ajoute des cartes à la liste, dans la limite de MAX_CARDS (les photos en trop sont libérées et signalées)
  const addEntries = (list: Entry[]) => {
    const room = Math.max(0, MAX_CARDS - entries.length)
    const keep = list.slice(0, room), drop = list.slice(room)
    drop.forEach(freePhotos)
    if (drop.length) toast.error(`Maximum ${MAX_CARDS} cartes par ajout : ${drop.length} carte${drop.length > 1 ? 's' : ''} non ajoutée${drop.length > 1 ? 's' : ''}.`)
    if (keep.length) setEntries(es => [...es, ...keep])
    return keep
  }

  // le rangement choisi (recto/verso…) s'applique aux photos qu'on choisit ensuite : les cartes déjà dans la liste ne bougent pas
  const onPick = (files: FileList | null) => {
    if (!files?.length) return
    const photos = Array.from(files).filter(f => f.type.startsWith('image/')).map(photoOf)
    const list = buildEntries(photos, mode)
    const used = new Set(list.flatMap(e => [e.recto.url, e.verso?.url]))
    photos.filter(p => !used.has(p.url)).forEach(p => URL.revokeObjectURL(p.url)) // photo restée sans paire (nombre impair en mode « tous les rectos puis tous les versos »)
    addEntries(list)
  }
  // rafale caméra : les photos prises arrivent comme si on les avait choisies (recto, verso, recto, verso… ou recto seul)
  const onBurstDone = (files: File[], faces: 1 | 2) => {
    setBurst(false)
    addEntries(buildEntries(files.map(photoOf), faces === 2 ? 'alt' : 'single'))
  }

  const removeEntry = (id: number) => {
    const e = entries.find(x => x.id === id)
    if (e) freePhotos(e)
    setEntries(es => es.filter(x => x.id !== id))
    if (e?.src && !e.session) { if (e.src.recto) freeCanvas(e.src.recto.full); if (e.src.verso) freeCanvas(e.src.verso.full) }
  }
  const toggleSkip = (id: number) => setEntries(es => es.map(e => e.id === id ? { ...e, skip: !e.skip } : e))
  const swap = (id: number) => setEntries(es => es.map(e => e.id === id && e.verso ? { ...e, recto: e.verso, verso: e.recto, src: e.src?.verso ? { recto: e.src.verso, verso: e.src.recto } : e.src,
    rawRecto: e.rawVerso, rawVerso: e.rawRecto, quadRecto: e.quadVerso, quadVerso: e.quadRecto, check: e.check ? { recto: e.check.verso, verso: e.check.recto } : e.check } : e))
  // réajustement manuel des coins : on redécoupe la carte depuis la grande photo d'origine
  const saveCorners = async (q: Quad) => {
    if (!editing) return
    const { id, side } = editing
    const e = entries.find(x => x.id === id); const ref = e?.src?.[side]
    setEditing(null)
    if (!e || !ref) return
    const photo = photoOf(new File([await cropQuad(ref.full, q, e.rawRecto || e.rawVerso ? 3200 : undefined)], `${e.session ? 'classeur' : 'carte'}_${id}_${side}.jpg`, { type: 'image/jpeg' }))
    URL.revokeObjectURL(e[side]!.url)
    setEntries(es => es.map(x => x.id === id ? { ...x, [side]: photo, src: { ...x.src, [side]: { full: ref.full, quad: q } }, check: { ...x.check, [side]: false } } : x))
  }
  // ouvre le réglage des coins : pour une photo de carte seule, la grande photo d'origine est rechargée à la demande (rien n'est gardé en mémoire avant)
  const openEditor = async (id: number, side: 'recto' | 'verso') => {
    const e = entries.find(x => x.id === id); if (!e) return
    if (e.src?.[side]) { setEditing({ id, side }); return }
    const raw = side === 'recto' ? e.rawRecto : e.rawVerso
    if (!raw) return
    try {
      const full = await loadCanvas(raw)
      const q = (side === 'recto' ? e.quadRecto : e.quadVerso) || { topLeft: { x: 0.12, y: 0.08 }, topRight: { x: 0.88, y: 0.08 }, bottomRight: { x: 0.88, y: 0.92 }, bottomLeft: { x: 0.12, y: 0.92 } }
      setEntries(es => es.map(x => x.id === id ? { ...x, src: { ...x.src, [side]: { full, quad: q } } } : x))
      setEditing({ id, side })
    } catch { toast.error('Photo illisible : impossible d’ouvrir le réglage des coins.') }
  }
  const clearAll = () => {
    entries.forEach(e => { freePhotos(e); if (e.src) { if (e.src.recto) freeCanvas(e.src.recto.full); if (e.src.verso) freeCanvas(e.src.verso.full) } })
    if (binder) { freeCanvas(binder.A.full); if (binder.B) freeCanvas(binder.B.full) }
    setEntries([]); statusRef.current = {}; setStatus({}); setBinder(null); setBinderMsg(null)
  }

  // ── Page de classeur ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Le détecteur maison (YOLO dans le navigateur, le même que le scanner) cherche les cartes sur toute la photo, en déduit le réseau régulier
  // des pochettes (donc la disposition, si on ne l'a pas précisée) pour retrouver celles qu'il a ratées, puis affine chaque carte (lib/binderDetect.ts).
  // Aucun appel serveur, aucun coût. On photographie le recto, puis (facultatif) le verso de la page retournée.
  const versoSlot = (g: [number, number], i: number) => Math.floor(i / g[1]) * g[1] + (g[1] - 1 - (i % g[1])) // verso en miroir : la colonne c du recto est la colonne (cols-1-c) du verso

  const buildFromBinder = async (b: Binder, room: number): Promise<Entry[]> => {
    const { A, B } = b
    const [r, c] = A.grid
    const paired = !!B && A.lattice && B.lattice && r > 0 && A.quads.length === r * c && B.quads.length === r * c
    const out: Entry[] = []
    const mk = async (full: HTMLCanvasElement, q: Quad, nm: string) => photoOf(new File([await cropQuad(full, q)], nm, { type: 'image/jpeg' }))
    for (let i = 0; i < A.quads.length && out.length < room; i++) {
      const vq = paired && B ? B.quads[versoSlot(A.grid, i)] : null
      out.push({
        id: nextId++, cropped: true, session: b.id, slot: i, weak: A.weak[i], skip: A.weak[i],
        recto: await mk(A.full, A.quads[i], `classeur_${i + 1}_recto.jpg`),
        verso: vq && B ? await mk(B.full, vq, `classeur_${i + 1}_verso.jpg`) : null,
        src: { recto: { full: A.full, quad: A.quads[i] }, verso: vq && B ? { full: B.full, quad: vq } : undefined },
      })
    }
    return out
  }
  const describe = (b: Binder, count: number, guessed: boolean) => {
    const { A, B } = b
    const weak = A.weak.filter(Boolean).length
    const [r, c] = A.grid
    const paired = !!B && A.lattice && B.lattice && r > 0 && A.quads.length === r * c && B.quads.length === r * c
    return `${count} carte${count > 1 ? 's' : ''} trouvée${count > 1 ? 's' : ''}${r ? ` · disposition ${c} × ${r}${guessed ? ' (devinée, change-la dans le menu si besoin)' : ''}` : ' · disposition non reconnue'}`
      + `${weak ? ` · ${weak} emplacement${weak > 1 ? 's' : ''} estimé${weak > 1 ? 's' : ''} (contour jaune), ignoré${weak > 1 ? 's' : ''} tant que tu ne les coches pas` : ''}`
      + `${B && !paired ? ' · verso non apparié (toutes les cartes n’ont pas été repérées des deux côtés)' : ''}`
      + (B && paired ? ' · versos associés.' : '. Tu peux maintenant ajouter le verso de la page, ou lancer l’ajout.')
  }

  const withBinderBusy = async (fn: () => Promise<void>) => {
    if (binderBusy || running) return
    setBinderBusy(true)
    try {
      setBinderMsg('Chargement du détecteur…')
      if (!(await waitForYOLO(30000))) throw new Error('le modèle de détection ne s’est pas chargé, réessaie.')
      await fn()
    } catch (e: unknown) { setBinderMsg('Échec : ' + ((e as Error)?.message || 'erreur')) }
    finally { setBinderBusy(false) }
  }
  const selGrid = (sel: string): [number, number] => sel === 'auto' ? [0, 0] : (sel.split('x').map(Number) as [number, number])

  const onBinderRecto = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    void withBinderBusy(async () => {
      const [rows, cols] = selGrid(gridSel)
      const full = await loadCanvas(f)
      const A = await analyse(full, rows, cols, 'Page', setBinderMsg)
      if (!A.quads.length) { freeCanvas(full); throw new Error('aucune carte trouvée sur la photo.') }
      const b: Binder = { id: nextSession++, A, B: null }
      setBinderMsg('Découpage des cartes…')
      const added = addEntries(await buildFromBinder(b, Math.max(0, MAX_CARDS - entries.length)))
      setBinder(b)
      setBinderMsg(describe(b, added.length, gridSel === 'auto'))
    })
  }

  const onBinderVerso = (files: FileList | null) => {
    const f = files?.[0]
    if (!f || !binder) return
    void withBinderBusy(async () => {
      const full = await loadCanvas(f)
      const [r, c] = binder.A.grid
      if (!r) { freeCanvas(full); throw new Error('la disposition de la page n’a pas été reconnue : choisis-la dans le menu puis refais la page.') }
      const B = await analyse(full, r, c, 'Verso', setBinderMsg)
      const b: Binder = { ...binder, B }
      const paired = B.lattice && binder.A.lattice && binder.A.quads.length === r * c && B.quads.length === r * c
      if (!paired) { freeCanvas(full); setBinderMsg(`Verso non apparié : ${B.quads.length} carte${B.quads.length > 1 ? 's' : ''} repérée${B.quads.length > 1 ? 's' : ''} sur ${r * c}. Vérifie que la photo montre bien la page retournée en entier.`); return }
      setBinderMsg('Découpage des versos…')
      const cut = new Map<number, Entry['verso'] | null>()
      for (const e of entries) if (e.session === b.id && e.slot !== undefined) {
        const q = B.quads[versoSlot(binder.A.grid, e.slot)]
        const bl = await cropQuad(full, q)
        cut.set(e.id, photoOf(new File([bl], `classeur_${e.slot + 1}_verso.jpg`, { type: 'image/jpeg' })))
      }
      setEntries(es => es.map(e => {
        const v = cut.get(e.id); if (!v) return e
        if (e.verso) URL.revokeObjectURL(e.verso.url)
        return { ...e, verso: v, src: { ...e.src!, verso: { full, quad: B.quads[versoSlot(binder.A.grid, e.slot!)] } } }
      }))
      setBinder(b)
      setBinderMsg(describe(b, binder.A.quads.length, false))
    })
  }

  // changer la disposition après coup refait l'analyse de la dernière page de classeur (ses cartes sont remplacées)
  const changeGrid = (sel: string) => {
    setGridSel(sel)
    if (!binder || running || binderBusy) return
    const mine = entries.filter(e => e.session === binder.id)
    if (!mine.length || mine.some(e => isOver(status[e.id]?.s))) return
    void withBinderBusy(async () => {
      const [rows, cols] = selGrid(sel)
      const A = await analyse(binder.A.full, rows, cols, 'Page', setBinderMsg)
      const B = binder.B && A.grid[0] ? await analyse(binder.B.full, A.grid[0], A.grid[1], 'Verso', setBinderMsg) : null
      mine.forEach(freePhotos)
      const b: Binder = { id: nextSession++, A, B }
      setEntries(es => es.filter(e => e.session !== binder.id))
      setBinderMsg('Découpage des cartes…')
      const made = await buildFromBinder(b, MAX_CARDS)
      setEntries(es => [...es, ...made.slice(0, Math.max(0, MAX_CARDS - es.length))])
      setBinder(b)
      setBinderMsg(describe(b, made.length, sel === 'auto'))
    })
  }

  // ── Détection des coins dès l'ajout à la liste (439) ──────────────────────────────────────────────────────────────────────────
  // Chaque photo de carte seule est recadrée tout de suite (une à la fois), pour qu'on voie le résultat avant d'envoyer. Si le détecteur ne trouve
  // rien de fiable, la photo est gardée telle quelle et marquée « recadrage à vérifier » : on peut régler les coins à la main.
  const detBusy = useRef(false)
  const [detTick, setDetTick] = useState(0)
  useEffect(() => {
    if (!autoCorners || running || detBusy.current) return
    const next = entries.find(e => !e.cropped && !e.det && !isOver(statusRef.current[e.id]?.s))
    if (!next) return
    detBusy.current = true
    setEntries(es => es.map(x => x.id === next.id ? { ...x, det: 'pending' } : x))
    ;(async () => {
      let r: CropRes | null = null, v: CropRes | null = null, failed = false
      try {
        if (!(await waitForYOLO(30000))) throw new Error('détecteur indisponible')
        r = await autoCrop(next.recto.file)
        if (next.verso) v = await autoCrop(next.verso.file)
      } catch { failed = true }
      setEntries(es => es.map(x => {
        if (x.id !== next.id) return x
        const rPhoto = r?.ok ? photoOf(r.file) : null, vPhoto = v?.ok ? photoOf(v.file) : null
        if (rPhoto) URL.revokeObjectURL(x.recto.url)
        if (vPhoto && x.verso) URL.revokeObjectURL(x.verso.url)
        return { ...x, det: 'done', cropped: true, rawRecto: x.recto.file, rawVerso: x.verso?.file, quadRecto: r?.quad, quadVerso: v?.quad,
          recto: rPhoto || x.recto, verso: vPhoto || x.verso, check: { recto: failed || !r?.ok, verso: !!x.verso && (failed || !v?.ok) } }
      }))
      detBusy.current = false
      setDetTick(t => t + 1)
    })()
  }, [entries, autoCorners, running, detTick])

  // ── Brouillon : reprise après coupure (442) ─────────────────────────────────────────────────────────────────────────────────────
  // Les cartes pas encore ajoutées sont gardées sur l'appareil. Si la page se ferme, on propose de reprendre au retour.
  const [draftInfo, setDraftInfo] = useState<{ n: number; done: number; total: number } | null>(null)
  const draftSaved = useRef<Map<number, string>>(new Map())
  const [draftReady, setDraftReady] = useState(false)
  useEffect(() => {
    let off = false
    draftLoad(userId).then(({ meta, entries: es }) => {
      if (off) return
      if (es.length) setDraftInfo({ n: es.length, done: meta?.done ?? 0, total: meta?.total ?? es.length })
      else draftClear(userId)
      setDraftReady(true)
    })
    return () => { off = true }
  }, [userId])
  useEffect(() => {
    if (!draftReady || draftInfo) return // tant que l'ancien brouillon n'est ni repris ni effacé, on ne l'écrase pas
    const pending = entries.filter(e => !isOver(status[e.id]?.s))
    const live = new Set(pending.map(e => e.id))
    for (const [id] of [...draftSaved.current]) if (!live.has(id)) { draftSaved.current.delete(id); draftDelete(userId, id) }
    for (const e of pending) {
      const sig = [e.recto.url, e.verso?.url, e.skip, e.check?.recto, e.check?.verso, cardTag[e.id]].join('|')
      if (draftSaved.current.get(e.id) === sig) continue
      draftSaved.current.set(e.id, sig)
      const d: DraftEntry = { recto: e.recto.file, verso: e.verso?.file ?? null, rawRecto: e.rawRecto, rawVerso: e.rawVerso, quadRecto: e.quadRecto, quadVerso: e.quadVerso, cropped: e.cropped, weak: e.weak, skip: e.skip, check: e.check, tag: cardTag[e.id] }
      draftPut(userId, e.id, d)
    }
    if (pending.length) draftPutMeta(userId, { collectionTag, forSale, useAI, autoCorners, total: entries.length, done: entries.length - pending.length, savedAt: Date.now() })
  }, [entries, status, cardTag, collectionTag, forSale, useAI, autoCorners, draftInfo, draftReady, userId])
  const resumeDraft = async () => {
    const { meta, entries: es } = await draftLoad(userId)
    await draftClear(userId)
    draftSaved.current = new Map()
    const made: Entry[] = es.slice(0, MAX_CARDS).map(d => ({
      id: nextId++, recto: photoOf(d.recto), verso: d.verso ? photoOf(d.verso) : null, rawRecto: d.rawRecto, rawVerso: d.rawVerso, quadRecto: d.quadRecto, quadVerso: d.quadVerso,
      cropped: d.cropped, weak: d.weak, skip: d.skip, check: d.check, det: d.cropped ? 'done' : undefined,
    }))
    const tags: Record<number, string> = {}
    made.forEach((m, i) => { if (es[i].tag) tags[m.id] = es[i].tag as string })
    if (meta) { setCollectionTag(meta.collectionTag || ''); setForSale(!!meta.forSale); setUseAI(meta.useAI !== false); setAutoCorners(meta.autoCorners !== false) }
    setCardTag(m => ({ ...m, ...tags }))
    setEntries(list => [...list, ...made])
    setDraftInfo(null)
  }
  const dropDraft = async () => { await draftClear(userId); draftSaved.current = new Map(); setDraftInfo(null) }

  // ── Envoi ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const included = entries.filter(e => !e.skip)
  const doneN = included.filter(e => isOver(status[e.id]?.s)).length
  const errN = included.filter(e => status[e.id]?.s === 'error').length
  const todoN = included.filter(e => status[e.id]?.s === 'todo').length
  const pendingN = included.length - doneN
  const skippedN = entries.length - included.length

  const run = async () => {
    if (running || !pendingN) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || session.user.id !== userId) { toast.error('Ta session a expiré : reconnecte-toi puis reviens ici (tes photos de cette page seront à rechoisir).'); router.replace('/connexion'); return }
    cancelRef.current = false; setRunning(true)
    const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
    let aiOn = useAI
    let aiNote = ''
    // le détecteur de coins ne traite qu'une photo à la fois ; le reste (envoi, identification) se fait en parallèle
    let chain: Promise<unknown> = Promise.resolve()
    const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p }

    const queue = entries.filter(e => !e.skip && !isOver(status[e.id]?.s))
    queue.forEach(e => set(e.id, { s: 'wait' }))
    const processOne = async (e: Entry) => {
      const uploaded: string[] = []
      try {
        let rectoFile = e.recto.file, versoFile = e.verso?.file ?? null
        if (autoCorners && !e.cropped) {
          set(e.id, { s: 'detect' })
          await exclusive(async () => {
            if (!(await waitForYOLO(30000))) return // détecteur indisponible : la photo est ajoutée telle quelle (pas d'échec), à recadrer ensuite avec « coins »
            rectoFile = (await autoCrop(rectoFile)).file
            if (versoFile) versoFile = (await autoCrop(versoFile)).file
          })
        }
        set(e.id, { s: 'upload' })
        const ts = `${Date.now()}_${e.id}`
        const [rStd, rHd, rAi] = await resizeMany(rectoFile, [{ max: 1600, q: 0.88 }, { max: 3200, q: 0.92 }, { max: 1200, q: 0.9 }])
        const up = async (blob: Blob, name: string) => {
          const path = `cartes/${userId}/${ts}_${name}.jpg`
          const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
          if (error) throw new Error('envoi de la photo : ' + error.message)
          uploaded.push(path)
          return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        }
        const imageRecto = await up(rStd.blob, 'recto'), imageRectoHd = await up(rHd.blob, 'recto_hd')
        let imageVerso: string | null = null, imageVersoHd: string | null = null, versoHorizontal: boolean | null = null, vAi: Blob | null = null
        if (versoFile) {
          const [vStd, vHd, vA] = await resizeMany(versoFile, [{ max: 1600, q: 0.88 }, { max: 3200, q: 0.92 }, { max: 1200, q: 0.9 }])
          imageVerso = await up(vStd.blob, 'verso'); imageVersoHd = await up(vHd.blob, 'verso_hd')
          versoHorizontal = vStd.w > vStd.h; vAi = vA.blob
        }

        let card: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
        if (aiOn) {
          set(e.id, { s: 'scan' })
          const body: Record<string, unknown> = { imageBase64: await toBase64(rAi.blob), mimeType: 'image/jpeg', itemType: 'card' }
          if (vAi) body.imageBase64Verso = await toBase64(vAi)
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
          collection_tag: (cardTag[e.id] === NONE ? '' : (cardTag[e.id] || collectionTag)) || null, disponible_vente: forSale, prix_vente: null, item_type: 'card',
        }
        const { error } = await supabase.from('cartes_manuelles').insert(row)
        if (error) throw new Error(error.message)
        fetch('/api/card-added', { method: 'POST', headers: auth, body: JSON.stringify({ userId, rc: row.rc, auto: row.auto, patch: row.patch, num: !!row.num }) }).catch(() => {})
        if (nom) fetch('/api/wishlist-notify', { method: 'PUT', headers: auth, body: JSON.stringify({ card: { nom, equipe: row.equipe, annee: row.annee, marque: row.marque, collection: row.collection, variation: row.variation, num: row.num, rc: row.rc, auto: row.auto, patch: row.patch }, cardUserId: userId }) }).catch(() => {})
        set(e.id, nom ? { s: 'done', nom } : { s: 'todo', msg: 'À compléter' })
      } catch (err: unknown) {
        // photos déjà envoyées mais carte non créée : on les retire pour ne pas laisser de fichiers orphelins
        if (uploaded.length) supabase.storage.from('avatars').remove(uploaded).catch(() => {})
        set(e.id, { s: 'error', msg: (err as Error)?.message || 'échec' })
      }
    }
    let qi = 0
    const worker = async () => { while (!cancelRef.current) { const e = queue[qi++]; if (!e) break; await processOne(e) } }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker))
    // les cartes arrêtées avant leur tour repassent « en attente »
    { const n = { ...statusRef.current }; for (const e of queue) if (n[e.id]?.s === 'wait') delete n[e.id]; statusRef.current = n; setStatus(n) }
    setRunning(false)
    releaseDone()
    if (aiNote) toast.error(aiNote)
  }

  // les cartes ajoutées n'ont plus besoin de leurs grandes photos : on libère la mémoire (les autres gardent les leurs, pour les coins)
  const releaseDone = () => {
    const { entries: es, binder: b } = live.current
    const st = statusRef.current
    const doneIds = new Set(es.filter(e => isOver(st[e.id]?.s)).map(e => e.id))
    if (!doneIds.size || !es.some(e => doneIds.has(e.id) && e.src)) return
    const keep = new Set<HTMLCanvasElement>()
    es.forEach(e => { if (!doneIds.has(e.id) && e.src) { if (e.src.recto) keep.add(e.src.recto.full); if (e.src.verso) keep.add(e.src.verso.full) } })
    es.forEach(e => { if (doneIds.has(e.id) && e.src) { for (const r of [e.src.recto, e.src.verso]) if (r && !keep.has(r.full)) freeCanvas(r.full) } })
    if (b && !keep.has(b.A.full) && !(b.B && keep.has(b.B.full))) { freeCanvas(b.A.full); if (b.B) freeCanvas(b.B.full); setBinder(null) }
    setEntries(list => list.map(e => doneIds.has(e.id) && e.src ? { ...e, src: undefined } : e))
  }


  // 283 · pastille d'état sur la miniature : roue pendant le traitement, coche verte quand la carte est ajoutée, point d'exclamation si elle est à compléter
  const badge = (s?: Status) => {
    if (!s || s === 'wait') return null
    if (s === 'detect' || s === 'upload' || s === 'scan') return <span className="da-lot-badge run" role="img" aria-label="En cours" />
    if (s === 'done') return <span className="da-lot-badge ok selection-check-pop" role="img" aria-label="Ajoutée">✓</span>
    if (s === 'todo') return <span className="da-lot-badge todo selection-check-pop" role="img" aria-label="Ajoutée, à compléter">!</span>
    return <span className="da-lot-badge err" role="img" aria-label="Échec">✕</span>
  }
  const label: Record<Status, string> = { wait: 'En attente', detect: 'Détection des coins…', upload: 'Envoi des photos…', scan: 'Identification…', done: 'Ajoutée', todo: 'Ajoutée — à compléter', error: 'Échec' }
  const idle = !running && !binderBusy
  const lastBinderEntries = binder ? entries.filter(e => e.session === binder.id) : []
  const canVerso = !!binder && !binder.B && lastBinderEntries.length > 0 && idle && !lastBinderEntries.some(e => isOver(status[e.id]?.s))

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 120px' }}>
      <Link href={`/galerie/${userId}/ajouter`} style={{ fontSize: 13, textDecoration: 'underline' }} onClick={e => { if (running && !window.confirm('Un ajout est en cours : quitter maintenant l’interrompt. Continuer ?')) e.preventDefault() }}>← Ajouter une seule carte</Link>
      <h1 style={{ margin: '10px 0 4px' }}>Ajouter plusieurs cartes</h1>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 18px' }}>Ajoute tes cartes <b>par photos, en rafale ou par page de classeur</b>, vérifie la liste, puis lance l’ajout. Les photos sont envoyées en haute qualité et les cartes identifiées automatiquement. Tu pourras corriger chaque carte ensuite.</p>

      {draftInfo && entries.length === 0 && (
        <div role="status" style={{ border: '3px solid #e0a526', padding: '12px 14px', margin: '0 0 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 100%', minWidth: 0 }}>
            <b>Reprendre ton lot ?</b>
            <div style={{ fontSize: 13, color: 'var(--text2, #666)' }}>{draftInfo.done > 0 ? `${draftInfo.done} carte${draftInfo.done > 1 ? 's' : ''} sur ${draftInfo.total} déjà ajoutée${draftInfo.done > 1 ? 's' : ''}, ` : ''}{draftInfo.n} pas encore ajoutée{draftInfo.n > 1 ? 's' : ''} (photos gardées sur cet appareil).</div>
          </div>
          <button type="button" className="da-confirm-btn primary" onClick={resumeDraft}>Reprendre</button>
          <button type="button" className="da-confirm-btn" onClick={dropDraft}>Effacer</button>
        </div>
      )}

      <div className="da-lot-label">1 · Ajoute des cartes</div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { onPick(e.target.files); e.target.value = '' }} />
      <input ref={binderRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { onBinderRecto(e.target.files); e.target.value = '' }} />
      <input ref={versoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { onBinderVerso(e.target.files); e.target.value = '' }} />

      <div className="da-lot-box">
        <button type="button" className="da-confirm-btn primary" onClick={() => inputRef.current?.click()} disabled={running}>📷 Choisir des photos</button>
        <button type="button" className="da-confirm-btn" onClick={() => setBurst(true)} disabled={running} title="La caméra reste ouverte : tu prends recto, verso, recto, verso…">🎞️ Mode rafale</button>
        <div style={{ flex: '1 1 100%' }}>
          <div className="da-lot-modes" role="radiogroup" aria-label="Rangement des photos choisies">
            {([['alt', 'Recto, verso, recto, verso…'], ['split', 'Tous les rectos, puis tous les versos'], ['single', 'Recto seulement']] as const).map(([m, l]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} disabled={running}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2, #666)', marginTop: 4 }}>Comment sont rangées les photos que tu vas choisir (la rafale s’organise toute seule).</div>
        </div>
      </div>

      <div className="da-lot-box" style={{ marginTop: 10 }}>
        <button type="button" className="da-confirm-btn" onClick={() => binderRef.current?.click()} disabled={running || binderBusy}>📖 Page de classeur : photo du recto</button>
        {binder && <button type="button" className="da-confirm-btn" onClick={() => versoRef.current?.click()} disabled={!canVerso} title={binder.B ? 'Verso déjà ajouté' : 'Photo de la même page retournée'}>↩︎ {binder.B ? 'Verso ajouté' : 'Ajouter le verso de la page'}</button>}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>Disposition
          <select aria-label="Disposition de la page" value={gridSel} onChange={e => changeGrid(e.target.value)} disabled={running || binderBusy} style={{ padding: '8px 10px' }}>
            <option value="auto">Automatique</option>
            {GRIDS.map(g => <option key={g} value={g}>{g.split('x').reverse().join(' × ')}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 13, color: 'var(--text2, #666)', flex: '1 1 100%' }}>{binderMsg || 'Photographie une page de classeur : les cartes sont repérées et découpées toutes seules, la disposition (3 × 3, 3 × 4…) est devinée. Le verso se photographie ensuite, page retournée.'}</span>
      </div>
      {binder && (
        <details style={{ margin: '10px 0' }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }} className="da-lot-link">Voir les cartes repérées sur la photo</summary>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>{[binder.A.overlay, ...(binder.B ? [binder.B.overlay] : [])].map((u, i) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={i} src={u} alt={i ? 'Détection verso' : 'Détection recto'} style={{ maxWidth: 320, width: '100%', border: '1px solid #3a4a8a' }} />)}</div>
        </details>
      )}

      <div className="da-lot-label" style={{ marginTop: 18 }}>Pour toutes les cartes de ce lot</div>
      <div className="da-lot-box" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, pointerEvents: running ? 'none' : undefined, opacity: running ? 0.6 : 1 }}>
        <div>
          <div style={{ fontSize: 13, marginBottom: 4 }}>Collection</div>
          <CollectionTagSelect userId={userId} value={collectionTag} onChange={setCollectionTag} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={forSale} onChange={e => setForSale(e.target.checked)} disabled={running} /> À vendre / échanger (tu pourras mettre un prix carte par carte ensuite)
        </label>
      </div>

      {entries.length > 0 && (
        <>
          <div className="da-lot-label" style={{ marginTop: 18 }}>2 · Vérifie la liste</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2, #666)' }}>{entries.length} carte{entries.length > 1 ? 's' : ''} (max {MAX_CARDS}){skippedN ? ` · ${skippedN} ignorée${skippedN > 1 ? 's' : ''}` : ''}</span>
            {idle && <button type="button" className="da-lot-link" onClick={clearAll}>Tout effacer</button>}
          </div>
          <label className="da-lot-ai" style={{ marginTop: 0 }}><input type="checkbox" checked={autoCorners} onChange={e => setAutoCorners(e.target.checked)} disabled={running} /> Recadrer automatiquement les photos de cartes seules (détection des coins)</label>
          <label className="da-lot-ai"><input type="checkbox" checked={useAI} onChange={e => setUseAI(e.target.checked)} disabled={running} /> Identifier les cartes avec l’IA (1 identification par carte)</label>
        </>
      )}

      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {entries.map((e, i) => {
          const st = status[e.id]
          const over = isOver(st?.s)
          return (
            <div key={e.id} className={'da-lot-row' + (st?.s === 'error' ? ' err' : '') + (e.skip ? ' skip' : '')}>
              <div className="da-lot-num">{i + 1}</div>
              <div className="da-lot-photos">
                <figure><img src={e.recto.url} alt={`Carte ${i + 1}, recto`} className={st && (st.s === 'upload' || st.s === 'scan' || st.s === 'detect') ? 'busy' : undefined} />{badge(st?.s)}<figcaption>Recto{(e.src?.recto || e.rawRecto) && idle && !over && <> · <button type="button" className="da-lot-link" onClick={() => openEditor(e.id, 'recto')}>coins</button></>}</figcaption></figure>
                {e.verso ? <figure><img src={e.verso.url} alt={`Carte ${i + 1}, verso`} /><figcaption>Verso{(e.src?.verso || e.rawVerso) && idle && !over && <> · <button type="button" className="da-lot-link" onClick={() => openEditor(e.id, 'verso')}>coins</button></>}</figcaption></figure> : <figure className="empty"><div>Pas de verso</div></figure>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{st?.nom || `Carte ${i + 1}`}</div>
                <div style={{ fontSize: 13, color: st?.s === 'error' ? '#ff8a8a' : st?.s === 'done' ? '#3ddc97' : 'var(--text2, #666)' }}>{e.skip && !st ? 'Ignorée' : st ? (st.s === 'error' ? `Échec : ${st.msg}` : label[st.s]) : label.wait}</div>
                {idle && !over && (
                  <select aria-label={`Collection de la carte ${i + 1}`} value={cardTag[e.id] || ''} onChange={ev => setCardTag(m => ({ ...m, [e.id]: ev.target.value }))} style={{ marginTop: 6, padding: '6px 8px', fontSize: 12, maxWidth: '100%' }}>
                    <option value="">Collection : {collectionTag ? `« ${collectionTag} » (le lot)` : 'aucune (le lot)'}</option>
                    <option value={NONE}>Aucune collection</option>
                    {[...new Set([...allTags, ...(collectionTag ? [collectionTag] : [])])].sort().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
                {e.det === 'pending' && !over && <div style={{ fontSize: 12, color: 'var(--text2, #666)', marginTop: 4 }}>Recadrage en cours…</div>}
                {(e.check?.recto || e.check?.verso) && !over && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ background: '#c98a12', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', letterSpacing: '.04em', textTransform: 'uppercase' }}>Recadrage à vérifier</span>
                    {idle && <button type="button" className="da-confirm-btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEditor(e.id, e.check?.recto ? 'recto' : 'verso')}>Régler les coins</button>}
                  </div>
                )}
                {e.weak && !over && <label className="da-lot-warn"><input type="checkbox" checked={!e.skip} onChange={() => toggleSkip(e.id)} disabled={running} /> Emplacement estimé (pochette vide ?) : ajouter quand même</label>}
              </div>
              {idle && !over && (
                <div className="da-lot-actions">
                  {e.verso && <button type="button" onClick={() => swap(e.id)} title="Inverser recto et verso" aria-label="Inverser recto et verso">⇄</button>}
                  <button type="button" onClick={() => removeEntry(e.id)} title="Retirer cette carte" aria-label="Retirer cette carte">✕</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {burst && <BurstCamera maxCards={Math.max(1, MAX_CARDS - entries.length)} onDone={onBurstDone} onClose={() => setBurst(false)} />}
      {editing && (() => { const ref = entries.find(x => x.id === editing.id)?.src?.[editing.side]; return ref ? <CornerEditor full={ref.full} quad={ref.quad} label={`Carte ${entries.findIndex(x => x.id === editing.id) + 1} · ${editing.side}`} onSave={saveCorners} onCancel={() => setEditing(null)} /> : null })()}

      {entries.length > 0 && (
        <div className="da-sticky-actions" style={{ bottom: isAppUI ? NAV_TOTAL_HEIGHT_CSS : 0 }}>
          {!running && pendingN === 0 && doneN > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <b style={{ flex: 1, minWidth: 180 }}>{doneN} carte{doneN > 1 ? 's' : ''} ajoutée{doneN > 1 ? 's' : ''}{todoN ? ` · dont ${todoN} à compléter` : ''}{skippedN ? ` · ${skippedN} ignorée${skippedN > 1 ? 's' : ''}` : ''}</b>
              <Link href={`/galerie/${userId}`} className="da-confirm-btn primary" style={{ textDecoration: 'none' }}>{todoN ? 'Voir ma galerie et compléter' : 'Voir ma galerie'}</Link>
              <button type="button" className="da-confirm-btn" onClick={clearAll}>Ajouter d’autres cartes</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {running && <div className="da-lot-progress" role="progressbar" aria-valuemin={0} aria-valuemax={included.length} aria-valuenow={doneN + errN} aria-label="Avancement de l’ajout"><i style={{ width: `${Math.round(((doneN + errN) / Math.max(1, included.length)) * 100)}%` }} /></div>}
              {!running && doneN > 0 && <span style={{ fontSize: 13, flex: '1 1 100%' }}>{doneN} ajoutée{doneN > 1 ? 's' : ''}{errN ? ` · ${errN} en échec` : ''} · {pendingN} restante{pendingN > 1 ? 's' : ''}</span>}
              {running && <button type="button" className="da-confirm-btn" onClick={() => { cancelRef.current = true }}>Arrêter</button>}
              <button type="button" className="btn-main btn-primary" style={{ flex: 1 }} disabled={running || pendingN === 0} onClick={run}>
                {running ? `Ajout en cours… ${doneN + errN} / ${included.length}`
                  : pendingN === 0 ? 'Aucune carte à ajouter'
                  : errN > 0 ? `Réessayer ${errN} échec${errN > 1 ? 's' : ''}${pendingN > errN ? ` et continuer (${pendingN} restantes)` : ''}`
                  : doneN > 0 ? `Reprendre (${pendingN} restante${pendingN > 1 ? 's' : ''})`
                  : `Ajouter ${pendingN} carte${pendingN > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
