// Couleur d'accent lisible sur le fond du panneau d'infos des exports : une
// couleur d'équipe très sombre (noir, bleu nuit...) deviendrait invisible sur
// le panneau sombre. On l'éclaircit (thème sombre) ou l'assombrit (thème clair)
// jusqu'à un contraste suffisant, en gardant sa teinte.
const lum = (r: number, g: number, b: number) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function readableAccent(accent: string, isDark: boolean, minContrast = 3.5): string {
  const rgb = parseHex(accent)
  if (!rgb) return isDark ? '#ffffff' : '#111111'
  const bg = isDark ? lum(8, 8, 26) : lum(253, 250, 246)
  const target = isDark ? 255 : 0
  let [r, g, b] = rgb
  for (let i = 0; i <= 20; i++) {
    const l = lum(r, g, b)
    const contrast = (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05)
    if (contrast >= minContrast) break
    const t = 0.08
    r = Math.round(r + (target - r) * t); g = Math.round(g + (target - g) * t); b = Math.round(b + (target - b) * t)
  }
  const x = (v: number) => v.toString(16).padStart(2, '0')
  return `#${x(r)}${x(g)}${x(b)}`
}
