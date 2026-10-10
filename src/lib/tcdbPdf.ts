// Lecture des PDF imprimables de TCDB ("Checklist" / "Your Collection") : une ligne par carte, "<numero> <joueur> [tags]".
// Dans "Your Collection", chaque carte POSSEDEE a une petite image (coche) a la place de la case vide, juste a gauche du numero.
// On ne se fie donc ni a l'ordre ni au texte pour la possession : on relie chaque image a la ligne dont elle recouvre la hauteur.

export interface TcdbRow { num: string; name: string; tags: string[]; owned: boolean }
export interface TcdbPdf {
  // 'checklist' = un seul set ("Checklist" / "Your Collection") ; 'collection' = "Collection Print" : TOUTES les cartes possedees,
  // une ligne par carte, "<set + insert/parallele> <numero> <joueur> [tags]" (donc rien a cocher : tout ce qui est liste est possede)
  kind: 'checklist' | 'collection'
  title: string
  sport: string | null
  rows: TcdbRow[]
  entries: string[]
  hasOwnedMarks: boolean
}

const NUM_RE = /^(\d+[a-zA-Z]?|[A-Za-z]{1,6}-?\d+[a-zA-Z]?)$/
const TAGS = new Set(['RC', 'AU', 'SP', 'VAR', 'ART', 'CL', 'SSP', 'ERR', 'COR', 'INS', 'MEM', 'PATCH', 'AUTO', 'NUM', 'RPA'])

export async function parseTcdbPdf(data: Uint8Array): Promise<TcdbPdf> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false, disableFontFace: true }).promise
  const OPS = pdfjs.OPS
  let title = ''
  const rows: TcdbRow[] = []
  const entries: string[] = []
  let anyImageMarks = false
  let collectionMode = false

  for (let pn = 1; pn <= doc.numPages; pn++) {
    const page = await doc.getPage(pn)
    const vp = page.getViewport({ scale: 1 })
    const H = vp.height

    // 1. texte, avec position (origine en haut) : x, y (haut de la ligne), hauteur
    const tc = await page.getTextContent()
    const items = tc.items
      .map((it: any) => ({ s: String(it.str || '').trim(), x: it.transform[4] as number, y: H - (it.transform[5] as number), h: (it.height as number) || 9 }))
      .filter((it: any) => it.s)

    // 2. images (cases cochees) : on suit la matrice courante pour connaitre leur position
    const ops = await page.getOperatorList()
    const marks: { x: number; y0: number; y1: number }[] = []
    let ctm = [1, 0, 0, 1, 0, 0]
    const stack: number[][] = []
    const mul = (a: number[], b: number[]) => [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
    ]
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], args = ops.argsArray[i]
      if (fn === OPS.save) stack.push(ctm.slice())
      else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
      else if (fn === OPS.transform) ctm = mul(ctm, args as number[])
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
        // l'image occupe le carre unite transforme par la matrice courante
        const x = ctm[4], yb = ctm[5], w = Math.abs(ctm[0]), h = Math.abs(ctm[3])
        if (w > 3 && w < 20 && h > 3 && h < 20 && x < 60) marks.push({ x, y0: H - (yb + h), y1: H - yb })
      }
    }
    anyImageMarks = anyImageMarks || marks.length > 0

    // 3. titre : premier texte apres l'adresse tcdb.com
    if (!title) {
      const k = items.findIndex((i: any) => /tcdb\.com/i.test(i.s))
      const t = k >= 0 ? items.slice(k + 1).filter((i: any) => i.y < items[k].y + 30) : []
      if (t.length) title = t.map((i: any) => i.s).join(' ').replace(/\s+/g, ' ')
    }

    collectionMode = collectionMode || /'s collection/i.test(title) || /collection\s*-\s*\w+/i.test(title)
    if (collectionMode) {
      // deux colonnes ; chaque carte commence par une annee ("2022-23 ...") et peut passer a la ligne
      const colOf = (x: number) => (x < 200 ? 0 : 1)
      const lines = [...items].filter((i: any) => i.y > 85).sort((a: any, b: any) => colOf(a.x) - colOf(b.x) || a.y - b.y || a.x - b.x)
      let cur = ''
      for (const it of lines) {
        const t = it.s.replace(/\s+/g, ' ')
        if (/^(\d{4}(-\d{2,4})?|\d{2}-\d{2})\s/.test(t)) { if (cur) entries.push(cur.trim()); cur = t }
        else if (cur) cur += (cur.endsWith('-') ? '' : ' ') + t
      }
      if (cur) entries.push(cur.trim())
      continue
    }

    // 4. lignes de carte. La page a plusieurs COLONNES : chaque element de texte est une ligne "<numero> <nom>" ou la suite
    //    d'une ligne (nom ou tags qui passent a la ligne) ; on les rattache a la ligne de carte de la meme colonne.
    const pageRows: { row: TcdbRow; x: number; y: number }[] = []
    const ordered = [...items].sort((a: any, b: any) => a.y - b.y || a.x - b.x)
    for (const it of ordered) {
      const m = it.s.replace(/\s+/g, ' ').match(/^(\S+)\s+(.+)$/)
      if (m && NUM_RE.test(m[1]) && it.x < 600 && !/tcdb\.com/i.test(it.s)) {
        const row: TcdbRow = { num: m[1], name: '', tags: [], owned: false }
        appendText(row, m[2])
        pageRows.push({ row, x: it.x, y: it.y })
        continue
      }
      let target: { row: TcdbRow; x: number; y: number } | null = null
      for (const pr of pageRows) {
        if (Math.abs(it.x - pr.x) < 16 && it.y > pr.y && it.y - pr.y < 16 && (!target || pr.y > target.y)) target = pr
      }
      if (target) { appendText(target.row, it.s); target.y = target.y }
    }
    for (const pr of pageRows) {
      // la case / coche est ~10,5 pt a gauche du numero, centree ~3,5 pt au-dessus de la ligne de base du texte
      pr.row.owned = marks.some(m => Math.abs(m.x - (pr.x - 10.5)) < 3.5 && Math.abs((m.y0 + m.y1) / 2 - (pr.y - 3.5)) < 5)
      rows.push(pr.row)
    }
  }
  const sportM = title.match(/collection\s*-\s*(.+)$/i)
  return { kind: collectionMode ? 'collection' : 'checklist', title: title.trim(), sport: sportM ? sportM[1].trim() : null, rows, entries, hasOwnedMarks: anyImageMarks }
}

function appendText(row: TcdbRow, text: string) {
  const words = text.split(/\s+/).filter(Boolean)
  for (const w of words) {
    const t = w.replace(/,$/, '')
    if (TAGS.has(t) && (row.name || row.tags.length)) row.tags.push(t)
    else if (row.tags.length === 0) row.name += (row.name && !row.name.endsWith('-') ? ' ' : '') + w
    else row.tags.push(t)
  }
  row.name = row.name.trim()
}
