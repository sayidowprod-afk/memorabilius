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
  // Confirme en prod (rapport utilisateur, "Timeout (ecriture fichier)"
  // systematique) : la cause reelle du "telechargement qui ne marche jamais"
  // etait bien l'ecriture, pas le partage. Passer TOUT le fichier encode en
  // base64 (donc ~33% plus gros que l'original) en un seul appel writeFile()
  // envoie un unique message JSON geant a travers le pont JS<->natif de la
  // WebView -- ca peut suffire a bloquer ce pont pendant plusieurs dizaines
  // de secondes (voire indefiniment) sur un appareil bas/moyen de gamme des
  // que le fichier depasse quelques Mo (une video de quelques secondes y
  // arrive largement). C'est un probleme connu de @capacitor/filesystem sur
  // Android -- le contournement standard est d'ecrire par morceaux (chaque
  // appel reste petit et rapide) plutot qu'en un seul bloc.
  const CHUNK_SIZE = 512 * 1024 // 512 Ko de texte base64 par appel
  async function writeFileChunked(path: string, base64: string): Promise<string> {
    const { uri } = await Filesystem.writeFile({ path, data: base64.slice(0, CHUNK_SIZE), directory: Directory.Cache })
    for (let i = CHUNK_SIZE; i < base64.length; i += CHUNK_SIZE) {
      await Filesystem.appendFile({ path, data: base64.slice(i, i + CHUNK_SIZE), directory: Directory.Cache })
    }
    return uri
  }

  try {
    const base64 = await Promise.race([
      blobToBase64(blob),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (conversion fichier)")), opts?.timeoutMs ?? 15000)),
    ])
    // Timeout large : desormais plusieurs appels natifs a la suite (un par
    // morceau), pas un seul -- doit couvrir le total, pas juste un appel.
    const uri = await Promise.race([
      writeFileChunked(filename, base64),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (ecriture fichier)")), Math.max(opts?.timeoutMs ?? 15000, 30000))),
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
