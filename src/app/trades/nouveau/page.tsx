'use client'
import { toast } from '@/lib/toast'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function NouveauTrade() {
  const { t } = useLang()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'offre' as 'offre' | 'recherche',
    titre: '',
    joueur: '',
    equipe: '',
    annee: '',
    marque: '',
    description: '',
    image_url: '',
    rc: false,
    auto: false,
    num: false,
    patch: false,
    sport: 'basket',
  })
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      setUserId(session.user.id)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    setLoading(true)
    const { error } = await supabase.from('trades').insert({
      ...form,
      user_id: userId,
    })
    if (error) { toast.error(t('trades_new_error_prefix') + error.message); setLoading(false); return }
    router.push('/trades')
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>
      <Link href="/trades" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>{t('trades_form_back')}</Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>{t('trades_new_title')}</h1>

      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', maxWidth: '100%', boxSizing: 'border-box' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 8 }}>{t('trades_form_type_label')}</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {(['offre', 'recherche'] as const).map(ty => (
                <button key={ty} type="button" onClick={() => setForm({ ...form, type: ty })} style={{
                  flex: 1, padding: '12px', border: `2px solid ${form.type === ty ? '#003DA6' : 'var(--border, #eee)'}`,
                  borderRadius: 10, background: form.type === ty ? '#003DA6' : 'var(--card-bg, #fff)',
                  color: form.type === ty ? 'white' : 'var(--text2, #333)', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}>
                  {ty === 'offre' ? t('trades_form_type_offer') : t('trades_form_type_search')}
                </button>
              ))}
            </div>
          </div>

          {/* Sport */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 8 }}>{t('trades_form_sport_label')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'basket', label: '🏀 Basket' },
                { key: 'foot', label: '⚽ Football' },
                { key: 'football_us', label: '🏈 Football US' },
                { key: 'baseball', label: '⚾ Baseball' },
                { key: 'hockey', label: '🏒 Hockey' },
                { key: 'pokemon', label: '🟡 Pokémon' },
                { key: 'tcg', label: '🃏 TCG' },
              ].map(s => (
                <button key={s.key} type="button" onClick={() => setForm({ ...form, sport: s.key })} title={s.label.split(' ').slice(1).join(' ')} style={{
                  padding: '8px 14px', border: `2px solid ${form.sport === s.key ? '#003DA6' : 'var(--border, #eee)'}`,
                  borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: form.sport === s.key ? '#003DA6' : 'var(--card-bg, #fff)',
                  color: form.sport === s.key ? 'white' : 'var(--text2, #333)',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>
              {t('trades_new_titre_label')}
            </label>
            <input required value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
              placeholder={form.type === 'offre' ? t('trades_new_titre_placeholder_offer') : t('trades_new_titre_placeholder_search')} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_joueur_label')}</label>
              <input value={form.joueur} onChange={e => setForm({ ...form, joueur: e.target.value })} placeholder={t('trades_form_joueur_placeholder')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_equipe_label')}</label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder={t('trades_new_equipe_placeholder')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_annee_label')}</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder={t('trades_form_annee_placeholder')} />
            </div>
          </div>

          {/* Tags RC / Auto / Num / Patch */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 8 }}>{t('trades_form_caracteristiques_label')}</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'rc', label: 'RC', bg: '#fff3e0', color: '#e67e22', activeBg: '#e67e22' },
                { key: 'auto', label: 'AUTO', bg: '#e8f5e9', color: '#2e7d32', activeBg: '#2e7d32' },
                { key: 'num', label: '# NUM', bg: '#f5f5f5', color: '#444', activeBg: '#444' },
                { key: 'patch', label: 'PATCH', bg: '#e3f2fd', color: '#1976d2', activeBg: '#1976d2' },
              ].map(tag => (
                <button key={tag.key} type="button" onClick={() => setForm({ ...form, [tag.key]: !(form as any)[tag.key] })} style={{
                  padding: '8px 16px', border: 'none', borderRadius: 20, cursor: 'pointer',
                  fontWeight: 900, fontSize: 13, transition: '0.2s',
                  background: (form as any)[tag.key] ? tag.activeBg : tag.bg,
                  color: (form as any)[tag.key] ? 'white' : tag.color,
                }}>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_marque_label')}</label>
            <input value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} placeholder={t('trades_form_marque_placeholder')} />
          </div>

          {/* URL image */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_image_label')}</label>
            <input value={form.image_url} autoComplete="off" inputMode="url"
              onChange={e => { setForm({ ...form, image_url: e.target.value }); setImageError(false) }}
              placeholder={t('trades_form_image_placeholder')} />
            <p style={{ fontSize: 11, color: 'var(--text3, #999)', marginTop: 4 }}>{t('trades_new_image_hint')}</p>
            {/* Aperçu immédiat : certains liens "de la page produit" (pas l'image directe)
                ou protégés contre le hotlinking ne s'affichent jamais une fois publiés —
                mieux vaut le voir tout de suite qu'après publication. */}
            {form.image_url && (
              imageError ? (
                <p style={{ fontSize: 12, color: '#e74c3c', marginTop: 8 }}>{t('trades_new_image_error')}</p>
              ) : (
                <img src={form.image_url} alt="" onError={() => setImageError(true)} onLoad={() => setImageError(false)}
                  style={{ marginTop: 8, maxWidth: 120, maxHeight: 168, borderRadius: 8, display: 'block', objectFit: 'contain', border: '1px solid var(--border, #eee)' }} />
              )
            )}
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_description_label')}</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={form.type === 'offre' ? t('trades_new_description_placeholder_offer') : t('trades_new_description_placeholder_search')}
              rows={4}
              style={{ padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-main btn-primary">
            {loading ? t('trades_new_publishing') : t('trades_new_publish_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}
