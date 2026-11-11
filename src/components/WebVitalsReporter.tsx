'use client'
// Mesures de vitesse chez les vrais membres (LCP, INP, CLS, TTFB, FCP). Discret et gratuit :
//  - une visite sur cinq seulement (choix gardé pour la session),
//  - les mesures sont regroupées et envoyées UNE fois, quand la page est quittée ou mise en arrière-plan,
//  - elles partent directement vers la base (aucune fonction serveur du site n'est appelée),
//  - aucune donnée personnelle : seulement la page (anonymisée : /galerie/[membre]), la mesure, l'appareil.
// Les résultats se lisent dans /admin/performance.
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'

const SAMPLE = 0.2
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// /galerie/pseudo → /galerie/[membre], /joueur/xxx → /joueur/[slug]… : pas de pseudo ni d'identifiant dans les mesures
function normalize(path: string): string {
  const seg = path.split('?')[0].split('/').filter(Boolean)
  if (seg.length === 0) return '/'
  const head = seg[0]
  const dyn: Record<string, string> = { galerie: '[membre]', joueur: '[slug]', guides: '[slug]', setlist: '[set]', teams: '[equipe]', trades: '[id]', messages: '[conversation]', profil: '[membre]' }
  const out = [head]
  if (seg[1]) out.push(dyn[head] ?? (/^[0-9a-f-]{20,}$/i.test(seg[1]) ? '[id]' : seg[1]))
  if (seg[2]) out.push(head === 'galerie' ? (/^[0-9a-f-]{20,}$/i.test(seg[2]) ? '[id]' : seg[2]) : '…')
  return ('/' + out.join('/')).slice(0, 120)
}

function deviceKind(): 'mobile' | 'desktop' | 'app' {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (cap?.isNativePlatform?.()) return 'app'
  } catch { /* rien */ }
  return window.innerWidth < 768 ? 'mobile' : 'desktop'
}

export default function WebVitalsReporter() {
  const pathname = usePathname()
  const pathRef = useRef(pathname)
  const sampled = useRef<boolean | null>(null)
  const buf = useRef<{ page: string; metric: string; value: number; device: string; nav_type: string | null }[]>([])

  useEffect(() => { pathRef.current = pathname }, [pathname])

  useReportWebVitals(m => {
    if (sampled.current === null) {
      try { const s = sessionStorage.getItem('wv-sample'); sampled.current = s ? s === '1' : (Math.random() < SAMPLE); if (!s) sessionStorage.setItem('wv-sample', sampled.current ? '1' : '0') } catch { sampled.current = Math.random() < SAMPLE }
    }
    if (!sampled.current) return
    if (!['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].includes(m.name)) return
    buf.current.push({ page: normalize(pathRef.current || '/'), metric: m.name, value: Math.round(m.value * 1000) / 1000, device: deviceKind(), nav_type: (m as { navigationType?: string }).navigationType ?? null })
  })

  useEffect(() => {
    const flush = () => {
      if (!buf.current.length || !URL_BASE || !ANON) return
      const rows = buf.current.splice(0, buf.current.length)
      try {
        fetch(`${URL_BASE}/rest/v1/web_vitals`, {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'return=minimal' },
          body: JSON.stringify(rows),
        }).catch(() => {})
      } catch { /* perdues : sans conséquence */ }
    }
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', flush) }
  }, [])

  return null
}
