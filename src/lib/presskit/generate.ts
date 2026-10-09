import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import strings from './strings.json'
import layout from './layout.json'

// Generation du dossier de presse PDF a la demande : les FONDS (public/presskit/bg-XX.jpg) sont des images
// pre-rendues sans texte ; tous les textes, les chiffres du jour et la langue sont redessines ici.
// Positions / styles : layout.json (extrait par scripts/presskit/build.js a partir du rendu francais).

export const PRESSKIT_LANGS = ['fr', 'en', 'de', 'es', 'it'] as const
export type PresskitLang = (typeof PRESSKIT_LANGS)[number]
export type PresskitStats = { collectors: number; cards: number; binders: number; trade: number }

const PAGE_W = 1600
const PAGE_H = 900

type Item = {
  key: string | null; num: string | null
  x: number; y: number; w: number; h: number; bx: number; bw: number
  fs: number; lh: number; b0: number; color: string; weight: number; op: number
  fam: 'sd' | 'sans'; ls: number; upper: boolean; align: string
  box: { pad: number[]; bw: number } | null
}
type Chips = { keys: string[]; x: number; y: number; w: number; fs: number; padX: number; h: number; bw: number; ls: number; gap: number; border: string; color: string }
type LayoutPage = { light: boolean; items: Item[]; chips: Chips[] }

function parseColor(c: string, op = 1) {
  const m = c.match(/rgba?\(([^)]+)\)/)
  const p = m ? m[1].split(',').map(parseFloat) : [255, 255, 255, 1]
  return { color: rgb((p[0] ?? 255) / 255, (p[1] ?? 255) / 255, (p[2] ?? 255) / 255), opacity: (p[3] ?? 1) * op }
}

