import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import sanitizeHtml from 'sanitize-html'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/lib/LangContext'
import { guidesI18n } from '@/lib/guidesI18n'
import { normalizeGuideBlocks, type GuideBlock } from '@/lib/guideBlockTypes'
import PyramidBlock from '@/components/guide-blocks/PyramidBlock'
import InsertGridBlock from '@/components/guide-blocks/InsertGridBlock'
import SetlistEmbedBlock from '@/components/guide-blocks/SetlistEmbedBlock'
import TextImageBlock from '@/components/guide-blocks/TextImageBlock'

// sanitize-html plutôt qu'isomorphic-dompurify : ce dernier embarque jsdom, connu
// pour mal se bundler dans les fonctions serverless Vercel (500 en prod alors que
// ça marchait en local). Liste blanche calquée sur ce que produit GuideEditor.tsx
// (StarterKit + Image + Link + Youtube).
function sanitizeGuideHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['h2', 'h3', 'p', 'a', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'b', 'i', 'img', 'iframe', 'br', 'span'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'style'],
      iframe: ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'style'],
      '*': ['style'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'],
  })
}

// Rendu bloc par bloc, mais regroupe les `insert_grid` consécutifs qui ne sont PAS
// en pleine largeur (width: 'half'/'third') dans une même rangée flex plutôt que de
// les empiler chacun sur toute la largeur — sinon un bloc n'ayant qu'une carte + un
// petit tableau occupe une pleine ligne de rien, ce qui devient vite long et
// indigeste dès qu'il y en a plusieurs (cas d'usage typique : une variation par
// bloc insert_grid).
function renderGuideBlocks(blocks: GuideBlock[], setlistEmbeds: Map<number, SetlistEmbedData>) {
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
        dangerouslySetInnerHTML={{ __html: sanitizeGuideHtml(block.html) }} />
    )
    if (block.type === 'image') return (
      <figure key={key} style={{ margin: '32px 0' }}>
        <img src={block.src} alt={block.caption || ''} style={{ width: '100%', borderRadius: 10, display: 'block' }} />
        {block.caption && <figcaption style={{ fontSize: 13, color: 'var(--text3, #999)', marginTop: 8, textAlign: 'center' }}>{block.caption}</figcaption>}
      </figure>
    )
    if (block.type === 'text_image') return (
      <TextImageBlock key={key} html={sanitizeGuideHtml(block.html)} image={block.image} imagePosition={block.imagePosition} />
    )
    if (block.type === 'pyramid') return <PyramidBlock key={key} title={block.title} rows={block.rows} />
    if (block.type === 'insert_grid') return (
      <div key={key} style={{ margin: '32px 0' }}>
        <InsertGridBlock title={block.title} cards={block.cards} oddsTable={block.oddsTable} players={block.players} />
      </div>
    )
    if (block.type === 'setlist_embed') {
      const data = setlistEmbeds.get(block.setId)
      if (!data) return null
      return <SetlistEmbedBlock key={key} title={block.title} setId={data.setId} setName={data.setName} totalCards={data.totalCards} sport={data.sport} entries={data.entries} />
    }
    return null
  }
}

export const revalidate = 300

async function resolveLang(): Promise<Lang> {
  const store = await cookies()
  const geo = store.get('geo-lang')?.value
  return geo === 'en' || geo === 'de' ? geo : 'fr'
}

interface Guide {
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string | null
  content: string
  blocks: GuideBlock[]
  published_at: string
}

async function fetchGuide(slug: string): Promise<Guide | null> {
  const { data } = await supabase
    .from('guides')
    .select('title, excerpt, cover_image, category, content, blocks, published_at')
    .eq('slug', slug)
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .single()
  if (!data) return null
  return { ...data, blocks: normalizeGuideBlocks(data.blocks, data.content) }
}

interface SetlistEmbedData {
  setId: number
  setName: string
  totalCards: number
  sport: string | null
  entries: { card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean }[]
}

// PostgREST plafonne chaque requête à 1000 lignes par défaut — un simple .limit(2000)
// ne suffisait pas pour les gros sets (Topps Chrome Update fait 6000+ cartes avec
// tous les parallèles), ce qui coupait silencieusement la checklist embarquée et
// vidait des onglets entiers (Autographs, Inserts...) puisque leurs cartes tombaient
// après la coupure. On pagine donc par blocs de 1000 jusqu'à tout récupérer.
async function fetchAllSetEntries(setId: number) {
  const entries: { card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean }[] = []
  const pageSize = 1000
  for (let from = 0; from < 20000; from += pageSize) {
    const { data, error } = await supabase
      .from('card_set_entries')
      .select('card_number, player_name, team, variation, is_rc')
      .eq('set_id', setId)
      .order('variation', { ascending: true })
      .order('card_number', { ascending: true })
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = await fetchGuide(slug)
  if (!guide) return { title: 'Guide | Memorabilius' }
  const title = `${guide.title} | Memorabilius`
  const description = guide.excerpt || undefined
  return {
    title, description,
    openGraph: { title, description, images: guide.cover_image ? [guide.cover_image] : undefined },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [guide, lang] = await Promise.all([fetchGuide(slug), resolveLang()])
  if (!guide) notFound()
  const t = guidesI18n[lang]
  const dateLocale = lang === 'en' ? 'en-US' : lang === 'de' ? 'de-DE' : 'fr-FR'
  const dateLabel = new Date(guide.published_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })

  const setlistEmbeds = new Map<number, SetlistEmbedData>()
  const setlistBlockIds = guide.blocks.filter((b): b is Extract<GuideBlock, { type: 'setlist_embed' }> => b.type === 'setlist_embed' && b.setId > 0).map(b => b.setId)
  if (setlistBlockIds.length) {
    const fetched = await Promise.all([...new Set(setlistBlockIds)].map(fetchSetlistEmbed))
    for (const f of fetched) if (f) setlistEmbeds.set(f.setId, f)
  }

  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px' }}>
      <Link href="/guides" style={{ fontSize: 13, fontWeight: 700, color: '#003DA6', textDecoration: 'none' }}>
        {t.guides_back}
      </Link>

      {guide.category && (
        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 800, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {guide.category}
        </div>
      )}
      <h1 style={{ fontSize: 32, fontWeight: 900, margin: '8px 0 8px', lineHeight: 1.2 }}>{guide.title}</h1>
      <p style={{ fontSize: 13, color: 'var(--text3, #999)', margin: '0 0 24px' }}>{dateLabel}</p>

      {guide.cover_image && (
        <img src={guide.cover_image} alt="" style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 28 }} />
      )}

      {renderGuideBlocks(guide.blocks, setlistEmbeds)}

      <style>{`
        .guide-content h2 { font-size: 24px; font-weight: 800; margin: 32px 0 12px; }
        .guide-content h3 { font-size: 19px; font-weight: 800; margin: 24px 0 10px; }
        .guide-content p { margin: 0 0 16px; }
        .guide-content img { max-width: 100%; border-radius: 8px; display: block; margin: 20px 0; }
        .guide-content ul, .guide-content ol { margin: 0 0 16px; padding-left: 24px; }
        .guide-content li { margin-bottom: 6px; }
        .guide-content blockquote { border-left: 3px solid #003DA6; margin: 20px 0; padding: 4px 0 4px 16px; color: var(--text2, #666); font-style: italic; }
        .guide-content a { color: #003DA6; }
        .guide-content iframe { max-width: 100%; border-radius: 8px; aspect-ratio: 16/9; width: 100%; height: auto; margin: 20px 0; }
      `}</style>
    </article>
  )
}
