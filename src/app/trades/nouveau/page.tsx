'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NouveauTrade() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    type: 'offre' as 'offre' | 'recherche',
    titre: '',
    joueur: '',
    annee: '',
    marque: '',
    description: '',
    image_url: '',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
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
    if (error) { alert('Erreur : ' + error.message); setLoading(false); return }
    router.push('/trades')
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'Inter, sans-serif' }}>
      <Link href="/trades" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>← Retour aux trades</Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>Poster une annonce</h1>

      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>Type d'annonce</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['offre', 'recherche'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm({ ...form, type: t })} style={{
                  flex: 1, padding: '12px', border: `2px solid ${form.type === t ? '#003DA6' : '#eee'}`,
                  borderRadius: 10, background: form.type === t ? '#003DA6' : 'white',
                  color: form.type === t ? 'white' : '#333', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                }}>
                  {t === 'offre' ? '📤 Je propose' : '📥 Je recherche'}
                </button>
              ))}
            </div>
          </div>

          {/* Titre */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              Titre de l'annonce *
            </label>
            <input required value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
              placeholder={form.type === 'offre' ? 'Ex: LeBron James Prizm RC /99' : 'Ex: Recherche Giannis Auto /25'} />
          </div>

          {/* Joueur / Année / Marque */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Joueur</label>
              <input value={form.joueur} onChange={e => setForm({ ...form, joueur: e.target.value })} placeholder="LeBron James" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Année</label>
              <input value={form.annee} onChange={e => setForm({ ...form, annee: e.target.value })} placeholder="2023-24" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Marque</label>
              <input value={form.marque} onChange={e => setForm({ ...form, marque: e.target.value })} placeholder="Panini" />
            </div>
          </div>

          {/* URL image */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>URL de la photo</label>
            <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://i.imgur.com/..." />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Hébergez votre image sur ImgBB ou Imgur et collez le lien direct</p>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={form.type === 'offre' ? 'État de la carte, ce que vous recherchez en échange...' : 'Budget, état accepté, cartes proposées en échange...'}
              rows={4}
              style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-main btn-primary">
            {loading ? 'Publication...' : '📢 Publier l\'annonce'}
          </button>
        </form>
      </div>
    </div>
  )
}
