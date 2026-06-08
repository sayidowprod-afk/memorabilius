'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Profil() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', lien_csv: '', couleur_bordure: '#003DA6', lien_logo: '' })
  const [csvLinked, setCsvLinked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setForm({
          display_name: p.display_name || '',
          lien_csv: p.lien_csv || '',
          couleur_bordure: p.couleur_bordure || '#003DA6',
          lien_logo: p.lien_logo || ''
        })
        setCsvLinked(!!p.lien_csv)
      }
      setLoading(false)
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name,
      lien_csv: form.lien_csv,
      couleur_bordure: form.couleur_bordure,
      lien_logo: form.lien_logo,
    }).eq('id', userId)

    if (!error) {
      setCsvLinked(!!form.lien_csv)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert('Erreur lors de la sauvegarde : ' + error.message)
    }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>Mon profil</h1>

      {csvLinked ? (
        <div style={{ background: '#eef2f7', borderLeft: '4px solid #2ecc71', padding: 15, borderRadius: 8, marginBottom: 24 }}>
          <strong style={{ color: '#2ecc71' }}>Statut :</strong> Collection synchronisée 🟢
          {userId && <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, marginLeft: 12 }}>Voir ma galerie →</Link>}
        </div>
      ) : (
        <div style={{ background: '#fff5f5', borderLeft: '4px solid #e74c3c', padding: 15, borderRadius: 8, marginBottom: 24 }}>
          <strong style={{ color: '#e74c3c' }}>Statut :</strong> Aucune collection liée 🔴
          <p style={{ margin: '5px 0 0', fontSize: 12, color: '#666' }}>Ajoutez votre lien CSV ci-dessous pour activer votre galerie.</p>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Pseudo</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Votre pseudo" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Lien CSV Google Sheets</label>
            <input value={form.lien_csv} onChange={e => setForm({ ...form, lien_csv: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Fichier &gt; Partager &gt; Publier sur le web &gt; CSV</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>URL de votre logo</label>
            <input value={form.lien_logo} onChange={e => setForm({ ...form, lien_logo: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Couleur des bordures</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={form.couleur_bordure} onChange={e => setForm({ ...form, couleur_bordure: e.target.value })} style={{ width: 50, height: 40, padding: 2, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#666' }}>{form.couleur_bordure}</span>
            </div>
          </div>
          <button type="submit" className="btn-main btn-primary" style={{ background: saved ? '#2ecc71' : undefined, borderColor: saved ? '#2ecc71' : undefined }}>
            {saved ? '✓ Sauvegardé !' : 'Sauvegarder'}
          </button>
        </form>
      </div>
    </div>
  )
}
