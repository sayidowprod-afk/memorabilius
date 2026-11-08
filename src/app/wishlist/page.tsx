'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import CardTagBadges from '@/components/CardTagBadges'
import { toast } from '@/lib/toast'
import { parsePrice } from '@/lib/marketplace'

interface WishItem {
  id: string; nom: string; equipe?: string | null; annee: string; marque: string
  collection: string; variation: string; num: string
  rc: boolean; auto: boolean; patch: boolean; notes: string; prix_cible?: number | null
}

const empty = { nom: '', equipe: '', annee: '', marque: '', collection: '', variation: '', num: '', rc: false, auto: false, patch: false, notes: '', prix_cible: '' }

export default function WishlistPage() {
  const [items, setItems] = useState<WishItem[]>([])
  const [form, setForm] = useState(empty)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  // Partage par lien (lecture seule, sans connexion) : le jeton est géré par /api/wishlist-share
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'busy' | 'migration' | 'copied'>('idle')
  const shareUrl = shareToken && typeof window !== 'undefined' ? `${window.location.origin}/wishlist/partage/${shareToken}` : ''
  const shareCall = async (method: 'GET' | 'POST', action?: 'enable' | 'regenerate' | 'disable') => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    setShareState('busy')
    try {
      const res = await fetch('/api/wishlist-share', {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: method === 'POST' ? JSON.stringify({ action }) : undefined,
      })
      if (res.status === 409) { setShareState('migration'); return }
      const d = await res.json().catch(() => ({}))
      setShareToken(d.token ?? null)
      setShareState('idle')
    } catch { setShareState('idle') }
  }
  useEffect(() => { if (userId) { const tm = window.setTimeout(() => { shareCall('GET') }, 0); return () => window.clearTimeout(tm) } }, [userId])
  // Mode salon : liste en grosses lignes à cocher « trouvée » ; cases et liste gardées sur l'appareil (marche sans réseau une fois chargée)
  const [salon, setSalon] = useState(false)
  const [found, setFound] = useState<Set<string>>(new Set())
  useEffect(() => {
    const tm = window.setTimeout(() => {
      try {
        // ?salon=1 ouvre le mode salon, ?salon=0 le quitte (bouton « Partager ») ; sans paramètre, on garde le dernier choix
        const p = new URLSearchParams(window.location.search).get('salon')
        if (p === '1' || p === '0') localStorage.setItem('mb_wish_salon', p)
        setSalon(localStorage.getItem('mb_wish_salon') === '1')
        const f = JSON.parse(localStorage.getItem('mb_wish_found') || '[]')
        if (Array.isArray(f)) setFound(new Set(f.map(String)))
      } catch { /* stockage indisponible */ }
    }, 0)
    return () => window.clearTimeout(tm)
  }, [])
  const toggleSalon = (v: boolean) => { setSalon(v); try { localStorage.setItem('mb_wish_salon', v ? '1' : '0') } catch { /* rien */ } }
  const saveFound = (n: Set<string>) => { try { localStorage.setItem('mb_wish_found', JSON.stringify([...n])) } catch { /* rien */ } }
  const toggleFound = (id: string) => setFound(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); saveFound(n); return n })
  const clearFound = () => { const n = new Set<string>(); setFound(n); saveFound(n) }
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setShareState('copied'); window.setTimeout(() => setShareState('idle'), 2000) } catch { /* presse-papiers indisponible */ }
  }

  useEffect(() => {
    // try/finally + withTimeout : ni un rejet ni une requete qui ne resout
    // jamais (cold start reseau...) ne doivent laisser la page bloquee sur
    // son skeleton pour toujours -- voir withTimeout.ts.
    (async () => {
      try {
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 8000, { data: { session: null } } as any)
        if (!session) { router.replace('/connexion'); return }
        setUserId(session.user.id)
        const { data: d } = await withTimeout(
          supabase.from('wishlist').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
          8000, { data: null } as any
        )
        if (d) {
          // prix cibles : table privée (lisible par toi seul) ; erreur ignorée si la migration n'est pas appliquée
          let withTargets = d as WishItem[]
          try {
            const { data: pc } = await supabase.from('wishlist_prix_cible').select('wishlist_id, prix').eq('user_id', session.user.id)
            const byId = new Map((pc || []).map((x: { wishlist_id: string; prix: number }) => [x.wishlist_id, Number(x.prix)]))
            withTargets = withTargets.map(w => (byId.has(w.id) ? { ...w, prix_cible: byId.get(w.id)! } : w))
          } catch { /* rien */ }
          setItems(withTargets)
          try { localStorage.setItem('mb_wish_cache', JSON.stringify(withTargets)) } catch { /* rien */ }
        } else {
          try { const c = JSON.parse(localStorage.getItem('mb_wish_cache') || 'null'); if (Array.isArray(c)) setItems(c) } catch { /* rien */ }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    if (!userId || !form.nom.trim()) return
    setSaving(true)
    const { prix_cible, equipe, ...rest } = form
    const target = parsePrice(prix_cible)
    // l'équipe n'est envoyée que si elle est remplie ; si la colonne n'existe pas encore (mise à jour de la base à appliquer),
    // on enregistre la carte sans l'équipe et on le dit
    let first = await supabase.from('wishlist').insert({ ...rest, ...(equipe.trim() ? { equipe: equipe.trim() } : {}), user_id: userId }).select().single()
    if (first.error && equipe.trim()) {
      toast.error('Carte ajoutée sans l’équipe (mise à jour de la base à appliquer).')
      first = await supabase.from('wishlist').insert({ ...rest, user_id: userId }).select().single()
    }
    const data = first.data as WishItem | null
    let saved: WishItem | null = data
    // le prix cible est rangé à part, dans une table que toi seul peux lire
    if (data && target !== null) {
      const { error: e2 } = await supabase.from('wishlist_prix_cible').insert({ wishlist_id: data.id, user_id: userId, prix: target })
      if (e2) toast.error('Carte ajoutée, mais le prix cible n’a pas pu être enregistré (mise à jour de la base à appliquer).')
      else saved = { ...data, prix_cible: target }
    }
    if (saved) setItems(prev => [saved as WishItem, ...prev])
    setForm(empty)
    setShowForm(false)
    setSaving(false)
  }

  const remove = async (id: string) => {
    await supabase.from('wishlist_prix_cible').delete().eq('wishlist_id', id) // prix cible rangé à part (erreur ignorée si la table n'existe pas encore)
    await supabase.from('wishlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    setRemovingId(null)
  }

  const tags = (item: WishItem) => [
    item.rc && { label: 'RC', bg: '#F97316' },
    item.auto && { label: 'AUTO', bg: '#3B82F6' },
    item.patch && { label: 'PATCH', bg: '#EF4444' },
    item.num && { label: item.num, bg: '#A855F7' },
  ].filter(Boolean) as { label: string; bg: string }[]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 16px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('wishlist_title')}</h1>
          <p style={{ color: '#999', fontSize: 13, margin: '4px 0 0' }}>{t('wishlist_sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => toggleSalon(!salon)} className={'da-salon-btn' + (salon ? ' on' : '')} aria-pressed={salon}>
          {salon ? '✕ Quitter le mode salon' : '🎪 Mode salon'}
        </button>
        {!salon && <button onClick={() => setShowForm(!showForm)} style={{
          background: '#003DA6', color: 'white', border: 'none', borderRadius: 10,
          padding: '10px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer',
        }}>
          {showForm ? t('wishlist_cancel_add') : t('wishlist_add')}
        </button>}
        </div>
      </div>

      {/* Partage par lien */}
      {!salon && userId && shareState !== 'migration' && (
        <div className="da-share" style={{ marginBottom: 20 }}>
          {!shareToken ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <b>Partager ma wishlist</b>
                <div className="da-share-sub">Un lien en lecture seule, sans connexion : pratique pour que tes amis sachent quoi t’offrir ou t’échanger. Tu peux l’arrêter à tout moment.</div>
              </div>
              <button type="button" className="da-confirm-btn primary" disabled={shareState === 'busy'} onClick={() => shareCall('POST', 'enable')}>Créer un lien</button>
            </div>
          ) : (
            <div>
              <b>Ta wishlist est partagée</b>
              <div className="da-share-link">
                <input readOnly value={shareUrl} aria-label="Lien de partage" onFocus={e => e.currentTarget.select()} />
                <button type="button" className="da-confirm-btn primary" onClick={copyShare}>{shareState === 'copied' ? 'Copié ✓' : 'Copier'}</button>
              </div>
              <div className="da-share-actions">
                <button type="button" onClick={() => shareCall('POST', 'regenerate')} disabled={shareState === 'busy'}>Nouveau lien (l’ancien ne marche plus)</button>
                <button type="button" onClick={() => shareCall('POST', 'disable')} disabled={shareState === 'busy'}>Arrêter le partage</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Formulaire */}
      {!salon && showForm && (
        <form onSubmit={e => { e.preventDefault(); save() }} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
          <h3 style={{ fontWeight: 800, margin: '0 0 16px', fontSize: 15 }}>{t('wishlist_new_wanted')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('setlist_player')}</label>
              <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Shai Gilgeous-Alexander" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Équipe, facultatif</label>
              <input value={form.equipe} onChange={e => setForm(p => ({ ...p, equipe: e.target.value }))} placeholder="Ex: Philadelphia 76ers" />
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Pour ne chercher que les cartes du joueur dans cette équipe (ex : Iguodala chez les 76ers).</div>
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
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prix cible (€), facultatif</label>
              <input inputMode="decimal" value={form.prix_cible} onChange={e => setForm(p => ({ ...p, prix_cible: e.target.value }))} placeholder="Ex : 60" />
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Tu es prévenu quand un membre met cette carte en vente à ce prix ou moins.</div>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: '#888', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('wishlist_notes_label')}</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={t('wishlist_notes_placeholder')} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['rc', 'auto', 'patch'] as const).map(k => (
                <button type="button" key={k} onClick={() => setForm(p => ({ ...p, [k]: !p[k] }))} style={{
                  padding: '6px 14px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
                  background: form[k] ? (k === 'rc' ? '#F97316' : k === 'auto' ? '#3B82F6' : '#EF4444') : '#f0f0f0',
                  color: form[k] ? 'white' : '#333',
                }}>{k}</button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving || !form.nom.trim()} style={{
            marginTop: 16, width: '100%', background: form.nom.trim() ? '#003DA6' : '#ccc',
            color: 'white', border: 'none', borderRadius: 10, padding: '12px',
            fontWeight: 800, fontSize: 14, cursor: form.nom.trim() ? 'pointer' : 'default',
          }}>
            {saving ? t('wishlist_saving') : t('wishlist_submit')}
          </button>
        </form>
      )}

      {/* Liste */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: dark ? '#2a2a2a' : '#f0f0f0', borderRadius: 12, height: 72, animation: 'wl-pulse 1.4s ease infinite alternate' }} />
          ))}
          <style>{`@keyframes wl-pulse { from { opacity: 1 } to { opacity: 0.5 } }`}</style>
        </div>
      )}
      {!loading && items.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <p style={{ fontWeight: 700, fontSize: 16 }}>{t('wishlist_empty_title')}</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{t('wishlist_empty_sub')}</p>
        </div>
      )}

      {salon && (
        <div className="da-salon">
          <div className="da-salon-top">
            <b>{found.size} / {items.length} trouvée{found.size > 1 ? 's' : ''}</b>
            {found.size > 0 && <button type="button" onClick={clearFound}>Tout décocher</button>}
          </div>
          {items.map(item => {
            const on = found.has(String(item.id))
            const detail = [item.equipe, item.annee, item.marque, item.collection, item.variation, item.num, item.rc && 'RC', item.auto && 'Auto', item.patch && 'Patch'].filter(Boolean).join(' · ')
            return (
              <button key={item.id} type="button" className={'da-salon-row' + (on ? ' on' : '')} aria-pressed={on} onClick={() => toggleFound(String(item.id))}>
                <span className="da-salon-box" aria-hidden="true">{on ? '✓' : ''}</span>
                <span className="da-salon-txt"><b>{item.nom}</b>{detail && <small>{detail}</small>}{item.notes && <small>« {item.notes} »</small>}</span>
              </button>
            )
          })}
          <p className="da-salon-note">Tes cases « trouvée » sont gardées sur ce téléphone. La liste reste disponible sans réseau une fois chargée.</p>
        </div>
      )}

      <div style={{ display: salon ? 'none' : 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: dark ? '#1e1e1e' : 'white', borderRadius: 12, padding: '14px 18px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{item.nom}{item.equipe && <span style={{ fontWeight: 700, fontSize: 12, color: '#003DA6', marginLeft: 8 }}>· {item.equipe}</span>}</div>
              <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>
                {[item.annee, item.marque, item.collection, item.variation].filter(Boolean).join(' · ')}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <CardTagBadges rc={!!item.rc} auto={!!item.auto} patch={!!item.patch} num={item.num} size="md" />
              </div>
              {item.prix_cible != null && <div style={{ fontSize: 12, fontWeight: 800, color: '#1f9d55', marginTop: 6 }}>🎯 Prix cible : {Number(item.prix_cible).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}</div>}
              {item.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' }}>"{item.notes}"</div>}
            </div>
            {removingId === item.id ? (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => remove(item.id)} aria-label="Confirmer la suppression" style={{ background: '#e74c3c', color: 'white', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Oui</button>
                <button onClick={() => setRemovingId(null)} aria-label="Annuler" style={{ background: 'none', border: '1px solid #eee', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>Non</button>
              </div>
            ) : (
              <button onClick={() => setRemovingId(item.id)} aria-label={`Retirer ${item.nom} de la wishlist`} style={{
                background: 'none', border: '1px solid #eee', borderRadius: 8,
                padding: '6px 10px', cursor: 'pointer', color: '#e74c3c', fontSize: 13, flexShrink: 0,
              }}>✕</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