export function resolveLang(input?: string | null, acceptLanguage?: string | null): PresskitLang {
  const norm = (s: string) => s.toLowerCase().slice(0, 2)
  if (input && (PRESSKIT_LANGS as readonly string[]).includes(norm(input))) return norm(input) as PresskitLang
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const l = norm(part.trim())
      if ((PRESSKIT_LANGS as readonly string[]).includes(l)) return l as PresskitLang
    }
  }
  return 'fr'
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`presskit: ${url} -> ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

// remplace ce que la police ne sait pas encoder (espaces fines des nombres, etc.)
function clean(text: string, font: PDFFont): string {
  const t = text.replace(/[   ]/g, ' ')
  let set: Set<number> | null = null
  try { set = new Set(font.getCharacterSet()) } catch { set = null }
  if (!set) return t
  return Array.from(t).map(ch => (ch === '\n' || set!.has(ch.codePointAt(0)!) ? ch : '?')).join('')
}
function supports(font: PDFFont, text: string): boolean {
  try {
    const set = new Set(font.getCharacterSet())
    return Array.from(text.replace(/[   ]/g, ' ')).every(ch => ch === '\n' || set.has(ch.codePointAt(0)!))
  } catch { return true }
}

const widthOf = (font: PDFFont, text: string, fs: number, ls: number) => font.widthOfTextAtSize(text, fs) + ls * Array.from(text).length

function wrap(font: PDFFont, text: string, fs: number, ls: number, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(' ')
    let line = ''
    for (const wd of words) {
      const test = line ? line + ' ' + wd : wd
      if (line && widthOf(font, test, fs, ls) > maxW) { out.push(line); line = wd } else line = test
    }
    out.push(line)
  }
  return out
}

function drawLine(page: PDFPage, font: PDFFont, text: string, x: number, baselinePx: number, fs: number, ls: number, col: ReturnType<typeof parseColor>) {
  const y = PAGE_H - baselinePx
  if (!ls) { page.drawText(text, { x, y, size: fs, font, color: col.color, opacity: col.opacity }); return }
  let cx = x
  for (const ch of Array.from(text)) {
    page.drawText(ch, { x: cx, y, size: fs, font, color: col.color, opacity: col.opacity })
    cx += font.widthOfTextAtSize(ch, fs) + ls
  }
}

export async function generatePresskit(opts: { origin: string; lang: PresskitLang; stats: PresskitStats }): Promise<Uint8Array> {
  const { origin, lang, stats } = opts
  const L = (strings as Record<string, Record<string, string>>)[lang] || strings.fr
  const F = strings.fr as Record<string, string>
  const tr = (key: string) => L[key] ?? F[key] ?? ''

  const now = new Date()
  const month = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(now)
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(now)
  const numFmt = new Intl.NumberFormat(lang)
  const values: Record<string, string> = {
    collectors: numFmt.format(stats.collectors), cards: numFmt.format(stats.cards),
    binders: numFmt.format(stats.binders), trade: numFmt.format(stats.trade),
  }
  const text = (key: string) => tr(key).replace('{m}', month.charAt(0).toUpperCase() + month.slice(1)).replace('{d}', date)

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(tr('foot_l'))
  pdf.setAuthor('Memorabilius')
  const [surf, regular, bold] = await Promise.all([
    fetchBytes(`${origin}/presskit/Surfquest.ttf`).then(b => pdf.embedFont(b, { subset: true })),
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ])
  const pages = (layout as { pages: LayoutPage[] }).pages
  const bgs = await Promise.all(pages.map((_, i) => fetchBytes(`${origin}/presskit/bg-${String(i + 1).padStart(2, '0')}.jpg`)))

  for (let i = 0; i < pages.length; i++) {
    const lp = pages[i]
    const page = pdf.addPage([PAGE_W, PAGE_H])
    page.drawImage(await pdf.embedJpg(bgs[i]), { x: 0, y: 0, width: PAGE_W, height: PAGE_H })

    for (const it of lp.items) {
      let raw = it.num ? (values[it.num] ?? '') : text(it.key || '')
      if (!raw) continue
      if (it.upper || it.fam === 'sd') raw = raw.toUpperCase()
      let font = it.fam === 'sd' ? surf : it.weight >= 700 ? bold : regular
      if (it.fam === 'sd' && !supports(surf, raw)) font = bold
      const txt = clean(raw, font)
      const col = parseColor(it.color, it.op)
      let fs = it.fs
      const ls = it.ls
      // un mot plus long que la boite (langues plus longues) : on reduit la taille plutot que de deborder
      const longest = Math.max(...txt.split(/[\s\n]+/).map(wd => widthOf(font, wd, fs, ls)))
      const avail = it.box ? Number.POSITIVE_INFINITY : it.w
      if (longest > avail) fs = fs * (avail / longest)
      const scale = fs / it.fs
      const lh = it.lh * scale
      const b0 = it.box ? it.b0 : it.b0 - (it.lh - lh) / 2 - (it.fs - fs) * 0.0
      if (it.box) {
        // etiquette de section a double filet
        const tw = widthOf(font, txt, fs, ls)
        const padL = it.x - it.bx
        const totalW = tw + 2 * padL
        const o = it.box.bw
        page.drawRectangle({ x: it.bx + o / 2, y: PAGE_H - (it.y + it.h) + o / 2, width: totalW - o, height: it.h - o, borderColor: col.color, borderWidth: o, opacity: 0, borderOpacity: col.opacity })
        const inset = o + 3
        page.drawRectangle({ x: it.bx + inset + 0.75, y: PAGE_H - (it.y + it.h) + inset + 0.75, width: totalW - 2 * inset - 1.5, height: it.h - 2 * inset - 1.5, borderColor: col.color, borderWidth: 1.5, opacity: 0, borderOpacity: col.opacity })
        drawLine(page, font, txt, it.x, it.y + b0, fs, ls, col)
        continue
      }
      // une ligne a l'origine (pied de page, etiquettes) : jamais de retour a la ligne ; sinon legere tolerance,
      // Helvetica n'ayant pas exactement la largeur de la police du rendu HTML
      const singleLine = it.h <= it.lh * 1.35 && !txt.includes('\n')
      const lines = singleLine ? [txt] : wrap(font, txt, fs, ls, it.w * 1.05)
      lines.forEach((ln, k) => {
        const lw = widthOf(font, ln, fs, ls)
        let x = it.x
        if (it.align === 'center') x = it.x + (it.w - lw) / 2
        else if (it.align === 'right' || it.align === 'end') x = it.x + it.w - lw
        drawLine(page, font, ln, x, it.y + b0 + k * lh, fs, ls, col)
      })
    }

    // groupes d'etiquettes (chips) : flux horizontal avec retour a la ligne
    for (const ch of lp.chips) {
      const border = parseColor(ch.border)
      const tcol = parseColor(ch.color)
      let x = ch.x
      let y = ch.y
      for (const key of ch.keys) {
        const raw = text(key).toUpperCase()
        const font = bold
        const t = clean(raw, font)
        const w = widthOf(font, t, ch.fs, ch.ls) + 2 * ch.padX + 2 * ch.bw
        if (x > ch.x && x + w > ch.x + ch.w) { x = ch.x; y += ch.h + ch.gap }
        page.drawRectangle({ x: x + ch.bw / 2, y: PAGE_H - (y + ch.h) + ch.bw / 2, width: w - ch.bw, height: ch.h - ch.bw, borderColor: border.color, borderWidth: ch.bw, opacity: 0, borderOpacity: border.opacity })
        drawLine(page, font, t, x + ch.bw + ch.padX, y + ch.h / 2 + ch.fs * 0.36, ch.fs, ch.ls, tcol)
        x += w + ch.gap
      }
    }
  }
  return pdf.save()
}
