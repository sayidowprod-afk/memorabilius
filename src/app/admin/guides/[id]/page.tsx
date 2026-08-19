'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { toast } from '@/lib/toast'
import { uploadGuideImage } from '@/lib/guideUpload'
import { normalizeGuideBlocks, type GuideBlock } from '@/lib/guideBlockTypes'

const GuideEditor = dynamic(() => import('@/components/GuideEditor'), { ssr: false })
const GuideBlocksEditor = dynamic(() => import('@/components/GuideBlocksEditor'), { ssr: false })

function slugify(s: string) {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export default function AdminGuideEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nouveau'
  const { dark } = useTheme()
  const { t } = useLang()
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [category, setCategory] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [content, setContent] = useState('')
  const [blocks, setBlocks] = useState<GuideBlock[]>([])
  const [published, setPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [uploadingCover, setUploadingCover] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      setChecking(false)
      if (!isNew) {
        const { data: g } = await supabase.from('guides').select('*').eq('id', id).single()
        if (g) {
          setTitle(g.title); setSlug(g.slug); setExcerpt(g.excerpt || '')
          setCategory(g.category || ''); setCoverImage(g.cover_image || ''); setContent(g.content || '')
          setBlocks(normalizeGuideBlocks(g.blocks))
          setPublished(g.published); setPublishedAt(new Date(g.published_at).toISOString().slice(0, 16))
          setSlugTouched(true)
        }
      }
    })
  }, [])

  const onTitleChange = (v: string) => {
    setTitle(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  const uploadCover = async (file: File) => {
    setUploadingCover(true)
    const url = await uploadGuideImage(file, 'covers/')
    setUploadingCover(false)
    if (url) setCoverImage(url)
  }

  const save = async () => {
    if (!title.trim() || !slug.trim()) { toast.error('Titre et slug requis'); return }
    setSaving(true)
    const payload = {
      title: title.trim(), slug: slug.trim(), excerpt: excerpt.trim() || null,
      category: category.trim() || null, cover_image: coverImage || null, content, blocks,
      published, published_at: new Date(publishedAt).toISOString(), updated_at: new Date().toISOString(),
    }
    const { error } = isNew
      ? await supabase.from('guides').insert(payload)
      : await supabase.from('guides').update(payload).eq('id', id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(t('admin_guides_saved'))
    router.push('/admin/guides')
  }

  if (checking) return null

  const bg = dark ? '#121212' : '#f7f8fa'
  const card = dark ? '#1e1e1e' : 'white'
  const border = dark ? '#2a2a2a' : '#eee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'
  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`,
    background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ color: text, margin: '0 0 24px', fontSize: 24, fontWeight: 800 }}>
          {isNew ? t('admin_guides_new') : t('admin_guides_edit')}
        </h1>

        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={label}>{t('admin_guides_field_title')}</label>
            <input value={title} onChange={e => onTitleChange(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={label}>{t('admin_guides_field_slug')}</label>
            <input value={slug} onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true) }} style={inp} />
          </div>
          <div>
            <label style={label}>{t('admin_guides_field_excerpt')}</label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
          <div>
            <label style={label}>{t('admin_guides_field_category')}</label>
            <input value={category} onChange={e => setCategory(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={label}>{t('admin_guides_field_cover')}</label>
            {coverImage && <img src={coverImage} alt="" style={{ width: '100%', maxWidth: 320, borderRadius: 8, display: 'block', marginBottom: 8 }} />}
            <input type="file" accept="image/*" disabled={uploadingCover}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f) }} />
          </div>
          <div>
            <label style={label}>{t('admin_guides_field_content')}</label>
            <GuideEditor content={content} onChange={setContent} />
          </div>
          <div>
            <label style={label}>Blocs additionnels</label>
            <GuideBlocksEditor blocks={blocks} onChange={setBlocks} />
          </div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: text, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
              {t('admin_guides_published')}
            </label>
            <div>
              <label style={label}>{t('admin_guides_field_published_at')}</label>
              <input type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} style={inp} />
            </div>
          </div>

          <button onClick={save} disabled={saving}
            style={{ alignSelf: 'flex-start', padding: '12px 24px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? t('admin_guides_saving') : t('admin_guides_save')}
          </button>
        </div>
      </div>
    </div>
  )
}
