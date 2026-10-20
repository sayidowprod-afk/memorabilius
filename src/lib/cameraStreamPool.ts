// Partage le flux camera entre plusieurs montages/demontages rapproches de
// CameraCapture (un scan de carte = ouvrir la camera, capturer, fermer --
// repete a chaque carte d'une session). Fermer puis rouvrir getUserMedia()
// tres vite, plusieurs fois de suite, est un bug WebKit/iOS connu : l'arret
// d'un flux ne libere pas toujours la session camera assez vite au niveau
// systeme, et apres une dizaine de cycles rapproches, iOS peut bloquer tout
// le sous-systeme camera (site ET appli Appareil photo native), necessitant
// un redemarrage du telephone -- signale par un utilisateur iOS.
//
// Au lieu d'arreter le flux a chaque fermeture, on le GARDE en vie pendant
// une courte periode de grace : si l'utilisateur rouvre la camera pour la
// carte suivante dans ce delai (cas courant), on reutilise le MEME flux
// (instantane, pas de nouvelle negociation materielle). Sinon, on le coupe
// vraiment -- et IMMEDIATEMENT (pas d'attente) si la page passe en arriere-
// plan ou se ferme, pour ne jamais laisser la camera allumee inutilement.
const GRACE_MS = 20000

let current: { stream: MediaStream; deviceId: string | null } | null = null
let releaseTimer: ReturnType<typeof setTimeout> | null = null

function hardStop() {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
  current?.stream.getTracks().forEach(t => t.stop())
  current = null
}

// Reutilise le flux existant si c'est le meme capteur (deviceId) et qu'il
// est toujours vivant (readyState 'live') -- sinon arrete l'ancien et en
// demande un nouveau.
export async function acquireCameraStream(
  constraints: MediaStreamConstraints,
  deviceId: string | null,
): Promise<MediaStream> {
  if (releaseTimer) { clearTimeout(releaseTimer); releaseTimer = null }
  if (current && current.deviceId === deviceId && current.stream.getVideoTracks().some(t => t.readyState === 'live')) {
    return current.stream
  }
  if (current) { current.stream.getTracks().forEach(t => t.stop()); current = null }
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  current = { stream, deviceId }
  return stream
}

// A appeler quand CameraCapture se demonte (fermeture normale) -- ne coupe
// PAS immediatement, laisse une fenetre de reutilisation pour la carte
// suivante.
export function releaseCameraStream() {
  if (releaseTimer) clearTimeout(releaseTimer)
  releaseTimer = setTimeout(hardStop, GRACE_MS)
}

// Coupe reellement et tout de suite -- arriere-plan, navigation hors de la
// page de scan, fermeture de l'onglet.
export function forceStopCameraStream() {
  hardStop()
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden) forceStopCameraStream() })
  window.addEventListener('pagehide', forceStopCameraStream)
}
