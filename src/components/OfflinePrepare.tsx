'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { prepareOffline, readPrepState } from '@/lib/offlinePrepare'

const REFRESH_EVERY_MS = 12 * 3600 * 1000

async function waitForController(timeoutMs: number): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (navigator.serviceWorker.controller) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return !!navigator.serviceWorker.controller
}

// Prépare le mode hors ligne tout seul, en arrière-plan : une fois connecté,
// service worker actif, en ligne, et au plus toutes les 12h. Les pages (accueil,
// galerie et ses onglets) se préparent toujours ; les images de toute la
// collection seulement en Wi-Fi (sinon : bouton dans le profil, pour ne pas
// consommer le forfait sans prévenir).
export default function OfflinePrepare() {
  const { user } = useAuth()

  useEffect(() => {
    // L'iframe de préparation charge cette même app : sans ce garde-fou elle
    // relancerait la préparation, à l'infini.
    if (window.self !== window.top) return
    if (!user) return
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled || !navigator.onLine) return
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection
      if (conn?.saveData) return
      if (!(await waitForController(8000)) || cancelled) return

      const state = readPrepState()
      if (state && Date.now() - state.at < REFRESH_EVERY_MS) return

      const unmetered = conn?.type === 'wifi' || conn?.type === 'ethernet'
      prepareOffline(user.id, { images: !!unmetered }).catch(() => {})
    }, 10000) // laisse d'abord la page vraiment affichée finir de charger

    return () => { cancelled = true; clearTimeout(timer) }
  }, [user?.id])

  return null
}
