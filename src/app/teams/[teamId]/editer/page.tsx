'use client'
import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function EditerTeam({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const [form, setForm] = useState({ name: '', description: '', bio: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/connexion'); return }

      const { data: team } = await supabase.from('teams').select('*').eq('id', parseInt(teamId)).single()
      if (!team || team.created_by !== user.id) { router.push(`/teams/${teamId}`); return }

      setForm({ name: team.name || '', description: team.description || '', bio: team.bio || '' })
      setAvatarUrl(team.avatar_url || null)
      setLoading(false)
    }
    init()
  }, [teamId])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image trop lourde (max 2 Mo)'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `teams/${teamId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Erreur upload : ' + error.message); setUploading(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = data.publicUrl + '?t=' + Date.now()
    await supabase.from('teams').update({ avatar_url: url }).eq('id', parseInt(teamId))
    setAvatarUrl(url)
    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('teams').update({
      name: form.name,
      description: form.description,
      bio: form.bio,
    }).eq('id', parseInt(teamId))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'Inter, sans-serif' }}>
      <Link href={`/teams/${teamId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, display: 'inline-block', marginBottom: 20 }}>
        ← Retour à la team
      </Link>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>Modifier la team</h1>

      {/* Photo de team */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 16 }}>
          Photo de la team
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            {avatarUrl ? (
              <img src={avatarUrl} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #003DA6' }} alt="avatar team" />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#003DA6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'white' }}>
                {form.name.charAt(0).toUpperCase()}
              </div>
            )}
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: 11 }}>...</span>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="avatar-upload" style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-block' }}>
              {uploading ? 'Upload...' : '📷 Changer la photo'}
            </label>
            <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            <p style={{ fontSize: 11, color: '#999', margin: '6px 0 0' }}>JPG, PNG ou WEBP · Max 2 Mo</p>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              Nom de la team *
            </label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom de la team" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              Description courte
            </label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Les collectionneurs NBA de Paris" maxLength={100} />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Affichée dans l'annuaire des teams (max 100 caractères)</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>
              Bio de la team
            </label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              placeholder="Parlez de votre team, vos objectifs, vos passions..."
              rows={5}
              style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, fontFamily: 'Inter, sans-serif', width: '100%', resize: 'vertical', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <button type="submit" className="btn-main btn-primary" disabled={saving} style={{ background: saved ? '#2ecc71' : undefined, borderColor: saved ? '#2ecc71' : undefined }}>
            {saved ? '✓ Sauvegardé !' : saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </form>
      </div>
    </div>
  )
}
