import { Capacitor } from '@capacitor/core'
import { recordJsError } from '@/lib/crashlytics'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

/**
 * Télécharge un fichier sur web (via <a download>, qui ne fonctionne pas dans
 * la WebView Android) ou l'enregistre + ouvre le partage natif sur l'app,
 * seule façon fiable d'exporter un fichier depuis une WebView Capacitor.
 */
export async function saveOrShareFile(source: Blob | string, filename: string, opts?: { timeoutMs?: number }) {
  const isNative = Capacitor.isNativePlatform()
  const blob = typeof source === 'string' ? await dataUrlToBlob(source) : source

  if (!isNative) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoquer immediatement peut couper le telechargement avant que le
    // navigateur ait fini de lire le blob (surtout pour un fichier de
    // quelques Mo comme une video) -- observe : le clic ne semblait "rien
    // faire" sur un export video. On laisse un delai avant de liberer l'URL.
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return
  }

  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  // Un pont Capacitor natif qui ne repond jamais (observe en prod sur l'export
  // setlist : le bouton restait bloque sur "Generation..." sans fin ni erreur,
  // et resignale depuis sur d'autres exports) laissait l'appelant en attente
  // indefinie -- un timeout transforme ce cas en echec explicite plutot qu'un
  // blocage silencieux. Le timeout d'ecriture reste court (pure I/O, doit
  // etre rapide) ; Share.share() en a maintenant un aussi, beaucoup plus
  // large (le choix de l'utilisateur dans la feuille de partage peut
  // legitimement prendre du temps) -- sans lui, un appel Share.share() qui
  // n'aboutit jamais (l'app ne repond pas, la feuille ne s'ouvre meme pas)
  // bloquait le bouton sur "Telechargement..." sans fin, ce qui est
  // exactement ce qui a ete signale.
  try {
    const base64 = await Promise.race([
      blobToBase64(blob),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (conversion fichier)")), opts?.timeoutMs ?? 15000)),
    ])
    const { uri } = await Promise.race([
      Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (ecriture fichier)")), opts?.timeoutMs ?? 15000)),
    ])
    await Promise.race([
      Share.share({ url: uri, title: filename }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (partage)")), 60000)),
    ])
  } catch (e) {
    // La plupart des appelants n'ont pas leur propre try/catch autour de
    // saveOrShareFile -- un echec natif (ecriture, permission, FileProvider)
    // remontait donc en simple rejet de promesse non intercepte, invisible
    // pour l'utilisateur ET pour nous (aucun rapport, juste "le telechargement
    // ne marche pas" sans plus de details). On logue systematiquement dans
    // Crashlytics ici, au point unique par lequel passent tous les exports,
    // avant de relancer l'erreur pour ne pas changer le comportement des
    // appelants qui gerent deja leur propre message.
    recordJsError(e, `saveOrShareFile (${filename})`)
    throw e
  }
}
