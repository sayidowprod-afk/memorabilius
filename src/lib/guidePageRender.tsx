import sanitizeHtml from 'sanitize-html'
import { supabase } from '@/lib/supabase'
import type { GuideBlock } from '@/lib/guideBlockTypes'
import PyramidBlock from '@/components/guide-blocks/PyramidBlock'
import InsertGridBlock from '@/components/guide-blocks/InsertGridBlock'
import SetlistEmbedBlock from '@/components/guide-blocks/SetlistEmbedBlock'
import TextImageBlock from '@/components/guide-blocks/TextImageBlock'
import { buildColorVocab } from '@/lib/variationMatch'

// Rendu partagé entre la version source (/guides/[slug], français) et les
// versions traduites (/[lang]/guides/[slug], anglais/allemand — voir
// src/app/[lang]/guides/[slug]/page.tsx et supabase/migrations/20260823_guide_translations.sql).

// sanitize-html plutôt qu'isomorphic-dompurify : ce dernier embarque jsdom, connu
// pour mal se bundler dans les fonctions serverless Vercel (500 en prod alors que
// ça marchait en local). Liste blanche calquée sur ce que produit GuideEditor.tsx
// (StarterKit + Image + Link + Youtube + Table + TaskList + Callout).
export function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h2', 'h3', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'b', 'i', 'u', 's', 'mark',
      'img', 'iframe', 'br', 'span', 'hr', 'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td', 'label', 'input', 'div',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'style'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'style'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
      ul: ['data-type'],
      li: ['data-type', 'data-checked'],
      input: ['type', 'checked', 'disabled'],
      div: ['data-callout'],
      '*': ['style'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'],
  })
}

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface TocItem { id: string; text: string; level: 2 | 3 }

// Sommaire auto-généré à partir des H2/H3 des blocs texte, dans l'ordre du guide.
// Les id injectés dans injectHeadingIds() suivent EXACTEMENT le même ordre de
// parcours (blocs texte/texte+image, dans l'ordre, un <h2>/<h3> à la fois) pour
// que les ancres du sommaire pointent sur le bon titre.
export function extractToc(blocks: GuideBlock[]): TocItem[] {
  const items: TocItem[] = []
  const seen = new Map<string, number>()
  const re = /<h([23])[^>]*>(.*?)<\/h\1>/gi
  for (const b of blocks) {
    if (b.type !== 'text' && b.type !== 'text_image') continue
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(b.html))) {
      const text = m[2].replace(/<[^>]+>/g, '').trim()
      if (!text) continue
      let slug = slugify(text) || 'section'
      const count = seen.get(slug) || 0
      seen.set(slug, count + 1)
      if (count > 0) slug = `${slug}-${count}`
      items.push({ id: slug, text, level: Number(m[1]) as 2 | 3 })
    }
  }
  return items
}

function injectHeadingIds(html: string, toc: TocItem[], cursor: { i: number }): string {
  return html.replace(/<h([23])((?:\s[^>]*)?)>/gi, (full, lvl, attrs) => {
    const item = toc[cursor.i]
    cursor.i++
    return item ? `<h${lvl}${attrs} id="${item.id}">` : full
  })
}

function collectPyramidRowNames(blocks: GuideBlock[]): string[] {
  const names: string[] = []
  for (const b of blocks) if (b.type === 'pyramid') for (const row of b.rows) if (row.name) names.push(row.name)
  return names
}

export interface SetlistEmbedData {
  setId: number
  setName: string
  totalCards: number
  sport: string | null
  entries: { card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean }[]
}

// PostgREST plafonne chaque requête à 1000 lignes par défaut — un simple .limit(2000)
// ne suffisait pas pour les gros sets (Topps Chrome Update fait 19 000+ cartes avec
// tous les parallèles), ce qui coupait silencieusement la checklist embarquée. On
// pagine donc par blocs de 1000 jusqu'à tout récupérer. Tri par `id` (clé primaire
// indexée) — SetlistEmbedBlock re-trie déjà tout côté client.
async function fetchAllSetEntries(setId: number) {
  const entries: SetlistEmbedData['entries'] = []
  const pageSize = 1000
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await supabase
      .from('card_set_entries')
      .select('card_number, player_name, team, variation, is_rc')
      .eq('set_id', setId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    entries.push(...data)
    if (data.length < pageSize) break
  }
  return entries
}

async function fetchSetlistEmbed(setId: number): Promise<SetlistEmbedData | null> {
  const { data: set } = await supabase.from('card_sets').select('name, total_cards, sport').eq('id', setId).single()
  if (!set) return null
  const entries = await fetchAllSetEntries(setId)
  return { setId, setName: set.name, totalCards: set.total_cards, sport: set.sport, entries }
}

