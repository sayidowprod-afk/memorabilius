'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

const SPORTS = [
  { key: 'basket', label: '🏀 Basket' },
  { key: 'foot', label: '⚽ Football' },
  { key: 'football_us', label: '🏈 Football US' },
  { key: 'baseball', label: '⚾ Baseball' },
  { key: 'hockey', label: '🏒 Hockey' },
  { key: 'pokemon', label: '🟡 Pokémon' },
  { key: 'tcg', label: '🃏 TCG' },
]

export default function EditerTrade({ params }: { params: Promise<{ tradeId: string }> }) {
  const { tradeId } = use(params)
  const { t } = useLang()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'offre' as 'offre' | 'recherche',
    titre: '', joueur: '', equipe: '', annee: '', marque: '',
    description: '', image_url: '', sport: 'basket',
    rc: false, auto: false, num: false, patch: false,
  })
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data: trade } = await supabase.from('trades').select('*').eq('id', parseInt(tradeId)).single()
      if (!trade || trade.user_id !== user.id) { router.push('/trades'); return }

      setForm({
        type: trade.type,
        titre: trade.titre || '',
        joueur: trade.joueur || '',
        equipe: trade.equipe || '',
        annee: trade.annee || '',
        marque: trade.marque || '',
        description: trade.description || '',
        image_url: trade.image_url || '',
        sport: trade.sport || 'basket',
        rc: trade.rc || false,
        auto: trade.auto || false,
        num: trade.num || false,
        patch: trade.patch || false,
      })
      setLoading(false)
    }
    init()
  }, [tradeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('trades').update(form).eq('id', parseInt(tradeId))
    router.push('/trades')
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>{t('trades_form_loading')}</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>
      <Link href="/trades" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>{t('trades_form_back')}</Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>{t('trades_edit_title')}</h1>

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
              {SPORTS.map(s => (
                <button key={s.key} type="button" onClick={() => setForm({ ...form, sport: s.key })} title={s.label.split(' ').slice(1).join(' ')} style={{
                  padding: '8px 14px', border: `2px solid ${form.sport === s.key ? '#003DA6' : 'var(--border, #eee)'}`,
                  borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  background: form.sport === s.key ? '#003DA6' : 'var(--card-bg, #fff)',
                  color: form.sport === s.key ? 'white' : 'var(--text2, #333)',
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_edit_titre_label')}</label>
            <input required value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder={t('trades_edit_titre_placeholder')} />
          </div>

          {/* Joueur / Équipe / Année */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_joueur_label')}</label>
              <input value={form.joueur} onChange={e => setForm({ ...form, joueur: e.target.value })} placeholder={t('trades_form_joueur_placeholder')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_equipe_label')}</label>
              <input value={form.equipe} onChange={e => setForm({ ...form, equipe: e.target.value })} placeholder={t('trades_edit_equipe_placeholder')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_annee_label')}</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder={t('trades_form_annee_placeholder')} />
            </div>
          </div>

          {/* Tags */}
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
                  padding: '8px 16px', border: 'none', borderRadius: 20, cursor: 'pointer', fontWeight: 900, fontSize: 13,
                  background: (form as any)[tag.key] ? tag.activeBg : tag.bg,
                  color: (form as any)[tag.key] ? 'white' : tag.color,
                }}>{tag.label}</button>
              ))}
            </div>
          </div>

          {/* Marque */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_marque_label')}</label>
            <input value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} placeholder={t('trades_form_marque_placeholder')} />
          </div>

          {/* Image */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('trades_form_image_label')}</label>
            <input value={form.image_url} autoComplete="off" inputMode="url"
              onChange={e => { setForm({ ...form, image_url: e.target.value }); setImageError(false) }}
              placeholder={t('trades_form_image_placeholder')} />
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
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
              style={{ padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }} />
          </div>

          <button type="submit" disabled={saving} className="btn-main btn-primary">
            {saving ? t('trades_edit_saving') : t('trades_edit_save_btn')}
          </button>
        </form>
      </div>
    </div>
  )
}
