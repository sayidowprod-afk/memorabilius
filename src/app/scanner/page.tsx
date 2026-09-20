'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang, localeFor } from '@/lib/LangContext'
import CameraCapture from '@/components/CameraCapture'
import { fireConfetti } from '@/components/Confetti'
import { NAV_TOTAL_HEIGHT_CSS } from '@/lib/nativeLayout'

declare const BarcodeDetector: any

interface ImageMatch { id: string; title: string; price: number; img: string; url: string }
interface SaleItem  { title: string; price: number; url: string; img: string; soldDate?: string }
interface EbayResult {
  active: SaleItem[]; sold: SaleItem[]
  median: number; min: number; max: number; soldCount: number
  priceSource: 'sold' | 'active' | 'none'
}

function toBase64(file: File): Promise<{ b64: string; mime: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ b64: (r.result as string).split(',')[1], mime: file.type || 'image/jpeg' })
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// Une vraie photo capteur (camera native/ImageCapture, voir CameraCapture.tsx)
// peut faire plusieurs dizaines de Mo -- en base64 pour l'envoi a
// /api/ebay-image-search, ca depasse la limite de taille de requete de la
// plateforme et l'appel echoue en silence. Applique UNIQUEMENT a cette copie
// reseau (jamais a imgSrc, qui reste la photo d'origine pour l'affichage/
// partage) -- CameraCapture.tsx lui-meme ne recompresse plus rien, precisement
// pour ne pas degrader la qualite des photos de carte stockees en galerie
// (chemin different, qui a sa propre gestion HD/Viewer3D).
async function shrinkForNetwork(b64: string, mime: string, maxDim = 2000, quality = 0.85): Promise<string> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = `data:${mime};base64,${b64}`
  })
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1) return b64
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality).split(',')[1]
}

