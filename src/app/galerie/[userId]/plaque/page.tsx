'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { resolveProfileBySlugParam, canonicalProfileSlug } from '@/lib/resolveProfileSlug'

// Plaque de salon imprimable (A5) : QR geant vers la galerie, nom du collectionneur, trois cartes phares (Grail Wall, sinon les
// dernieres ajoutees). Pour les card shows : a imprimer, ou a afficher sur une tablette.
export default function PlaquePage() {
  const { userId } = useParams<{ userId: string }>()
  const router = useRouter()
  const qrRef = useRef<HTMLCanvasElement>(null)
  const [info, setInfo] = useState<{ name: string; slug: string; imgs: string[] } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await resolveProfileBySlugParam(supabase, userId)
      if (!r) { if (!cancelled) setMissing(true); return }
      const { data: p } = await supabase.from('profiles').select('id, display_name, slug').eq('id', r.id).single()
      if (!p) { if (!cancelled) setMissing(true); return }
      const { data: grail } = await supabase.from('grail_cards').select('card_key, position').eq('user_id', p.id).order('position').limit(3)
      let imgs: string[] = (grail || []).map((g: any) => g.card_key).filter((k: string) => /^https?:\/\//.test(k))
      if (imgs.length < 3) {
        const { data: last } = await supabase.from('cartes_manuelles').select('image_recto, is_horizontal').eq('user_id', p.id).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(12)
        for (const c of last || []) {
          if (imgs.length >= 3) break
          if (!(c as any).is_horizontal && !imgs.includes((c as any).image_recto)) imgs.push((c as any).image_recto)
        }
      }
      const slug = p.slug ? await canonicalProfileSlug(supabase, p.slug) : p.id
      if (!cancelled) setInfo({ name: p.display_name || 'Collectionneur', slug, imgs: imgs.slice(0, 3) })
    })()
    return () => { cancelled = true }
  }, [userId])

  const url = info ? `https://www.memorabilius.fr/galerie/${info.slug}` : ''
  useEffect(() => {
    if (!info || !qrRef.current) return
    import('qrcode').then(({ default: QRCode }) => {
      if (qrRef.current) QRCode.toCanvas(qrRef.current, url, { width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#06122e', light: '#ffffff' } }).catch(() => {})
    })
  }, [info, url])

  if (missing) return <p style={{ textAlign: 'center', padding: 60 }}>Galerie introuvable.</p>
  if (!info) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement…</p>

  return (
    <div className="plaque-page">
      <style>{`
        .plaque-page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px 16px 60px; }
        .plaque-bar { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .plaque-bar button { background: #fff; color: #06122e !important; border: 3px solid #fff; padding: 10px 20px; font: 800 12px system-ui; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; }
        .plaque-bar button.alt { background: transparent; color: #fff !important; }
        .plaque-sign { width: min(100%, 420px); aspect-ratio: 148 / 210; background: #fff; border: 8px solid #08153b; outline: 4px solid #fff; padding: 6% 7%; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; box-shadow: 0 24px 50px rgba(0,0,0,.55); }
        .plaque-sign, .plaque-sign * { color: #06122e !important; }
        .plaque-sign h1 { font-size: clamp(30px, 9vw, 44px); line-height: .92; margin: 0; }
        .plaque-sign canvas { width: 58% !important; height: auto !important; aspect-ratio: 1; border: 6px solid #06122e; padding: 6px; }
        .plaque-name { font-size: clamp(26px, 7vw, 34px); line-height: 1; margin: 0; }
        .plaque-th { display: flex; gap: 8px; justify-content: center; }
        .plaque-th img { width: 22%; aspect-ratio: 2.5 / 3.5; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,.35); border-radius: 0; }
        .plaque-url { background: #06122e; width: 100%; padding: 8px 4px; font: 800 clamp(9px, 2.6vw, 12px) system-ui; letter-spacing: .12em; text-transform: uppercase; color: #fff !important; }
        .plaque-url * { color: #fff !important; }
        @media print {
          @page { size: A5; margin: 0; }
          body * { visibility: hidden !important; }
          .plaque-sign, .plaque-sign * { visibility: visible !important; }
          .plaque-sign { position: fixed; left: 0; top: 0; width: 148mm !important; height: 210mm !important; max-width: none; outline: 0; box-shadow: none; border-width: 6mm; }
        }
      `}</style>
      <div className="plaque-bar">
        <button onClick={() => window.print()}>Imprimer (A5)</button>
        <button className="alt" onClick={() => router.back()}>← Retour</button>
      </div>
      <div className="plaque-sign">
        <h1 className="da-display">Scanne pour voir ma collection</h1>
        <canvas ref={qrRef} width={360} height={360} />
        <p className="plaque-name da-display">{info.name}</p>
        {info.imgs.length > 0 && (
          <div className="plaque-th">
            {info.imgs.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={s} alt="" crossOrigin="anonymous" />
            ))}
          </div>
        )}
        <div className="plaque-url">{url.replace('https://www.', '')}</div>
      </div>
      <p style={{ opacity: .6, fontSize: 12, maxWidth: 420, textAlign: 'center' }}>Astuce : choisis « Enregistrer au format PDF » dans la fenêtre d&apos;impression pour garder le fichier, ou affiche cette page en plein écran sur une tablette.</p>
    </div>
  )
}
