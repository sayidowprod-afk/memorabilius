'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

interface WishItem {
  id: string; nom: string; annee: string; marque: string
  collection: string; variation: string; num: string
  rc: boolean; auto: boolean; patch: boolean; notes: string
}

const empty = { nom: '', annee: '', marque: '', collection: '', variation: '', num: '', rc: false, auto: false, patch: false, notes: '' }

export default function WishlistPage() {
  const [items, setItems] = useState<WishItem[]>([])
  const [form, setForm] = useState(empty)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()
  const { lang } = useLang()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      supabase.from('wishlist').select('*').eq('user_id', data.user.id).order('created_at', { ascending: false })
        .then(({ data: d }) => setItems(d || []))
    })
  }, [])

  const save = async () => {
    if (!userId || !form.nom.trim()) return
    setSaving(true)
    const { data } = await supabase.from('wishlist').insert({ ...form, user_id: userId }).select().single()
    if (data) setItems(prev => [data, ...prev])
    setForm(empty)
    setShowForm(false)
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('wishlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const tags = (item: WishItem) => [
    item.rc && { label: 'RC', bg: '#e67e22' },
    item.auto && { label: 'AUTO', bg: '#2e7d32' },
    item.patch && { label: 'PATCH', bg: '#1976d2' },
    item.num && { label: item.num, bg: '#7b1fa2' },
  ].filter(Boolean) as { label: string; bg: string }[]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>Ma Wishlist</h1>
          <p style={{ color: '#999', fontSize: 13, margin: '4px 0 0' }}>Cartes que vous recherchez</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{
          background: '#003DA6', color: 'white', border: 'none', borderRadius: 10,
          padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
        }}>
          {showForm ? '✕ Annuler' : '+ Ajouter une carte'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div style={{ background: 'white', borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #eee' }}>
          <h3 style={{ fontWeight: 800, margin: '0 0 16px', fontSize: 15 }}>Nouvelle carte recherchée</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Joueur *</label>
              <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Shai Gilgeous-Alexander" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Année</label>
              <input value={form.annee} onChange={e => setForm(p => ({ ...p, annee: e.target.value }))} placeholder="2024-25" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Marque</label>
              <input value={form.marque} onChange={e => setForm(p => ({ ...p, marque: e.target.value }))} placeholder="Panini" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Collection</label>
              <input value={form.collection} onChange={e => setForm(p => ({ ...p, collection: e.target.value }))} placeholder="National Treasures" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Variation</label>
              <input value={form.variation} onChange={e => setForm(p => ({ ...p, variation: e.target.value }))} placeholder="Holo" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Numérotation</label>
              <input value={form.num} onChange={e => setForm(p => ({ ...p, num: e.target.value }))} placeholder="/99" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Notes</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Budget max, état souhaité..." />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
            marginTop: 16, width: '100%', background: form.nom.trim() ? '#003DA6' : '#ccc',
            color: 'white', border: 'none', borderRadius: 10, padding: '12px',
            fontWeight: 800, fontSize: 14, cursor: form.nom.trim() ? 'pointer' : 'default',
          }}>
            {saving ? 'Enregistrement...' : 'Ajouter à ma wishlist'}
          </button>
        </div>
      )}

      {/* Liste */}
      {items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>Aucune carte dans votre wishlist</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Ajoutez les cartes que vous recherchez</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: 'white', borderRadius: 12, padding: '14px 18px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{item.nom}</div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>
                {[item.annee, item.marque, item.collection, item.variation].filter(Boolean).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {tags(item).map(t => (
                  <span key={t.label} style={{ fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 4, background: t.bg, color: 'white' }}>{t.label}</span>
                ))}
              </div>
              {item.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>"{item.notes}"</div>}
            </div>
            <button onClick={() => remove(item.id)} style={{
              background: 'none', border: '1px solid #eee', borderRadius: 8,
              padding: '6px 10px', cursor: 'pointer', color: '#e74c3c', fontSize: 13, flexShrink: 0,
            }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
