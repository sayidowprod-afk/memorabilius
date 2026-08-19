'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang, localeFor } from '@/lib/LangContext'

interface Guide {
  id: number
  slug: string
  title: string
  category: string | null
  published: boolean
  published_at: string
  updated_at: string
}

export default function AdminGuidesPage() {
  const { dark } = useTheme()
  const { t, lang } = useLang()
  const router = useRouter()
  const [guides, setGuides] = useState<Guide[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      loadAll()
    })
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('guides').select('id, slug, title, category, published, published_at, updated_at').order('updated_at', { ascending: false })
    setGuides(data || [])
    setLoading(false)
  }

  const togglePublish = async (g: Guide) => {
    await supabase.from('guides').update({ published: !g.published }).eq('id', g.id)
    loadAll()
  }

  const remove = async (g: Guide) => {
    if (!confirm(t('admin_guides_confirm_delete'))) return
    await supabase.from('guides').delete().eq('id', g.id)
    loadAll()
  }

  const bg = dark ? '#121212' : '#f7f8fa'
  const card = dark ? '#1e1e1e' : 'white'
  const border = dark ? '#2a2a2a' : '#eee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const formatDate = (d: string) => new Date(d).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: text, margin: 0, fontSize: 26, fontWeight: 800 }}>{t('admin_guides_title')}</h1>
          <Link href="/admin/guides/nouveau" style={{ padding: '10px 18px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            {t('admin_guides_new')}
          </Link>
        </div>

        {loading ? <p style={{ color: sub }}>...</p> : guides.length === 0 ? (
          <p style={{ color: sub, fontSize: 14 }}>{t('guides_empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guides.map(g => (
              <div key={g.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ color: text, margin: 0, fontWeight: 700 }}>{g.title}</p>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, background: g.published ? '#2ecc71' : (dark ? '#333' : '#eee'), color: g.published ? 'white' : sub }}>
                      {g.published ? t('admin_guides_published') : t('admin_guides_draft')}
                    </span>
                  </div>
                  <p style={{ color: sub, margin: '2px 0 0', fontSize: 12 }}>
                    {g.category && <>{g.category} · </>}{formatDate(g.updated_at)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => togglePublish(g)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {g.published ? t('admin_guides_unpublish') : t('admin_guides_publish')}
                  </button>
                  <Link href={`/admin/guides/${g.id}`} style={{ padding: '7px 12px', borderRadius: 7, background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                    {t('admin_guides_edit')}
                  </Link>
                  <button onClick={() => remove(g)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {t('admin_guides_delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
