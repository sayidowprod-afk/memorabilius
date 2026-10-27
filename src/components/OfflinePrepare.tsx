'use client'
import { useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { prepareOffline, prepareHd, planHd, readPrepState, PREP_VERSION } from '@/lib/offlinePrepare'

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
// collection seulement en Wi-Fi (sinon : bouton dans les paramètres, pour ne pas
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

      // Connexion non facturée à l'usage : Wi-Fi/ethernet, ou type inconnu sur un
      // ordinateur (iOS et Firefox ne l'exposent pas -- sur mobile on reste prudent).
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      const unmetered = conn?.type === 'wifi' || conn?.type === 'ethernet' || (!conn?.type && !mobile)
      const cellular = conn?.type === 'cellular'

      // Rien à refaire si tout est complet et récent ; sinon (première fois, images
      // ou HD incomplètes, nouvelles cartes) on reprend, seul le manquant se télécharge.
      const state = readPrepState()
      const complete = !!state && state.v === PREP_VERSION && (cellular || state.imagesDone) && (!unmetered || state.hdDone)
      if (complete && Date.now() - state!.at < REFRESH_EVERY_MS) return

      try {
        await prepareOffline(user.id, { images: !cellular })
        if (cancelled || !unmetered || !navigator.onLine) return
        // HD (plusieurs Go) : seulement hors forfait mobile et s'il y a la place.
        const plan = await planHd(user.id)
        if (plan.missing === 0 || cancelled) return
        if (plan.bytes !== null && plan.free !== null && plan.bytes * 1.1 > plan.free) return
        await prepareHd(user.id, {})
      } catch { /* silencieux : le bouton des paramètres reste disponible */ }
    }, 10000) // laisse d'abord la page vraiment affichée finir de charger

    return () => { cancelled = true; clearTimeout(timer) }
  }, [user?.id])

  return null
}
