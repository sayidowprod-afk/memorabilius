import { Capacitor } from '@capacitor/core'

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
  const base64 = await blobToBase64(blob)
  // Un pont Capacitor natif qui ne repond jamais (observe en prod sur l'export
  // setlist : le bouton restait bloque sur "Generation..." sans fin ni erreur)
  // laissait l'appelant en attente indefinie -- un timeout transforme ce cas
  // en echec explicite plutot qu'un blocage silencieux. Uniquement sur
  // l'ecriture (pure I/O, doit etre rapide) -- jamais sur Share.share(), qui
  // attend legitimement le choix de l'utilisateur dans la feuille de partage
  // native (peut prendre du temps sans que ce soit un bug).
  const { uri } = await Promise.race([
    Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout (ecriture fichier)")), opts?.timeoutMs ?? 15000)),
  ])
  await Share.share({ url: uri, title: filename })
}
