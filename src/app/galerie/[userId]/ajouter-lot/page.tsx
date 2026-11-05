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

type Photo = { file: File; url: string }
type Entry = { id: number; recto: Photo; verso: Photo | null }
type Status = 'wait' | 'upload' | 'scan' | 'done' | 'todo' | 'error'
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
  const swap = (id: number) => setEntries(es => es.map(e => e.id === id && e.verso ? { ...e, recto: e.verso, verso: e.recto } : e))
  const clearAll = () => { setPhotos([]); setEntries([]); setStatus({}); setFinished(false) }
  const set = (id: number, v: { s: Status; msg?: string; nom?: string }) => setStatus(s => ({ ...s, [id]: v }))

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
        set(e.id, { s: 'upload' })
        const ts = `${Date.now()}_${e.id}`
        const rStd = await resize(e.recto.file, 1600, 0.88), rHd = await resize(e.recto.file, 3200, 0.92)
        const up = async (blob: Blob, name: string) => {
          const path = `cartes/${userId}/${ts}_${name}.jpg`
          const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
          if (error) throw new Error('envoi de la photo : ' + error.message)
          return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        }
        const imageRecto = await up(rStd.blob, 'recto'), imageRectoHd = await up(rHd.blob, 'recto_hd')
        let imageVerso: string | null = null, imageVersoHd: string | null = null, versoHorizontal: boolean | null = null, vStd: { blob: Blob; w: number; h: number } | null = null
        if (e.verso) {
          vStd = await resize(e.verso.file, 1600, 0.88)
          const vHd = await resize(e.verso.file, 3200, 0.92)
          imageVerso = await up(vStd.blob, 'verso'); imageVersoHd = await up(vHd.blob, 'verso_hd')
          versoHorizontal = vStd.w > vStd.h
        }

        let card: any = null
        if (aiOn) {
          set(e.id, { s: 'scan' })
          const g1 = await resize(e.recto.file, 1200, 0.9)
          const body: any = { imageBase64: await toBase64(g1.blob), mimeType: 'image/jpeg', itemType: 'card' }
          if (e.verso) body.imageBase64Verso = await toBase64((await resize(e.verso.file, 1200, 0.9)).blob)
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
  const label: Record<Status, string> = { wait: 'En attente', upload: 'Envoi des photos…', scan: 'Identification…', done: 'Ajoutée', todo: 'Ajoutée — à compléter', error: 'Échec' }

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

      {photos.length > 0 && (
        <div style={{ margin: '14px 0' }}>
          <div className="da-lot-label">Comment sont rangées tes photos ?</div>
          <div className="da-lot-modes" role="radiogroup" aria-label="Rangement des photos">
            {([['alt', 'Recto, verso, recto, verso…'], ['split', 'Tous les rectos, puis tous les versos'], ['single', 'Recto seulement']] as const).map(([m, l]) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => changeMode(m)} disabled={running}>{l}</button>
            ))}
          </div>
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
                <figure><img src={e.recto.url} alt={`Carte ${i + 1}, recto`} /><figcaption>Recto</figcaption></figure>
                {e.verso ? <figure><img src={e.verso.url} alt={`Carte ${i + 1}, verso`} /><figcaption>Verso</figcaption></figure> : <figure className="empty"><div>Pas de verso</div></figure>}
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
