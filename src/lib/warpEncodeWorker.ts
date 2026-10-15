// Worker dédié à l'encodage JPEG final de warpCard (src/components/CardScanner.tsx).
// Sur certains WebView Android, canvas.toBlob() sur le thread principal a été mesuré
// à 4-13 secondes de façon imprévisible pour un même calcul/une même taille de sortie
// (probablement une pause GC ou une contention sur ce thread) -- OffscreenCanvas dans
// un Worker isole cet encodage du reste de l'app pour éviter cette contention.
self.onmessage = async (e: MessageEvent) => {
  const { width, height, buffer, quality } = e.data as { width: number; height: number; buffer: ArrayBuffer; quality: number }
  try {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('OffscreenCanvas 2d context indisponible')
    ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    ;(self as unknown as Worker).postMessage({ blob })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ error: String(err) })
  }
}
