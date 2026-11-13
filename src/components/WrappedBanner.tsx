'use client'
// Bandeau « Ton année en cartes est prête », en haut du site, pendant le mois de décembre seulement (comme un bilan annuel).
// Il mène à la galerie du membre, où s'ouvre la vidéo (?bilan=1). Fermable : il ne revient plus pour cette année.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'

export default function WrappedBanner() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const year = new Date().getFullYear()
  const key = `mb_wrapped_closed_${year}`

  useEffect(() => {
    if (new Date().getMonth() !== 11) return
    try { if (localStorage.getItem(key)) return } catch { /* stockage indisponible : le bandeau s'affiche */ }
    setShow(true)
  }, [key])

  if (!show || !user) return null
  const close = () => { setShow(false); try { localStorage.setItem(key, '1') } catch { /* tant pis */ } }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'linear-gradient(90deg,#08102b,#1b2f78)', color: '#fff', borderBottom: '2px solid #ffd84d' }}>
      <span aria-hidden style={{ fontSize: 18 }}>📅</span>
      <Link href={`/galerie/${user.id}?bilan=1`} style={{ flex: 1, minWidth: 0, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
        <span style={{ color: '#ffd84d' }}>Ton année en cartes {year} est prête.</span> <span style={{ color: '#b8c4ff', fontWeight: 600 }}>Découvre ta vidéo →</span>
      </Link>
      <button type="button" onClick={close} aria-label="Fermer le bandeau" style={{ background: 'none', border: 'none', color: '#b8c4ff', fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '2px 6px' }}>×</button>
    </div>
  )
}
