'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useLang } from '@/lib/LangContext'

interface WishItem {
  id: string; nom: string; annee: string; marque: string
  collection: string; variation: string; num: string
  rc: boolean; auto: boolean; patch: boolean; notes: string
}

interface Collector { id: string; display_name: string; slug: string | null; cardImg?: string; accent?: string }

const empty = { nom: '', annee: '', marque: '', collection: '', variation: '', num: '', rc: false, auto: false, patch: false, notes: '' }

function WishCard({ item, accent, isOwner, onRemove }: {
  item: WishItem; accent: string; isOwner?: boolean; onRemove: () => void
}) {
  const [collectors, setCollectors] = useState<Collector[] | null>(null)
  const [cardImg, setCardImg] = useState<string | null>(null)
  const { t } = useLang()

  useEffect(() => {
    const params = new URLSearchParams({ name: item.nom })
    if (item.annee) params.set('year', item.annee)
    if (item.marque) params.set('brand', item.marque)
    if (item.collection) params.set('set', item.collection)
    if (item.variation) params.set('variant', item.variation)
    if (item.num) params.set('num', item.num)
    if (item.rc) params.set('rc', 'true')
    if (item.auto) params.set('auto', 'true')
    if (item.patch) params.set('patch', 'true')
    fetch(`/api/same-card?${params}`)
      .then(r => r.json())
      .then((d: Collector[]) => {
        setCollectors(d || [])
        const first = (d || []).find(c => c.cardImg)
        if (first?.cardImg) setCardImg(first.cardImg)
      })
  }, [item.id])

  const tags = [
    item.rc && { label: 'RC', bg: '#e67e22' },
    item.auto && { label: 'AUTO', bg: '#2e7d32' },
    item.patch && { label: 'PATCH', bg: '#1976d2' },
    item.num && { label: item.num, bg: '#7b1fa2' },
  ].filter(Boolean) as { label: string; bg: string }[]

  const isSupabase = cardImg?.includes('supabase.co')

  return (
    <div style={{
      background: 'white', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      {/* Card image area */}
      <div style={{
        background: cardImg ? 'transparent' : `linear-gradient(135deg, ${accent}22 0%, ${accent}44 100%)`,
        aspectRatio: '3/4', display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative', flexShrink: 0,
      }}>
        {cardImg ? (
          isSupabase ? (
            <Image
              src={cardImg}
              alt={item.nom}
              fill
              sizes="200px"
              style={{ objectFit: 'cover' }}
              unoptimized
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cardImg} alt={item.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontSize: 36, marginBottom: 6 }}>🎯</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: accent, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>
              Recherchée
            </div>
          </div>
        )}
        {/* Owner delete button overlay */}
        {isOwner && (
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 20,
              width: 24, height: 24, cursor: 'pointer', color: 'white',
              fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >✕</button>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, color: '#111' }}>{item.nom}</div>
        <div style={{ fontSize: 11, color: '#999', lineHeight: 1.3 }}>
          {[item.annee, item.marque, item.collection].filter(Boolean).join(' · ')}
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            {tags.map(tag => (
              <span key={tag.label} style={{
                fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4,
                background: tag.bg, color: 'white', textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{tag.label}</span>
            ))}
          </div>
        )}

        {item.notes && (
          <div style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic', lineHeight: 1.3 }}>
            &ldquo;{item.notes}&rdquo;
          </div>
        )}

        {/* Possédée par */}
        {collectors && collectors.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: 6 }}>
            <div style={{ fontSize: 9, color: '#bbb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {t('wishlist_owned_by')}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {collectors.map(c => (
                <Link key={c.id} href={`/galerie/${c.id}`} style={{
                  fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                  background: (c.accent || accent) + '18', color: c.accent || accent,
                  textDecoration: 'none', border: `1px solid ${(c.accent || accent)}44`,
                }}>
                  {c.display_name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PublicWishlist({ userId, accent, isOwner }: { userId: string; accent: string; isOwner?: boolean }) {
  const [items, setItems] = useState<WishItem[]>([])
  const [form, setForm] = useState(empty)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const { t, lang } = useLang()

  useEffect(() => {
    supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      .then(({ data }) => setItems(data || []))
  }, [userId])

  const save = async () => {
    if (!form.nom.trim()) return
    setSaving(true)
    const { data } = await supabase.from('wishlist').insert({ ...form, user_id: userId }).select().single()
    if (data) {
      setItems(prev => [data, ...prev])
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch('/api/wishlist-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ wishItem: data, wishUserId: userId }),
        })
      })
    }
    setForm(empty)
    setShowForm(false)
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('wishlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (items.length === 0 && !isOwner) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ccc' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
      <p style={{ fontWeight: 700 }}>{t('wishlist_none')}</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: 20 }}>
      {isOwner && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowForm(!showForm)} style={{
            background: showForm ? '#eee' : accent, color: showForm ? '#333' : 'white',
            border: 'none', borderRadius: 10, padding: '10px 20px',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>
            {showForm ? t('wishlist_cancel_add') : t('wishlist_add')}
          </button>
        </div>
      )}

      {showForm && isOwner && (
        <div style={{ background: 'white', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #eee' }}>
          <h3 style={{ fontWeight: 800, margin: '0 0 14px', fontSize: 14 }}>{t('wishlist_new_wanted')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('setlist_player')}</label>
              <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Shai Gilgeous-Alexander" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('gallery_year_label')}</label>
              <input value={form.annee} onChange={e => setForm(p => ({ ...p, annee: e.target.value }))} placeholder="2024-25" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('setlist_brand')}</label>
              <input value={form.marque} onChange={e => setForm(p => ({ ...p, marque: e.target.value }))} placeholder="Panini" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('gallery_collection_label')}</label>
              <input value={form.collection} onChange={e => setForm(p => ({ ...p, collection: e.target.value }))} placeholder="National Treasures" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_variation_label')}</label>
              <input value={form.variation} onChange={e => setForm(p => ({ ...p, variation: e.target.value }))} placeholder="Holo" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_num_label')}</label>
              <input value={form.num} onChange={e => setForm(p => ({ ...p, num: e.target.value }))} placeholder="/99" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_notes_label')}</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('wishlist_notes_placeholder')} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              {(['rc', 'auto', 'patch'] as const).map(k => (
                <button key={k} onClick={() => setForm(p => ({ ...p, [k]: !p[k] }))} style={{
                  padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                  background: form[k] ? (k === 'rc' ? '#e67e22' : k === 'auto' ? '#2e7d32' : '#1976d2') : '#f0f0f0',
                  color: form[k] ? 'white' : '#333',
                }}>{k}</button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={saving || !form.nom.trim()} style={{
            marginTop: 14, width: '100%', background: form.nom.trim() ? accent : '#ccc',
            color: 'white', border: 'none', borderRadius: 10, padding: '11px',
            fontWeight: 800, fontSize: 13, cursor: form.nom.trim() ? 'pointer' : 'default',
          }}>
            {saving ? t('wishlist_saving') : t('wishlist_submit')}
          </button>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12,
      }}>
        {items.map(item => (
          <WishCard
            key={item.id}
            item={item}
            accent={accent}
            isOwner={isOwner}
            onRemove={() => remove(item.id)}
          />
        ))}
      </div>
    </div>
  )
}