function fmtDate(d: string, locale: string) {
  try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short' }) } catch { return '' }
}
function usd(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Phase = 'idle' | 'searching' | 'results' | 'loading-sold' | 'done' | 'error'

export default function ScannerPage() {
  const { dark } = useTheme()
  const { t, lang } = useLang()
  const router = useRouter()
  const galleryRef = useRef<HTMLInputElement>(null)
  const videoRef   = useRef<HTMLVideoElement>(null)
  const qrAnimRef  = useRef<number | null>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)
  const heroRef    = useRef<HTMLDivElement>(null)
  const confettiFiredRef = useRef<string | null>(null)

  const [cameraModal,   setCameraModal]   = useState<'recto' | null>(null)
  const [phase,         setPhase]         = useState<Phase>('idle')
  const [imgSrc,        setImgSrc]        = useState<string | null>(null)
  const [rectoB64,      setRectoB64]      = useState<string | null>(null)
  const [rectoMime,     setRectoMime]     = useState('image/jpeg')
  // Image search (eBay visual) -- scanner de prix = recherche image eBay
  // pure, pas d'identification IA (voir historique : ajoutee le 18/07 puis
  // retiree le 20/09 suite a une identification fausse du modele maison sur
  // une carte trop recente pour son dataset d'entrainement -- ce scanner
  // n'a jamais eu besoin de cette identification pour son usage prix).
  const [imgMatches,    setImgMatches]    = useState<ImageMatch[] | null>(null)
  const [imgSearchDone, setImgSearchDone] = useState(false)
  // Sold comps
  const [ebay,          setEbay]          = useState<EbayResult | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<ImageMatch | null>(null)
  const [soldTab,       setSoldTab]       = useState<'sold' | 'active'>('sold')
  const [err,           setErr]           = useState('')
  const [ownedCards, setOwnedCards] = useState<{ nom: string; annee: string; collection: string; variation: string }[]>([])
  const [collectionLoaded, setCollectionLoaded] = useState(false)
  const [qrMode, setQrMode] = useState(false)
  const [qrFound, setQrFound] = useState<string | null>(null)

  const bg     = dark ? '#0a0a0a' : '#f0f2f7'
  const cardBg = dark ? '#161616' : '#ffffff'
  const text   = dark ? '#f0f0f0' : '#0d0d0d'
  const muted  = dark ? '#666'    : '#888'
  const border = dark ? '#252525' : '#e8eaed'
  const blue   = '#0046D1'

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion?next=/scanner'); return }
      const data = { user: session.user }

      const [cartesRes, profileRes] = await Promise.all([
        supabase.from('cartes_manuelles').select('nom, annee, collection, variation').eq('user_id', data.user.id),
        supabase.from('profiles').select('lien_csv').eq('id', data.user.id).single(),
      ])

      const all: { nom: string; annee: string; collection: string; variation: string }[] = []

      for (const c of cartesRes.data || []) {
        all.push({ nom: c.nom || '', annee: c.annee || '', collection: c.collection || '', variation: c.variation || '' })
      }

      if (profileRes.data?.lien_csv) {
        try {
          const r = await fetch(profileRes.data.lien_csv, { signal: AbortSignal.timeout(5000) })
          if (r.ok) {
            const rows = (await r.text()).split(/\r?\n/).slice(4)
            for (const row of rows) {
              const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
              if (!c[0]?.includes('http')) continue
              all.push({
                nom:        (c[2] || '').replace(/^"|"$/g, ''),
                annee:      (c[4] || '').replace(/^"|"$/g, ''),
                collection: (c[6] || '').replace(/^"|"$/g, ''),
                variation:  (c[7] || '').replace(/^"|"$/g, ''),
              })
            }
          }
        } catch { /* CSV inaccessible */ }
      }

      setOwnedCards(all)
      setCollectionLoaded(true)
    })
  }, [])

  const stopQrScan = useCallback(() => {
    if (qrAnimRef.current) { cancelAnimationFrame(qrAnimRef.current); qrAnimRef.current = null }
    if (qrStreamRef.current) { qrStreamRef.current.getTracks().forEach(t => t.stop()); qrStreamRef.current = null }
    setQrMode(false)
    setQrFound(null)
  }, [])

  const startQrScan = useCallback(async () => {
    setQrFound(null)
    setQrMode(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      qrStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      if (typeof BarcodeDetector === 'undefined') {
        // Fallback: invite l'utilisateur à utiliser l'appareil photo
        stopQrScan()
        setCameraModal('recto')
        return
      }

      const detector = new BarcodeDetector({ formats: ['qr_code'] })

      const scan = async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) { qrAnimRef.current = requestAnimationFrame(scan); return }
        try {
          const codes = await detector.detect(video)
          for (const code of codes) {
            const val: string = code.rawValue
            if (val.includes('memorabilius')) {
              setQrFound(val)
              stopQrScan()
              setTimeout(() => {
                const url = new URL(val)
                router.push(url.pathname + url.search)
              }, 600)
              return
            }
          }
        } catch { /* frame skip */ }
        qrAnimRef.current = requestAnimationFrame(scan)
      }
      qrAnimRef.current = requestAnimationFrame(scan)
    } catch {
      stopQrScan()
    }
  }, [router, stopQrScan])

  useEffect(() => () => stopQrScan(), [stopQrScan])

  // Ctrl+V : colle le recto.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (qrMode) return
      const items = e.clipboardData?.items
      if (!items) return
      const imageItem = Array.from(items).find(it => it.type.startsWith('image/'))
      if (!imageItem) return
      const file = imageItem.getAsFile()
      if (!file) return
      e.preventDefault()
      if (!imgSrc) handleRecto(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [qrMode, imgSrc])

  const reset = () => {
    setPhase('idle'); setImgSrc(null)
    setRectoB64(null); setImgMatches(null); setImgSearchDone(false)
    setEbay(null)
    setSelectedMatch(null); setErr(''); setSoldTab('sold'); setManualQuery('')
  }

  // Historique local des dernieres cartes scannees (localStorage, pas de
  // table Supabase -- couvre le besoin "revoir ce que j'ai check tout a
  // l'heure" sans construire un vrai systeme d'historique serveur). Cape a
  // 10 entrees, la plus recente en tete.
  const SCAN_HISTORY_KEY = 'scanner_recent_scans'
  const SCAN_HISTORY_MAX = 10
  type ScanHistoryItem = { nom: string; img: string | null; price: number; date: string }
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const savedThisScanRef = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCAN_HISTORY_KEY)
      if (raw) setScanHistory(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => { savedThisScanRef.current = false }, [imgSrc])

  // Miniature dediee a l'historique (pas l'URL blob de imgSrc, qui devient
  // invalide des que la session/l'onglet se termine -- inutilisable pour du
  // localStorage qui doit survivre au rechargement de la page).
  const makeThumbnail = (b64: string, mime: string): Promise<string> => new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const w = 60, h = 84
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
      canvas.width = 0
    }
    img.onerror = () => resolve('')
    img.src = `data:${mime};base64,${b64}`
  })

  useEffect(() => {
    if (phase !== 'done' || savedThisScanRef.current) return
    const price = selectedMatch?.price || ebay?.median || 0
    const nom = selectedMatch?.title || ''
    if (!price || !nom || !rectoB64) return
    savedThisScanRef.current = true
    makeThumbnail(rectoB64, rectoMime).then(thumb => {
      setScanHistory(prev => {
        const next = [{ nom, img: thumb || null, price, date: new Date().toISOString() }, ...prev].slice(0, SCAN_HISTORY_MAX)
        try { localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    })
  }, [phase, ebay, selectedMatch, rectoB64, rectoMime])

  // blocking=true : phase passe par 'loading-sold' (utilise quand on n'a
  // AUCUN prix connu a l'avance -- recherche manuelle). blocking=false :
  // charge la fourchette de marche en arriere-plan SANS bloquer l'affichage,
  // utilise quand on vient de cliquer une correspondance dont le prix est
  // deja connu (voir pickMatch) -- avant, cliquer relançait une recherche
  // texte avec le titre exact de l'annonce (souvent bruite/bizarre cote
  // eBay) qui echouait tres souvent, affichant "0 ventes" alors que le prix
  // etait deja sous les yeux de l'utilisateur juste avant le clic.
  const loadSoldComps = useCallback(async (query: string, blocking = true) => {
    setEbay(null)
    if (blocking) setPhase('loading-sold')
    try {
      const params = new URLSearchParams({ q: query })
      const r = await fetch(`/api/ebay-sold?${params}`)
      const d = await r.json()
      setEbay({
        active: d.active || d.items || [],
        sold: d.sold || [],
        median: d.median || 0,
        min: d.min || 0,
        max: d.max || 0,
        soldCount: d.soldCount || 0,
        priceSource: d.priceSource || 'none',
      })
      if (!(d.sold?.length > 0)) setSoldTab('active')
    } catch { /* non-fatal */ }
    if (blocking) setPhase('done')
  }, [])

  const pickMatch = useCallback((match: ImageMatch) => {
    setSelectedMatch(match)
    // Le prix de CETTE annonce est deja connu (affiche dans sa vignette) --
    // pas besoin d'attendre quoi que ce soit pour le montrer.
    setPhase('done')
    loadSoldComps(match.title, false)
  }, [loadSoldComps])

  // Recherche manuelle -- filet de secours quand la recherche image eBay ne
  // trouve rien (carte trop récente/rare pour avoir des annonces avec photo
  // similaire) : sans identification IA sur cette page, c'est la seule autre
  // façon d'obtenir un prix. Un match "synthétique" (pas de vraie image/id
  // eBay) réutilise tout le code existant qui lit selectedMatch.title
  // (check collection, historique, partage) sans branche séparée.
  const [manualQuery, setManualQuery] = useState('')
  const searchManually = useCallback((query: string) => {
    const q = query.trim()
    if (!q) return
    setSelectedMatch({ id: 'manual', title: q, price: 0, img: '', url: '' })
    loadSoldComps(q, true)
  }, [loadSoldComps])

  const doScan = useCallback(async (b64: string, mime: string) => {
    setImgMatches(null); setImgSearchDone(false)
    setEbay(null)
    setSelectedMatch(null); setErr(''); setPhase('searching')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setErr('Connectez-vous pour scanner.'); setPhase('error'); return }

    // Recherche image eBay -- seule source d'identification de ce scanner
    // (voir commentaire sur imgMatches plus haut). Reduite juste pour cet
    // envoi reseau (voir shrinkForNetwork) -- imgSrc, lui, garde la photo
    // d'origine pour l'affichage/le partage.
    const networkB64 = await shrinkForNetwork(b64, mime).catch(() => b64)
    await fetch('/api/ebay-image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ imageBase64: networkB64 }),
    }).then(r => r.json()).then(d => {
      const matches: ImageMatch[] = d.items || []
      setImgMatches(matches)
      setImgSearchDone(true)
      setPhase('results')
      return matches
    }).catch(() => {
      setImgSearchDone(true)
      setPhase('results')
      return [] as ImageMatch[]
    })
  }, [])

  const handleRecto = async (file: File) => {
    setImgSrc(URL.createObjectURL(file))
    const { b64, mime } = await toBase64(file)
    setRectoB64(b64)
    setRectoMime(mime)
    doScan(b64, mime)
  }

  const ManualSearchForm = ({ collapsedLabel }: { collapsedLabel?: string }) => {
    const [open, setOpen] = useState(!collapsedLabel)
    if (!open) {
      return (
        <button type="button" onClick={() => setOpen(true)} style={{
          width: '100%', padding: '9px 0', background: 'none', border: 'none',
          color: muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center', marginBottom: 14,
        }}>
          {collapsedLabel} <span aria-hidden="true">→</span>
        </button>
      )
    }
    return (
      <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
          {t('scanner_manual_search')}
        </div>
        <form onSubmit={e => { e.preventDefault(); searchManually(manualQuery) }} style={{ display: 'flex', gap: 8 }}>
          <input
            value={manualQuery}
            onChange={e => setManualQuery(e.target.value)}
            placeholder={t('scanner_manual_search_placeholder')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${border}`,
              background: dark ? '#111' : '#f8f9fb', color: text, fontSize: 13,
            }}
          />
          <button type="submit" disabled={!manualQuery.trim()} style={{
            padding: '0 16px', background: manualQuery.trim() ? blue : border, border: 'none',
            borderRadius: 10, color: '#fff', fontWeight: 800, fontSize: 13,
            cursor: manualQuery.trim() ? 'pointer' : 'default',
          }}>
            {t('scanner_search')}
          </button>
        </form>
      </div>
    )
  }

  const SaleRow = ({ item }: { item: SaleItem }) => (
    <a href={item.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', background: dark ? '#111' : '#f8f9fb', borderRadius: 10, border: `1px solid ${border}`, textDecoration: 'none' }}>
      {item.img && <img src={item.img} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 5, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: text, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
        {item.soldDate && <div style={{ fontSize: 10, color: muted, marginTop: 1 }}>{fmtDate(item.soldDate, localeFor(lang))}</div>}
      </div>
      <div style={{ fontWeight: 900, fontSize: 14, color: blue, flexShrink: 0 }}>{usd(item.price)}</div>
    </a>
  )

  // Prix "principal" affiche dans le panneau resultat : celui de l'annonce
  // cliquee si on le connait deja (cas normal -- voir pickMatch), sinon la
  // mediane de la recherche manuelle une fois chargee. primaryLoading ne
  // concerne QUE la recherche manuelle (phase 'loading-sold') -- cliquer une
  // correspondance ne passe jamais par un etat de chargement bloquant.
  const primaryIsListing = !!(selectedMatch && selectedMatch.price > 0)
  const primaryLoading = phase === 'loading-sold'
  const primaryPrice = primaryIsListing ? selectedMatch!.price : (ebay?.median || 0)

  // Petite salve de confettis au premier affichage d'un prix pour CETTE
  // selection precise (cle sur selectedMatch.id, jamais deux fois pour la
  // meme) -- le "moment" recompense de l'outil, purement visuel.
  useEffect(() => {
    if (selectedMatch && !primaryLoading && primaryPrice > 0 && confettiFiredRef.current !== selectedMatch.id) {
      confettiFiredRef.current = selectedMatch.id
      fireConfetti()
    }
  }, [selectedMatch, primaryLoading, primaryPrice])

  // Genere une image recap (photo carte a bords nets + nom + prix) et la
  // partage via l'API Web Share (mobile) ou la telecharge (desktop).
  const shareResult = useCallback(async () => {
    if (!imgSrc || !primaryPrice) return
    const W = 800, H = 1050
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#f5f7fb'
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#0046D1'
    ctx.fillRect(0, 0, W, 64)
    ctx.fillStyle = '#fff'
    ctx.font = '900 26px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('Memorabilius', 28, 32)

    const img = new Image()
    await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve(); img.src = imgSrc })
    // Coins de la carte toujours nets, jamais arrondis, meme dans un export.
    const cardW = 340, cardH = 476
    const cardX = (W - cardW) / 2, cardY = 96
    if (img.complete && img.naturalWidth > 0) {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 12
      ctx.drawImage(img, cardX, cardY, cardW, cardH)
      ctx.restore()
    }

    const title = selectedMatch?.title || ''
    const shortTitle = title.length > 55 ? title.slice(0, 52) + '…' : title

    let y = cardY + cardH + 56
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0d0d0d'
    ctx.font = '900 24px Inter, system-ui, sans-serif'
    ctx.fillText(shortTitle, W / 2, y)

    y += 70
    ctx.font = '700 15px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#3b6bde'
    const priceLabel = primaryIsListing ? t('scanner_this_listing_price') : (ebay?.priceSource === 'sold' ? t('scanner_median_sales') : t('scanner_median_active'))
    ctx.fillText(priceLabel.toUpperCase(), W / 2, y)

    y += 66
    ctx.font = '900 76px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#0046D1'
    ctx.fillText(usd(primaryPrice), W / 2, y)

    ctx.font = '600 14px Inter, system-ui, sans-serif'
    ctx.fillStyle = '#999'
    ctx.fillText(`memorabilius.fr · ${new Date().toLocaleDateString(localeFor(lang))}`, W / 2, H - 40)

    canvas.toBlob(async blob => {
      if (!blob) return
      const file = new File([blob], 'memorabilius-scan.jpg', { type: 'image/jpeg' })
      const shareText = `${selectedMatch?.title || ''} — ${usd(primaryPrice)} · Memorabilius`
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Memorabilius', text: shareText }) } catch { /* annulé par l'utilisateur */ }
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'memorabilius-scan.jpg'
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      }
    }, 'image/jpeg', 0.92)
  }, [imgSrc, selectedMatch, ebay, primaryPrice, primaryIsListing, lang, t])

  const isSearching = phase === 'searching'
  const showResults = phase === 'results' || phase === 'loading-sold' || phase === 'done' || phase === 'error'

  // Estimation rapide a partir des matches visuels eBay eux-memes (avant le
  // fetch plus lent des ventes) -- filtre d'abord les prix trop eloignes de
  // la mediane du groupe (meme logique anti-aberrant que cote serveur pour
  // les ventes), sinon un seul match qui n'est pas la bonne carte fausse
  // toute la fourchette affichee.
  const quickEstimate = (() => {
    if (!imgMatches || imgMatches.length < 2) return null
    const prices = imgMatches.map(m => m.price).filter(p => p > 0).sort((a, b) => a - b)
    if (prices.length < 2) return null
    const mid = Math.floor(prices.length / 2)
    const med = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid]
    const filtered = prices.length >= 4 ? prices.filter(p => p >= med * 0.3 && p <= med * 3) : prices
    if (filtered.length < 2) return null
    const lo = Math.min(...filtered), hi = Math.max(...filtered)
    // Peu de resultats = a prendre avec recul. Le seuil de fourchette
    // "trop large" etait a 4x -- beaucoup trop agressif : une carte avec
    // plusieurs parallèles (base, holo, /175...) a normalement un ecart de
    // prix de 5-10x entre versions SANS que ca signale un mauvais matching,
    // juste des variantes differentes. Releve a 10x pour ne plus crier au
    // loup sur ce cas courant et legitime.
    const lowConfidence = filtered.length < 3 || hi > lo * 10
    return { lo, hi, med, count: filtered.length, total: prices.length, lowConfidence }
  })()

  // Correspondance dont le prix est le plus proche de la mediane du groupe --
  // heuristique simple pour suggerer la carte la plus probable sans avoir a
  // toutes les comparer soi-meme (utile vu qu'il n'y a plus d'identification
  // IA sur cette page pour trancher).
  const bestMatchId = (() => {
    if (!quickEstimate || !imgMatches) return null
    let best: ImageMatch | null = null
    let bestDelta = Infinity
    for (const m of imgMatches) {
      if (m.price <= 0) continue
      const delta = Math.abs(m.price - quickEstimate.med)
      if (delta < bestDelta) { bestDelta = delta; best = m }
    }
    return best?.id ?? null
  })()

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 'calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top)))', zIndex: 10, background: dark ? '#0f0f0f' : '#fff', borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', height: 48 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: text }}>{t('scanner_header_title')}</span>
        {phase !== 'idle' && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: muted, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
            {t('scanner_new_card')}
          </button>
        )}
      </div>

      {/* Le prix vivait avant dans ce header du haut (disparaissait a l'ecran
          des qu'on scrollait la grille de correspondances, doublon avec la
          barre collante en bas ci-dessous) -- remplace par cette barre en
          bas, toujours visible sans avoir a rescroller (demande explicite). */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: `16px 12px ${selectedMatch && !primaryLoading && primaryPrice > 0 ? `calc(84px + ${NAV_TOTAL_HEIGHT_CSS})` : '80px'}` }}>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div style={{ paddingTop: 20 }}>
            <p style={{ textAlign: 'center', color: muted, fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
              {t('scanner_flow_desc')}<br />
              <strong style={{ color: text }}>{t('scanner_designed_card_shows')}</strong>
            </p>
            <button onClick={() => setCameraModal('recto')} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              width: '100%', minHeight: 230, background: blue, border: 'none',
              borderRadius: 22, cursor: 'pointer', color: '#fff', marginBottom: 12,
            }}>
              <span style={{ fontSize: 64, lineHeight: 1 }}>📷</span>
              <span style={{ fontSize: 22, fontWeight: 900 }}>{t('scanner_take_photo')}</span>
              <span style={{ fontSize: 13, opacity: 0.75 }}>{t('scanner_camera_hint')}</span>
            </button>
            <button onClick={() => galleryRef.current?.click()} style={{
              width: '100%', padding: '14px 0', background: 'none', border: `2px solid ${border}`,
              borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700, marginBottom: 12,
            }}>
              {t('scanner_import_gallery')}
            </button>

            {/* ── QR Memorabilius ── */}
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, marginTop: 4 }}>
              <p style={{ textAlign: 'center', fontSize: 12, color: muted, marginBottom: 10 }}>
                {t('scanner_qr_question')}
              </p>
              <button onClick={startQrScan} style={{
                width: '100%', padding: '14px 0', background: 'none',
                border: `2px solid #003DA6`, borderRadius: 14,
                cursor: 'pointer', color: '#003DA6', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 20 }}>▦</span> {t('scanner_qr_scan_btn')}
              </button>
            </div>

            <input ref={galleryRef} type="file" accept="image/*"                        style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleRecto(f); e.target.value = '' }} />

            {/* ── Historique local (localStorage, pas de backend) ── */}
            {scanHistory.length > 0 && (
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 16, marginTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                  {t('scanner_recent_scans')}
                </p>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {scanHistory.map((h, i) => (
                    <div key={i} style={{ flexShrink: 0, width: 72, textAlign: 'center' }}>
                      {h.img
                        ? <img src={h.img} alt="" style={{ width: 60, height: 84, objectFit: 'cover', borderRadius: 8, border: `1px solid ${border}`, marginBottom: 4 }} />
                        : <div style={{ width: 60, height: 84, borderRadius: 8, background: border, marginBottom: 4 }} />
                      }
                      <div style={{ fontSize: 11, fontWeight: 800, color: blue }}>{usd(h.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── QR SCAN MODE ── */}
        {qrMode && createPortal(
          <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {/* Overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {/* Viseur */}
              <div style={{ width: 220, height: 220, position: 'relative' }}>
                {(['tl','tr','bl','br'] as const).map(c => (
                  <div key={c} className={qrFound ? 'scanner-corner-found' : 'scanner-corner-pulse'} style={{
                    position: 'absolute',
                    width: 36, height: 36,
                    ...(c.includes('t') ? { top: 0 } : { bottom: 0 }),
                    ...(c.includes('l') ? { left: 0 } : { right: 0 }),
                    borderTop:    c.includes('t') ? `3px solid ${qrFound ? '#2ecc71' : '#003DA6'}` : 'none',
                    borderBottom: c.includes('b') ? `3px solid ${qrFound ? '#2ecc71' : '#003DA6'}` : 'none',
                    borderLeft:   c.includes('l') ? `3px solid ${qrFound ? '#2ecc71' : '#003DA6'}` : 'none',
                    borderRight:  c.includes('r') ? `3px solid ${qrFound ? '#2ecc71' : '#003DA6'}` : 'none',
                    transition: 'border-color 0.2s',
                  }} />
                ))}
              </div>
              <div style={{
                marginTop: 24, background: 'rgba(0,0,0,0.6)', borderRadius: 12,
                padding: '10px 20px', color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                {qrFound ? t('scanner_qr_detected') : t('scanner_target_qr')}
              </div>
            </div>
            {/* Bouton fermer */}
            <button
              onClick={stopQrScan}
              style={{
                position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.4)',
                color: '#fff', borderRadius: 50, padding: '12px 32px',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}
            >
              {t('scanner_cancel')}
            </button>
          </div>,
          document.body
        )}

        {/* ── SEARCHING ── */}
        {isSearching && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            {imgSrc && (
              <img src={imgSrc} alt="" style={{ width: 120, height: 170, objectFit: 'cover', borderRadius: 12, border: `2px solid ${border}`, marginBottom: 24 }} />
            )}
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>Recherche en cours…</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>Correspondances visuelles eBay…</div>
            <div style={{ height: 4, background: border, borderRadius: 4, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
              <div style={{ height: '100%', background: blue, borderRadius: 4, animation: 'slideIn 1.6s ease-in-out infinite', width: '50%' }} />
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {showResults && (
          <>
            {/* Photo + resultat de la correspondance choisie -- panneau unique
                (avant : carte photo+collection separee de la carte "prix
                vendus" plus bas, redondant et forcait a scroller pour
                recomprendre ce qu'on regardait). Le prix de l'annonce
                cliquee est deja connu (voir pickMatch) -- affiche
                immediatement, jamais de "0 ventes" trompeur. */}
            <div ref={heroRef} className="scan-result-land" style={{ background: cardBg, borderRadius: 20, border: `1px solid ${border}`, marginBottom: 16, overflow: 'hidden', boxShadow: dark ? 'none' : '0 4px 16px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 14 }}>
                {imgSrc && (
                  <img src={imgSrc} alt="recto" style={{ flexShrink: 0, width: 96, height: 134, objectFit: 'cover', borderRadius: 12, border: `2px solid ${border}`, boxShadow: dark ? 'none' : '0 8px 20px rgba(0,0,0,0.12)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
                  {!selectedMatch && (
                    <div style={{ fontSize: 14, color: muted, lineHeight: 1.5 }}>👆 {t('scanner_tap_match_hint')}</div>
                  )}
                  {selectedMatch && (
                    <div style={{ fontWeight: 800, fontSize: 14, color: text, lineHeight: 1.35 }}>{selectedMatch.title}</div>
                  )}
                  {collectionLoaded && selectedMatch && (() => {
                    const n = (s: string) => (s || '').toLowerCase().trim()
                    const title = n(selectedMatch.title)
                    const count = ownedCards.filter(c => {
                      const words = n(c.nom).split(/\s+/).filter(w => w.length > 2)
                      const playerOk = words.length > 0 && words.every(w => title.includes(w))
                      const yearOk = !n(c.annee) || title.includes(n(c.annee))
                      const collOk = !n(c.collection) || title.includes(n(c.collection))
                      const varNorm = n(c.variation).replace(/^base$/i, '')
                      const varOk = !varNorm || title.includes(varNorm)
                      return playerOk && yearOk && collOk && varOk
                    }).length
                    return count > 0
                      ? <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>✓ {count} exemplaire{count > 1 ? 's' : ''} identique{count > 1 ? 's' : ''} dans ta collection</div>
                      : <div style={{ marginTop: 6, fontSize: 11, color: muted }}>Pas dans ta collection</div>
                  })()}
                </div>
              </div>

              {selectedMatch && primaryLoading && (
                <div style={{ height: 96, margin: '0 14px 14px', background: border, borderRadius: 16, animation: 'pulse 1.4s ease-in-out infinite' }} />
              )}
              {/* Bandeau prix plein-bleed (pas juste un encart inset) -- le
                  "moment" visuel de la page, pense comme une etiquette de
                  prix plutot qu'une ligne de texte de plus dans une carte
                  blanche. Confettis au premier affichage (voir useEffect). */}
              {selectedMatch && !primaryLoading && primaryPrice > 0 && (
                <div key={selectedMatch.id} className="scan-price-reveal" style={{
                  textAlign: 'center', padding: '22px 12px 20px',
                  background: 'linear-gradient(135deg, #0046D1, #0033a0)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.12), transparent 60%)', pointerEvents: 'none' }} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                    🏷️ {primaryIsListing ? t('scanner_this_listing_price') : (ebay?.priceSource === 'sold' ? t('scanner_median_sales') : t('scanner_median_active'))}
                  </div>
                  <div style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: -2, fontVariantNumeric: 'tabular-nums', textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                    {usd(primaryPrice)}
                  </div>
                </div>
              )}
              {selectedMatch && !primaryLoading && primaryPrice === 0 && (
                <p style={{ color: muted, fontSize: 12, margin: 0, padding: '0 14px 14px', lineHeight: 1.5, textAlign: 'center' }}>{t('scanner_no_manual_results')}</p>
              )}

              {selectedMatch && !primaryLoading && primaryPrice > 0 && (
                <button onClick={shareResult} style={{
                  width: 'calc(100% - 28px)', margin: '12px 14px 0', padding: '10px 0', background: 'none',
                  border: `1.5px solid ${border}`, borderRadius: 12, cursor: 'pointer',
                  color: text, fontSize: 13, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}>
                  <span aria-hidden="true">📤</span> {t('scanner_share')}
                </button>
              )}

              {/* Fourchette de marche -- affichee directement des qu'elle est
                  prete (plus de repli derriere un toggle), mais uniquement
                  quand on a reellement quelque chose a montrer (jamais de
                  section vide/"0 ventes"). */}
              {selectedMatch && ebay && (ebay.sold.length > 0 || ebay.active.length > 0) && (
                <div style={{ margin: '14px 14px 14px', paddingTop: 14, borderTop: `1px solid ${border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                    {t('scanner_view_market_range')}
                  </div>
                  {ebay.median > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      <div style={{ background: dark ? '#0a1a2e' : '#f0f6ff', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{t('scanner_min')}</div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: dark ? '#7db3ff' : '#3b82c4', fontVariantNumeric: 'tabular-nums' }}>{usd(ebay.min)}</div>
                      </div>
                      <div style={{ background: dark ? '#0d1a36' : '#eef3ff', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{t('scanner_max')}</div>
                        <div style={{ fontWeight: 900, fontSize: 18, color: blue, fontVariantNumeric: 'tabular-nums' }}>{usd(ebay.max)}</div>
                      </div>
                    </div>
                  )}
                  {ebay.sold.length > 0 && (
                    <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, marginBottom: 8 }}>
                      {(['sold', 'active'] as const).map(key => (
                        <button key={key} onClick={() => setSoldTab(key)} style={{
                          flex: 1, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: soldTab === key ? 800 : 500,
                          color: soldTab === key ? blue : muted,
                          borderBottom: soldTab === key ? `2px solid ${blue}` : '2px solid transparent',
                          marginBottom: -1,
                        }}>
                          {key === 'sold' ? `${t('scanner_sold_tab')} (${ebay.sold.length})` : `${t('scanner_active_tab')} (${ebay.active.length})`}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 300, overflowY: 'auto' }}>
                    {(ebay.sold.length > 0 ? (soldTab === 'sold' ? ebay.sold : ebay.active) : ebay.active).map((item, i) => <SaleRow key={i} item={item} />)}
                  </div>
                </div>
              )}
            </div>

            {/* ── GRILLE IMAGE SEARCH EBAY ── */}
            {!imgSearchDone && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                  {t('scanner_visual_matches')}
                  <span style={{ fontWeight: 400, marginLeft: 8, animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }}>{t('scanner_loading')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${border}` }}>
                      <div style={{ height: 90, background: border, animation: 'pulse 1.4s ease-in-out infinite' }} />
                      <div style={{ padding: '6px 7px' }}>
                        <div style={{ height: 8, background: border, borderRadius: 4, marginBottom: 5, animation: 'pulse 1.4s ease-in-out infinite' }} />
                        <div style={{ height: 8, background: border, borderRadius: 4, width: '60%', animation: 'pulse 1.4s ease-in-out infinite' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {imgSearchDone && imgMatches && imgMatches.length > 0 && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('scanner_visual_matches')}
                  </div>
                  {/* Estimation immediate a partir des prix des matches eBay eux-memes,
                      avant meme le fetch des ventes -- volontairement discrete (petite,
                      muette, avec un "~") car ces correspondances visuelles ne sont pas
                      forcement exactement la meme carte/variante/etat. */}
                  {quickEstimate && (
                    <span style={{ fontSize: 10, color: muted, fontStyle: 'italic' }}>
                      ~ {usd(quickEstimate.lo)} – {usd(quickEstimate.hi)} ({t('scanner_estimate_on')} {quickEstimate.count})
                    </span>
                  )}
                </div>
                {!selectedMatch && (
                  <div style={{ fontSize: 11, color: muted, marginBottom: 12 }}>
                    {t('scanner_tap_match_hint')}
                  </div>
                )}
                {quickEstimate?.lowConfidence && (
                  <div style={{ fontSize: 11, color: dark ? '#d9a441' : '#9a6a00', background: dark ? '#241c08' : '#fff8e6', border: `1px solid ${dark ? '#4a3a10' : '#f0dfa8'}`, borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}>
                    ⚠️ {t('scanner_low_confidence_hint')}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {imgMatches.map(m => {
                    const selected = selectedMatch?.id === m.id
                    const isBest = !selected && m.id === bestMatchId && imgMatches.length > 2
                    return (
                      <button key={m.id} onClick={() => pickMatch(m)} aria-label={m.title}
                        style={{
                          position: 'relative',
                          background: selected ? (dark ? '#001a5c' : '#e8f0ff') : (dark ? '#111' : '#f8f9fb'),
                          border: `2px solid ${selected ? blue : isBest ? '#d97706' : border}`,
                          borderRadius: 12, cursor: 'pointer', padding: 0, overflow: 'hidden', textAlign: 'left',
                          transition: 'border-color 0.15s, transform 0.15s',
                          transform: selected ? 'scale(1.02)' : 'scale(1)',
                        }}>
                        {isBest && (
                          <span style={{
                            position: 'absolute', top: 6, left: 6, zIndex: 1,
                            background: '#d97706', color: '#fff', fontSize: 9, fontWeight: 800,
                            borderRadius: 6, padding: '3px 6px', letterSpacing: 0.3,
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          }}>
                            ★ {t('scanner_best_match')}
                          </span>
                        )}
                        <img src={m.img} alt={m.title} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block', background: dark ? '#0a0a0a' : '#f0f0f0' }} />
                        <div style={{ padding: '7px 8px' }}>
                          <div style={{ fontSize: 10.5, color: text, fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3, marginBottom: 4 }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: blue, letterSpacing: -0.3 }}>{usd(m.price)}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {imgSearchDone && imgMatches && imgMatches.length === 0 && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: '14px 16px', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                  {t('scanner_no_visual_match')}
                </div>
                <ManualSearchForm />
              </div>
            )}

            {/* "Pas la bonne carte" -- repli recherche manuelle meme quand des
                correspondances visuelles existent mais qu'aucune n'est juste
                (carte proche visuellement mais pas la bonne variante/annee). */}
            {imgSearchDone && imgMatches && imgMatches.length > 0 && !selectedMatch && (
              <ManualSearchForm collapsedLabel={t('scanner_wrong_card_hint')} />
            )}

            {/* Nouvelle carte */}
            {(phase === 'results' || phase === 'done') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={reset} style={{
                  width: '100%', padding: '16px 0', background: blue, border: 'none',
                  borderRadius: 14, color: '#fff', fontWeight: 900, fontSize: 17, cursor: 'pointer',
                }}>
                  {t('scanner_scan_another')}
                </button>
              </div>
            )}

            {phase === 'error' && (
              <>
                <p style={{ color: '#dc2626', fontWeight: 700, fontSize: 14, textAlign: 'center' }}>{err}</p>
                <button onClick={reset} style={{ width: '100%', padding: '14px 0', background: '#dc2626', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                  {t('scanner_retry')}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Barre de prix collante en bas -- toujours visible des qu'un prix est
          connu, sans avoir a rescroller vers le panneau du haut (demande
          explicite). Positionnee au-dessus de la bottom nav mobile/native
          (NAV_TOTAL_HEIGHT_CSS) pour ne jamais l'empieter. Le clic scroll
          vers le panneau du haut, qui reste la seule source de detail
          (fourchette, partage, check collection) -- pas de duplication de
          logique ici, juste un raccourci visuel toujours a portee. */}
      {selectedMatch && !primaryLoading && primaryPrice > 0 && (
        <button
          onClick={() => heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="scan-price-reveal"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: NAV_TOTAL_HEIGHT_CSS, zIndex: 20,
            maxWidth: 500, margin: '0 auto', width: '100%',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
            background: dark ? 'linear-gradient(135deg, #0d1a36, #0a1228)' : 'linear-gradient(135deg, #0046D1, #0038a8)',
            boxShadow: '0 -4px 18px rgba(0,0,0,0.18)',
          }}
        >
          {imgSrc && (
            <img src={imgSrc} alt="" style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.3)' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {primaryIsListing ? t('scanner_this_listing_price') : (ebay?.priceSource === 'sold' ? t('scanner_median_sales') : t('scanner_median_active'))}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {usd(primaryPrice)}
            </div>
          </div>
          {/* Fourchette min/max directement dans la barre (demande
              explicite) -- des qu'elle est prete ; sinon repli sur un simple
              raccourci vers le panneau du haut le temps qu'elle charge. */}
          {ebay && ebay.median > 0 ? (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('scanner_min')}–{t('scanner_max')}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {usd(ebay.min)} – {usd(ebay.max)}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('scanner_view_market_range')} <span aria-hidden="true">↑</span>
            </span>
          )}
        </button>
      )}

      {cameraModal && (
        <CameraCapture
          onCapture={blob => {
            setCameraModal(null)
            const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
            handleRecto(file)
          }}
          onClose={() => setCameraModal(null)}
        />
      )}

      <style>{`
        @keyframes pulse   { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideIn { 0% { transform: translateX(-150%); } 100% { transform: translateX(280%); } }
        @keyframes priceReveal { 0% { opacity: 0; transform: translateY(4px) scale(0.97); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .scan-price-reveal { animation: priceReveal 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        @media (prefers-reduced-motion: reduce) { .scan-price-reveal { animation: none; } }
      `}</style>
    </div>
  )
}
