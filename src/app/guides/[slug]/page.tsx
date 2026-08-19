import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import DOMPurify from 'isomorphic-dompurify'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/lib/LangContext'
import { guidesI18n } from '@/lib/guidesI18n'
import type { GuideBlock } from '@/lib/guideBlockTypes'
import PyramidBlock from '@/components/guide-blocks/PyramidBlock'
import InsertGridBlock from '@/components/guide-blocks/InsertGridBlock'
import SetlistEmbedBlock from '@/components/guide-blocks/SetlistEmbedBlock'

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
  return { ...data, blocks: Array.isArray(data.blocks) ? data.blocks : [] }
}

interface SetlistEmbedData {
  setId: number
  setName: string
  totalCards: number
  entries: { card_number: string | null; player_name: string; team: string | null; variation: string | null; is_rc: boolean }[]
}

async function fetchSetlistEmbed(setId: number): Promise<SetlistEmbedData | null> {
  const { data: set } = await supabase.from('card_sets').select('name, total_cards').eq('id', setId).single()
  if (!set) return null
  const { data: entries } = await supabase
    .from('card_set_entries')
    .select('card_number, player_name, team, variation, is_rc')
    .eq('set_id', setId)
    .order('variation', { ascending: true })
    .order('card_number', { ascending: true })
    .limit(2000)
  return { setId, setName: set.name, totalCards: set.total_cards, entries: entries || [] }
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
  const safeHtml = DOMPurify.sanitize(guide.content)
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

      <div
        className="guide-content"
        style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--text, #222)' }}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {guide.blocks.map((block, i) => {
        if (block.type === 'pyramid') return <PyramidBlock key={i} title={block.title} rows={block.rows} />
        if (block.type === 'insert_grid') return <InsertGridBlock key={i} title={block.title} cards={block.cards} oddsRows={block.oddsRows} />
        if (block.type === 'setlist_embed') {
          const data = setlistEmbeds.get(block.setId)
          if (!data) return null
          return <SetlistEmbedBlock key={i} title={block.title} setId={data.setId} setName={data.setName} totalCards={data.totalCards} entries={data.entries} />
        }
        return null
      })}

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
