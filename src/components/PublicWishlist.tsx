'use client'
import { useTheme } from '@/lib/ThemeContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useLang } from '@/lib/LangContext'
import EmptyState from '@/components/EmptyState'
import { toast } from '@/lib/toast'
import SuggestInput from '@/components/SuggestInput'
import { suggestPlayers, suggestTeams } from '@/lib/wishSuggest'
import CardTagBadges from '@/components/CardTagBadges'
import { parsePrice } from '@/lib/marketplace'

interface WishItem {
  id: string; nom: string; equipe?: string | null; annee: string; marque: string
  collection: string; variation: string; num: string
  rc: boolean; auto: boolean; patch: boolean; notes: string; prix_cible?: number | null
}

interface Collector { id: string; display_name: string; slug: string | null; cardImg?: string; accent?: string }

const empty = { nom: '', equipe: '', prix_cible: '', annee: '', marque: '', collection: '', variation: '', num: '', rc: false, auto: false, patch: false, notes: '' }

function WishCard({ item, accent, isOwner, onRemove }: {
  item: WishItem; accent: string; isOwner?: boolean; onRemove: () => void
}) {
  const [collectors, setCollectors] = useState<Collector[] | null>(null)
  const [cardImg, setCardImg] = useState<string | null>(null)
  const { t } = useLang()
  const { dark } = useTheme()

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
    item.rc && { label: 'RC', bg: '#F97316' },
    item.auto && { label: 'AUTO', bg: '#3B82F6' },
    item.patch && { label: 'PATCH', bg: '#EF4444' },
    item.num && { label: item.num, bg: '#A855F7' },
  ].filter(Boolean) as { label: string; bg: string }[]

  const isSupabase = cardImg?.includes('supabase.co')

  return (
    <div className={`wanted-poster${dark ? ' dk' : ''}`}>
      <div className="wp-head da-display">Recherché</div>
      {/* Card image area */}
      <div className="wp-pic">
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
          <span className="wp-q da-display">?</span>
        )}
        {/* Owner delete button overlay */}
        {isOwner && (
          <button
            onClick={onRemove}
            style={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: 0,
              width: 24, height: 24, cursor: 'pointer', color: 'white',
              fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >✕</button>
        )}
      </div>

      {/* Info area */}
      <div className="wp-info">
        <div className="wp-name da-display">{item.nom}</div>
        <div className="wp-meta" style={{ fontSize: 11, lineHeight: 1.3 }}>
          {[item.equipe, item.annee, item.marque, item.collection].filter(Boolean).join(' · ')}
        </div>

        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
            <CardTagBadges rc={!!item.rc} auto={!!item.auto} patch={!!item.patch} num={item.num} size="md" />
          </div>
        )}

        {isOwner && item.prix_cible != null && (
          <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>🎯 Prix cible : {Number(item.prix_cible).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}</div>
        )}

        {item.notes && (
          <div className="wp-note" style={{ fontSize: 10, fontStyle: 'italic', lineHeight: 1.3 }}>
            &ldquo;{item.notes}&rdquo;
          </div>
        )}

        {/* Possédée par */}
        {collectors && collectors.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: 6 }}>
            <div className="wp-lab" style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
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
      .then(async ({ data }) => {
        const list = (data || []) as WishItem[]
        // prix cibles : table privée (propriétaire seul) ; erreur ignorée si la migration n'est pas appliquée
        if (isOwner && list.length) {
          try {
            const { data: pc } = await supabase.from('wishlist_prix_cible').select('wishlist_id, prix').eq('user_id', userId)
            const byId = new Map((pc || []).map((x: { wishlist_id: string; prix: number }) => [x.wishlist_id, Number(x.prix)]))
            setItems(list.map(w => (byId.has(w.id) ? { ...w, prix_cible: byId.get(w.id)! } : w)))
            return
          } catch { /* rien */ }
        }
        setItems(list)
      })
  }, [userId, isOwner])

  const save = async () => {
    if (!form.nom.trim()) return
    setSaving(true)
    const { prix_cible, equipe, ...rest } = form
    const target = parsePrice(prix_cible)
    // l'équipe n'est envoyée que si elle est remplie ; colonne absente (base pas à jour) : carte ajoutée sans l'équipe, et on le dit
    let first = await supabase.from('wishlist').insert({ ...rest, ...(equipe.trim() ? { equipe: equipe.trim() } : {}), user_id: userId }).select().single()
    if (first.error && equipe.trim()) {
      toast.error('Carte ajoutée sans l’équipe (mise à jour de la base à appliquer).')
      first = await supabase.from('wishlist').insert({ ...rest, user_id: userId }).select().single()
    }
    const data = first.data as WishItem | null
    if (data) {
      let saved: WishItem = data
      // le prix cible est rangé à part, dans une table que toi seul peux lire
      if (target !== null) {
        const { error: e2 } = await supabase.from('wishlist_prix_cible').insert({ wishlist_id: data.id, user_id: userId, prix: target })
        if (e2) toast.error('Carte ajoutée, mais le prix cible n’a pas pu être enregistré (mise à jour de la base à appliquer).')
        else saved = { ...data, prix_cible: target }
      }
      setItems(prev => [saved, ...prev])
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
    await supabase.from('wishlist_prix_cible').delete().eq('wishlist_id', id) // prix cible rangé à part (erreur ignorée si la table n'existe pas encore)
    const { error } = await supabase.from('wishlist').delete().eq('id', id)
    if (error) { toast.error(t('wishlist_remove_error')); return }
    setItems(prev => prev.filter(i => i.id !== id))
  }

  if (items.length === 0 && !isOwner) return <EmptyState icon="🎯" title={t('wishlist_none')} compact />

  return (
    <div style={{ paddingBottom: 20 }}>
      {isOwner && (
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <a href="/wishlist?salon=1" style={{ border: '2px solid var(--border, #ccc)', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13, textDecoration: 'none', color: 'inherit' }}>📱 Mode salon</a>
          <a href="/wishlist?salon=0" style={{ border: '2px solid var(--border, #ccc)', borderRadius: 10, padding: '8px 14px', fontWeight: 800, fontSize: 13, textDecoration: 'none', color: 'inherit' }}>🔗 Partager ma wishlist</a>
          <button onClick={() => setShowForm(!showForm)} style={{
            background: showForm ? 'var(--bg3, #eee)' : accent, color: showForm ? 'var(--text2, #333)' : 'white',
            border: 'none', borderRadius: 10, padding: '10px 20px',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>
            {showForm ? t('wishlist_cancel_add') : t('wishlist_add')}
          </button>
        </div>
      )}

      {showForm && isOwner && (
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 14, padding: 20, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid var(--border, #eee)' }}>
          <h3 style={{ fontWeight: 800, margin: '0 0 14px', fontSize: 14 }}>{t('wishlist_new_wanted')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('setlist_player')}</label>
              <SuggestInput value={form.nom} onChange={v => setForm(p => ({ ...p, nom: v }))} getSuggestions={suggestPlayers} placeholder="Ex: Shai Gilgeous-Alexander" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Équipe, facultatif</label>
              <SuggestInput value={form.equipe} onChange={v => setForm(p => ({ ...p, equipe: v }))} getSuggestions={suggestTeams} minChars={1} placeholder="Ex: Philadelphia 76ers" />
              <div style={{ fontSize: 11, color: 'var(--text3, #888)', marginTop: 4 }}>Pour ne chercher que les cartes du joueur dans cette équipe.</div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('gallery_year_label')}</label>
              <input value={form.annee} onChange={e => setForm(p => ({ ...p, annee: e.target.value }))} placeholder="2024-25" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('setlist_brand')}</label>
              <input value={form.marque} onChange={e => setForm(p => ({ ...p, marque: e.target.value }))} placeholder="Panini" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('gallery_collection_label')}</label>
              <input value={form.collection} onChange={e => setForm(p => ({ ...p, collection: e.target.value }))} placeholder="National Treasures" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_variation_label')}</label>
              <input value={form.variation} onChange={e => setForm(p => ({ ...p, variation: e.target.value }))} placeholder="Holo" />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_num_label')}</label>
              <input value={form.num} onChange={e => setForm(p => ({ ...p, num: e.target.value }))} placeholder="/99" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prix cible (€), facultatif</label>
              <input inputMode="decimal" value={form.prix_cible} onChange={e => setForm(p => ({ ...p, prix_cible: e.target.value }))} placeholder="Ex : 60" />
              <div style={{ fontSize: 11, color: 'var(--text3, #888)', marginTop: 4 }}>Tu es prévenu quand un membre met cette carte en vente à ce prix ou moins. Toi seul le vois.</div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #888)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_notes_label')}</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('wishlist_notes_placeholder')} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['rc', 'auto', 'patch'] as const).map(k => (
                <button key={k} onClick={() => setForm(p => ({ ...p, [k]: !p[k] }))} style={{
                  padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                  background: form[k] ? (k === 'rc' ? '#F97316' : k === 'auto' ? '#3B82F6' : '#EF4444') : 'var(--bg3, #f0f0f0)',
                  color: form[k] ? 'white' : 'var(--text2, #333)',
                }}>{k}</button>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={saving || !form.nom.trim()} style={{
            marginTop: 14, width: '100%', background: form.nom.trim() ? accent : 'var(--border, #ccc)',
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
