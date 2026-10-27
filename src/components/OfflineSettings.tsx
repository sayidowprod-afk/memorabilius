'use client'
import { useEffect, useState } from 'react'
import { useIsNative, useIsAppUI } from '@/lib/useIsNative'
import { useAuth } from '@/lib/AuthContext'
import { isNativeOfflineEnabled, enableNativeOffline, disableNativeOffline } from '@/lib/offlineMode'
import { prepareOffline, prepareHd, planHd, verifyOffline, type VerifyReport, readPrepState, clearPrepState, PREP_EVENT, type PrepState, type PrepProgress } from '@/lib/offlinePrepare'

// Mode hors ligne dans les paramètres. Sur le web/PWA le service worker est toujours
// actif : on n'affiche que l'état de la préparation et son bouton. Dans l'app
// native, un interrupteur (bêta) l'active -- voir lib/offlineMode.ts pour le
// pourquoi du opt-in.
// hideInAppUI : sur /profil (desktop, navigateur) on le montre ; dans l'interface
// app (native + PWA installée), les réglages sont dans /parametres, lié par la
// barre du bas -- on évite le doublon.
export default function OfflineSettings({ hideInAppUI = false }: { hideInAppUI?: boolean }) {
  const isNative = useIsNative()
  const appUI = useIsAppUI()
  const { user } = useAuth()
  const [nativeOn, setNativeOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [state, setState] = useState<PrepState | null>(null)
  const [progress, setProgress] = useState<PrepProgress | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [report, setReport] = useState<VerifyReport | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setNativeOn(isNativeOfflineEnabled())
    const refresh = () => setState(readPrepState())
    refresh()
    window.addEventListener(PREP_EVENT, refresh)
    return () => window.removeEventListener(PREP_EVENT, refresh)
  }, [])

  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  if (!supported || !user || (hideInAppUI && appUI)) return null
  // Natif : tant que l'interrupteur n'est pas activé, il n'y a que lui à montrer.
  const active = !isNative || nativeOn

  const toggleNative = async () => {
    setBusy(true); setMsg('')
    try {
      if (nativeOn) {
        await disableNativeOffline()
        clearPrepState()
        setNativeOn(false)
        setMsg('Mode hors ligne désactivé. Redémarre l\'app pour finir de le retirer.')
      } else {
        await enableNativeOffline()
        setNativeOn(true)
        setMsg('Activé. Redémarre l\'app, puis laisse-la ouverte quelques instants avec du réseau : elle prépare ta collection toute seule.')
      }
    } catch {
      setMsg('Impossible de modifier le mode hors ligne sur cet appareil.')
    } finally {
      setBusy(false)
    }
  }

  const prepare = async () => {
    setPreparing(true); setMsg('')
    try {
      await prepareOffline(user.id, { images: true, onProgress: setProgress })
    } catch {
      setMsg('La préparation a échoué. Réessaie avec une meilleure connexion.')
    } finally {
      setPreparing(false); setProgress(null); setState(readPrepState())
    }
  }

  const fmtSize = (b: number) => b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' Go' : Math.round(b / 1048576) + ' Mo'

  // HD : étape à part (plusieurs Go) -- on annonce la taille mesurée et l'espace
  // libre AVANT de télécharger, et on refuse s'il n'y a pas la place.
  const prepareHdFlow = async () => {
    setPreparing(true); setMsg('')
    try {
      const plan = await planHd(user.id)
      if (plan.missing === 0) { setMsg('Toute la HD est déjà sur cet appareil.'); return }
      if (plan.bytes !== null && plan.free !== null && plan.bytes * 1.1 > plan.free) {
        setMsg(`Pas assez d'espace : il faut environ ${fmtSize(plan.bytes)}, il reste ${fmtSize(plan.free)}. Libère de la place sur l'appareil.`)
        return
      }
      const size = plan.bytes !== null ? 'environ ' + fmtSize(plan.bytes) : 'plusieurs centaines de Mo'
      if (!window.confirm('Télécharger ' + plan.missing + ' images HD (' + size + ') pour le viewer 3D hors ligne ? Fais-le de préférence en Wi-Fi.')) return
      await prepareHd(user.id, { onProgress: setProgress })
    } catch {
      setMsg('Le téléchargement HD a échoué. Réessaie avec une meilleure connexion.')
    } finally {
      setPreparing(false); setProgress(null); setState(readPrepState())
    }
  }

  const verify = async () => {
    setChecking(true); setMsg('')
    try { setReport(await verifyOffline(user.id)) } catch { setMsg('Vérification impossible sur cet appareil.') } finally { setChecking(false) }
  }

  const when = state ? new Date(state.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null
  const label = progress
    ? progress.phase === 'pages'
      ? `Préparation des pages… ${progress.done}/${progress.total}`
      : progress.phase === 'hd'
        ? `Téléchargement HD… ${progress.done}/${progress.total}`
        : `Téléchargement des images… ${progress.done}/${progress.total}`
    : null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, margin: '16px 0', background: 'var(--bg2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            📡 Mode hors ligne {isNative && <span style={{ fontSize: 11, fontWeight: 800, color: '#e67e22' }}>BÊTA</span>}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
            Consulter l'accueil et ta galerie sans connexion (mode avion). Lecture seule.
          </div>
        </div>
        {isNative && (
          <button type="button" onClick={toggleNative} disabled={busy} aria-pressed={nativeOn}
            style={{
              flexShrink: 0, minWidth: 84, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: busy ? 'default' : 'pointer',
              fontWeight: 800, fontSize: 13, color: '#fff', background: nativeOn ? '#27ae60' : '#7f8c8d', opacity: busy ? 0.6 : 1,
            }}>
            {nativeOn ? 'Activé' : 'Désactivé'}
          </button>
        )}
      </div>

      {active && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)' }}>
          {label ? (
            <div style={{ fontWeight: 700 }}>{label}</div>
          ) : state ? (
            <div>
              ✓ Pages prêtes ({when}).{' '}
              {state.imagesTotal > 0
                ? <>Images : {state.images}/{state.imagesTotal}{state.imagesDone ? ' ✓' : ' (incomplet)'}.</>
                : <>Les images ne sont pas encore téléchargées.</>}
            </div>
          ) : (
            <div>Pas encore préparé : ça se fait tout seul quelques secondes après ton arrivée sur le site, avec du réseau.</div>
          )}
          <button type="button" onClick={prepare} disabled={preparing}
            style={{
              marginTop: 10, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg3)', color: 'var(--text)', fontWeight: 700, fontSize: 13,
              cursor: preparing ? 'default' : 'pointer', opacity: preparing ? 0.6 : 1,
            }}>
            {preparing ? 'En cours…' : state?.imagesDone ? 'Mettre à jour' : 'Télécharger ma collection'}
          </button>
          {state?.imagesDone && (
            <>
              <div style={{ marginTop: 12 }}>
                {state.hdTotal ? <>HD (viewer 3D) : {state.hd ?? 0}/{state.hdTotal}{state.hdDone ? ' ✓' : ' (incomplet)'}.</> : <>HD (viewer 3D) : pas encore téléchargée.</>}
              </div>
              <button type="button" onClick={prepareHdFlow} disabled={preparing}
                style={{
                  marginTop: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg3)', color: 'var(--text)', fontWeight: 700, fontSize: 13,
                  cursor: preparing ? 'default' : 'pointer', opacity: preparing ? 0.6 : 1,
                }}>
                {preparing ? 'En cours…' : state.hdDone ? 'Mettre à jour la HD' : 'Ajouter la HD (viewer 3D)'}
              </button>
            </>
          )}
          <button type="button" onClick={verify} disabled={checking || preparing}
            style={{ marginTop: 8, marginLeft: 8, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: checking ? 0.6 : 1 }}>
            {checking ? 'Vérification…' : 'Vérifier le téléchargement'}
          </button>
          {report && (
            <div style={{ marginTop: 10, lineHeight: 1.7 }}>
              {([
                ['Accueil', report.home],
                ['Galerie', report.gallery],
                ['Données de la collection (' + report.dataEntries + ' requêtes)', report.collectionData],
                ['Viewer 3D (' + report.scripts + ' fichiers de code)', report.viewer],
                ['Images : ' + report.images.cached + '/' + report.images.total, report.images.cached === report.images.total],
                ['HD : ' + report.hd.cached + '/' + report.hd.total, report.hd.cached === report.hd.total],
              ] as [string, boolean][]).map(([name, ok]) => (
                <div key={name} style={{ color: ok ? '#27ae60' : '#e74c3c', fontWeight: 700 }}>{ok ? '✓' : '✗'} {name}</div>
              ))}
              {report.usage !== null && <div>Espace utilisé : {fmtSize(report.usage)}</div>}
            </div>
          )}
          <div style={{ fontSize: 11, marginTop: 6 }}>Les images peuvent représenter plusieurs centaines de Mo : de préférence en Wi-Fi.</div>
        </div>
      )}
      {msg && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10 }}>{msg}</div>}
    </div>
  )
}