export async function loadSetlistEmbeds(blocks: GuideBlock[]): Promise<Map<number, SetlistEmbedData>> {
  const setlistEmbeds = new Map<number, SetlistEmbedData>()
  const setlistBlockIds = blocks.filter((b): b is Extract<GuideBlock, { type: 'setlist_embed' }> => b.type === 'setlist_embed' && b.setId > 0).map(b => b.setId)
  if (setlistBlockIds.length) {
    const fetched = await Promise.all([...new Set(setlistBlockIds)].map(fetchSetlistEmbed))
    for (const f of fetched) if (f) setlistEmbeds.set(f.setId, f)
  }
  return setlistEmbeds
}

// Rendu bloc par bloc, mais regroupe les `insert_grid` consécutifs qui ne sont PAS
// en pleine largeur (width: 'half'/'third') dans une même rangée flex plutôt que de
// les empiler chacun sur toute la largeur.
export function renderGuideBlocks(blocks: GuideBlock[], setlistEmbeds: Map<number, SetlistEmbedData>, toc: TocItem[]) {
  const colorVocab = buildColorVocab(collectPyramidRowNames(blocks))
  const headingCursor = { i: 0 }
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < blocks.length) {
    const block = blocks[i]
    if (block.type === 'insert_grid' && block.width && block.width !== 'full') {
      const group: Extract<GuideBlock, { type: 'insert_grid' }>[] = []
      while (i < blocks.length) {
        const b = blocks[i]
        if (b.type === 'insert_grid' && b.width && b.width !== 'full') { group.push(b); i++ }
        else break
      }
      nodes.push(
        <div key={`group-${i}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '32px 0' }}>
          {group.map((b, gi) => (
            <div key={gi} style={{ flex: b.width === 'third' ? '1 1 30%' : '1 1 46%', minWidth: 220 }}>
              <InsertGridBlock title={b.title} cards={b.cards} oddsTable={b.oddsTable} players={b.players} />
            </div>
          ))}
        </div>
      )
      continue
    }
    nodes.push(renderSingleBlock(block, i))
    i++
  }
  return nodes

  function renderSingleBlock(block: GuideBlock, key: number): React.ReactNode {
    if (block.type === 'text') return (
      <div key={key} className="guide-content" style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--text, #222)' }}
        dangerouslySetInnerHTML={{ __html: injectHeadingIds(sanitizeGuideHtml(block.html), toc, headingCursor) }} />
    )
    if (block.type === 'image') return (
      <figure key={key} style={{ margin: '32px 0' }}>
        <img src={block.src} alt={block.caption || ''} style={{ width: '100%', borderRadius: 10, display: 'block' }} />
        {block.caption && <figcaption style={{ fontSize: 13, color: 'var(--text3, #999)', marginTop: 8, textAlign: 'center' }}>{block.caption}</figcaption>}
      </figure>
    )
    if (block.type === 'text_image') return (
      <TextImageBlock key={key} html={injectHeadingIds(sanitizeGuideHtml(block.html), toc, headingCursor)} image={block.image} imagePosition={block.imagePosition} />
    )
    if (block.type === 'pyramid') return <PyramidBlock key={key} title={block.title} rows={block.rows} layout={block.layout} />
    if (block.type === 'insert_grid') return (
      // Casse la largeur de <article> (760px) pour laisser au tableau d'odds la place
      // de s'afficher entièrement à côté de la carte au lieu de scroller/empiler dès
      // qu'il y a beaucoup de colonnes de parallèles.
      <div key={key} style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}>
        <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 20px', boxSizing: 'border-box' }}>
          <InsertGridBlock title={block.title} cards={block.cards} oddsTable={block.oddsTable} players={block.players} />
        </div>
      </div>
    )
    if (block.type === 'setlist_embed') {
      const data = setlistEmbeds.get(block.setId)
      if (!data) return null
      return <SetlistEmbedBlock key={key} title={block.title} setId={data.setId} setName={data.setName} totalCards={data.totalCards} sport={data.sport} entries={data.entries} colorVocab={colorVocab} />
    }
    return null
  }
}

export const GUIDE_CONTENT_STYLE = `
  .guide-content h2, .guide-content h3 { scroll-margin-top: 90px; }
  .guide-content h2 { font-size: 24px; font-weight: 800; margin: 32px 0 12px; }
  .guide-content h3 { font-size: 19px; font-weight: 800; margin: 24px 0 10px; }
  .guide-content p { margin: 0 0 16px; }
  .guide-content img { max-width: 100%; border-radius: 8px; display: block; margin: 20px 0; }
  .guide-content ul, .guide-content ol { margin: 0 0 16px; padding-left: 24px; list-style-position: outside; }
  /* Un alignement centré/droite laissé sur un paragraphe avant sa conversion en liste
     (bouton Centrer/Aligner à droite dans l'éditeur) se propage sur le <p> interne de
     chaque <li> — avec list-style-position hérité en "inside" par endroits, la puce se
     déplaçait avec le texte au lieu de rester fixe à gauche. Les listes restent toujours
     alignées à gauche, quel que soit l'alignement choisi avant la conversion. */
  .guide-content li, .guide-content li p { text-align: left !important; }
  .guide-content li { margin-bottom: 6px; }
  .guide-content blockquote { border-left: 3px solid #003DA6; margin: 20px 0; padding: 4px 0 4px 16px; color: var(--text2, #666); font-style: italic; }
  .guide-content a { color: #003DA6; }
  .guide-content iframe { max-width: 100%; border-radius: 8px; aspect-ratio: 16/9; width: 100%; height: auto; margin: 20px 0; }
  .guide-content hr { border: none; border-top: 1.5px solid var(--border, #e8eaed); margin: 32px 0; }
  .guide-content mark { background: #fff3a3; color: #222; padding: 0 2px; border-radius: 2px; }
  /* display:block + overflow-x:auto sur la <table> elle-même (pas de wrapper <div>
     possible, le HTML vient tel quel du contenu sanitisé) : un tableau à plusieurs
     colonnes ne se comprime jamais sous sa largeur de contenu minimale (width:100%
     seul ne l'empêche pas de déborder), ce qui poussait toute la page en scroll
     horizontal sur mobile au lieu de faire défiler seulement le tableau. */
  .guide-content table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; max-width: 100%; border-collapse: collapse; margin: 0 0 20px; font-size: 14px; }
  .guide-content th, .guide-content td { border: 1px solid var(--border, #e0e0e0); padding: 8px 10px; text-align: left; white-space: nowrap; }
  .guide-content th { background: var(--card-bg2, #f5f6f8); font-weight: 800; }
  .guide-content ul[data-type="taskList"] { list-style: none; padding-left: 0; margin: 0 0 16px; }
  .guide-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
  .guide-content ul[data-type="taskList"] li > label { display: flex; align-items: center; padding-top: 2px; }
  .guide-content ul[data-type="taskList"] input[type="checkbox"] { margin: 0; width: 16px; height: 16px; }
  .guide-content div[data-callout] { border-radius: 10px; padding: 14px 16px; margin: 0 0 20px; }
  .guide-content div[data-callout] p:last-child { margin-bottom: 0; }
  .guide-content div[data-callout="tip"] { background: rgba(0,184,148,0.1); border: 1px solid rgba(0,184,148,0.3); }
  .guide-content div[data-callout="warning"] { background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3); }
  .guide-content div[data-callout="info"] { background: rgba(0,61,166,0.08); border: 1px solid rgba(0,61,166,0.25); }
`

interface GuideArticleData {
  title: string
  excerpt: string | null
  coverImage: string | null
  category: string | null
  blocks: GuideBlock[]
  publishedAt: string
  backLabel: string
  backHref: string
  tocLabel: string
  dateLocale: string
}

export async function GuideArticle({ data }: { data: GuideArticleData }) {
  const setlistEmbeds = await loadSetlistEmbeds(data.blocks)
  const toc = extractToc(data.blocks)
  const dateLabel = new Date(data.publishedAt).toLocaleDateString(data.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px' }}>
      <a href={data.backHref} style={{ fontSize: 13, fontWeight: 700, color: '#003DA6', textDecoration: 'none' }}>
        {data.backLabel}
      </a>

      {data.category && (
        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 800, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {data.category}
        </div>
      )}
      <h1 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0 8px', lineHeight: 1.2 }}>{data.title}</h1>
      <p style={{ fontSize: 13, color: 'var(--text3, #999)', margin: '0 0 24px' }}>{dateLabel}</p>

      {data.coverImage && (
        <img src={data.coverImage} alt="" style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 28 }} />
      )}

      {toc.length >= 2 && (
        <nav aria-label={data.tocLabel} style={{ border: `1px solid var(--border, #e8eaed)`, borderRadius: 12, padding: '16px 18px', margin: '0 0 28px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text3, #888)', marginBottom: 8 }}>
            {data.tocLabel}
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {toc.map(item => (
              <li key={item.id} style={{ paddingLeft: item.level === 3 ? 16 : 0 }}>
                <a href={`#${item.id}`} style={{ fontSize: item.level === 3 ? 13 : 14, fontWeight: item.level === 3 ? 500 : 700, color: '#003DA6', textDecoration: 'none' }}>
                  {item.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {renderGuideBlocks(data.blocks, setlistEmbeds, toc)}

      <style>{GUIDE_CONTENT_STYLE}</style>
    </article>
  )
}
