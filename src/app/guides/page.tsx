import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'
import type { Lang } from '@/lib/LangContext'
import { guidesI18n } from '@/lib/guidesI18n'

export const revalidate = 300

// Composant serveur : pas de useLang() (hook client) disponible ici. La langue est
// resolue au mieux via le cookie geo-lang pose par le middleware (voir
// middleware.ts) - moins precis que la resolution complete cote client (qui priorise
// aussi un choix explicite en localStorage), mais c'est le compromis accepte pour
// avoir un vrai rendu serveur (SEO) sur ces pages de contenu.
async function resolveLang(): Promise<Lang> {
  const store = await cookies()
  const geo = store.get('geo-lang')?.value
  return geo === 'en' || geo === 'de' ? geo : 'fr'
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveLang()
  const t = guidesI18n[lang]
  return {
    title: `${t.guides_title} | Memorabilius`,
    description: t.guides_subtitle,
    openGraph: { title: `${t.guides_title} | Memorabilius`, description: t.guides_subtitle },
  }
}

interface Guide {
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string | null
  published_at: string
}

async function fetchGuides(): Promise<Guide[]> {
  const { data, error } = await supabase
    .from('guides')
    .select('slug, title, excerpt, cover_image, category, published_at')
    .eq('published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  if (error) console.error('[guides] Supabase error:', error.message)
  return data || []
}

export default async function GuidesPage() {
  const [guides, lang] = await Promise.all([fetchGuides(), resolveLang()])
  const t = guidesI18n[lang]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 6px' }}>{t.guides_title}</h1>
      <p style={{ color: 'var(--text2, #777)', fontSize: 15, margin: '0 0 32px' }}>
        {t.guides_subtitle}
      </p>

      {guides.length === 0 ? (
        <p style={{ color: 'var(--text3, #999)' }}>{t.guides_empty}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {guides.map(g => (
            <Link key={g.slug} href={`/guides/${g.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                border: '1px solid var(--border, #eee)', borderRadius: 14, overflow: 'hidden',
                background: 'var(--card-bg, #fff)', height: '100%', display: 'flex', flexDirection: 'column',
              }}>
                {g.cover_image ? (
                  <img src={g.cover_image} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg3, #f0f0f0)' }} />
                )}
                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.category && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.category}</span>
                  )}
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{g.title}</h2>
                  {g.excerpt && <p style={{ fontSize: 13, color: 'var(--text2, #777)', margin: 0, lineHeight: 1.5 }}>{g.excerpt}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
