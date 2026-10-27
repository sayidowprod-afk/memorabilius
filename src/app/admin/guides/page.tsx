'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang, localeFor } from '@/lib/LangContext'
import { reorderGuideParallels, loadGuideRows } from '@/lib/guideGenerator'
import type { GuideBlock } from '@/lib/guideBlockTypes'

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
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [reorderMsg, setReorderMsg] = useState('')
  const [reordering, setReordering] = useState(false)

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

  const toggleSel = (id: number) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // Reordonne les pyramides des guides donnes (tirage saisi, sinon autres guides du meme produit/fabricant) et enregistre directement.
  const reorderGuides = async (list: Guide[]) => {
    if (!list.length) return
    if (!confirm(`Réordonner les parallèles de ${list.length} guide${list.length > 1 ? 's' : ''} (du plus rare au plus courant) ? L'ordre actuel des pyramides sera remplacé et enregistré.`)) return
    setReordering(true); setReorderMsg('')
    let changed = 0, failed = 0
    try {
      const rows = await loadGuideRows() // chargees une fois pour tout le lot
      for (let i = 0; i < list.length; i++) {
        const g = list[i]
        setReorderMsg(`Réordonnement ${i + 1}/${list.length} : ${g.title}`)
        const { data: full } = await supabase.from('guides').select('blocks').eq('id', g.id).single()
        const blocks = (full?.blocks as GuideBlock[] | null) || []
        if (!blocks.some(b => b.type === 'pyramid')) continue
        const out = await reorderGuideParallels(g.title, blocks, rows)
        if (JSON.stringify(out.blocks) === JSON.stringify(blocks)) continue
        const { error } = await supabase.from('guides').update({ blocks: out.blocks, updated_at: new Date().toISOString() }).eq('id', g.id)
        if (error) failed++; else changed++
      }
      setReorderMsg(`Terminé : ${changed} guide${changed > 1 ? 's' : ''} réordonné${changed > 1 ? 's' : ''}, ${list.length - changed - failed} déjà dans le bon ordre${failed ? `, ${failed} en erreur` : ''}. Les traductions EN/DE gardent l'ancien ordre jusqu'à leur régénération.`)
      await loadAll()
    } catch (e) { setReorderMsg(e instanceof Error ? e.message : 'Erreur') }
    setReordering(false)
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

  const duplicate = async (g: Guide) => {
    const { data: full } = await supabase.from('guides')
      .select('title, excerpt, cover_image, category, content, blocks')
      .eq('id', g.id).single()
    if (!full) return
    const slug = `${g.slug}-copie-${Date.now().toString(36)}`
    const { data: created, error } = await supabase.from('guides').insert({
      ...full,
      title: `${full.title} (copie)`,
      slug,
      published: false,
      published_at: new Date().toISOString(),
    }).select('id').single()
    if (error) { alert(error.message); return }
    await loadAll()
    if (created) router.push(`/admin/guides/${created.id}`)
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/admin/guides/lot" style={{ padding: '10px 18px', borderRadius: 8, border: `1.5px solid #003DA6`, color: dark ? '#fff' : '#003DA6', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              ✨ Générer plusieurs guides
            </Link>
            <Link href="/admin/guides/nouveau" style={{ padding: '10px 18px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              {t('admin_guides_new')}
            </Link>
          </div>
        </div>

        {guides.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, color: text, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.size === guides.length} onChange={e => setSelected(e.target.checked ? new Set(guides.map(g => g.id)) : new Set())} />
              Tout sélectionner
            </label>
            <button type="button" disabled={reordering || selected.size === 0} onClick={() => reorderGuides(guides.filter(g => selected.has(g.id)))}
              style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text, fontWeight: 700, fontSize: 12, cursor: reordering || selected.size === 0 ? 'default' : 'pointer', opacity: reordering || selected.size === 0 ? 0.5 : 1 }}>
              ↕ Réordonner la sélection ({selected.size})
            </button>
            {reorderMsg && <span style={{ color: sub }}>{reorderMsg}</span>}
          </div>
        )}

        {loading ? <p style={{ color: sub }}>...</p> : guides.length === 0 ? (
          <p style={{ color: sub, fontSize: 14 }}>{t('guides_empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {guides.map(g => (
              <div key={g.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleSel(g.id)} aria-label="Sélectionner" style={{ flexShrink: 0 }} />
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
                  <button onClick={() => reorderGuides([g])} disabled={reordering} title="Réordonner les parallèles" style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    ↕ Réordonner
                  </button>
                  <button onClick={() => duplicate(g)} style={{ padding: '7px 12px', borderRadius: 7, border: `1px solid ${border}`, background: 'transparent', color: text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    {t('admin_guides_duplicate')}
                  </button>
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
