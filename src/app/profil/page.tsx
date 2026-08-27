'use client'
import { toast } from '@/lib/toast'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import TeamPicker from '@/components/TeamPicker'
import { levelFromXP } from '@/lib/leveling'
import { subscribePush } from '@/components/PWAInstall'
import ShowcaseWidget from '@/components/ShowcaseWidget'
import PushNotificationSettings from '@/components/PushNotificationSettings'

export default function Profil() {
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({ display_name: '', bio: '', lien_csv: '', couleur_bordure: '#003DA6', instagram: '', twitter: '', discord: '' })
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>([])
  const [wrapOptOut, setWrapOptOut] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [csvLinked, setCsvLinked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [avatarRingPct, setAvatarRingPct] = useState(0)
  const [linkedProviders, setLinkedProviders] = useState<string[]>([])
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [wrapSending, setWrapSending] = useState(false)
  const [wrapResult, setWrapResult] = useState<{ ok?: boolean; error?: string; month?: string; newCards?: number } | null>(null)
  const [wrapImgLoading, setWrapImgLoading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const initialSnapshotRef = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const uid = session.user.id
      setUserId(uid)
      // Mettre à jour last_seen
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
      const { data: p } = await supabase.from('profiles').select('id,display_name,bio,lien_csv,couleur_bordure,instagram,twitter,discord,favorite_teams,wrap_opt_out,avatar_url').eq('id', uid).single()
      if (p) {
        setForm({ display_name: p.display_name || '', bio: p.bio || '', lien_csv: p.lien_csv || '', couleur_bordure: p.couleur_bordure || '#003DA6', instagram: p.instagram || '', twitter: p.twitter || '', discord: p.discord || '' })
        setFavoriteTeams(Array.isArray(p.favorite_teams) ? p.favorite_teams : [])
        setWrapOptOut(!!p.wrap_opt_out)
        setCsvLinked(!!p.lien_csv)
        setAvatarUrl(p.avatar_url || null)
        initialSnapshotRef.current = JSON.stringify({
          display_name: p.display_name || '', bio: p.bio || '', lien_csv: p.lien_csv || '',
          couleur_bordure: p.couleur_bordure || '#003DA6', instagram: p.instagram || '', twitter: p.twitter || '', discord: p.discord || '',
          favoriteTeams: Array.isArray(p.favorite_teams) ? p.favorite_teams : [], wrapOptOut: !!p.wrap_opt_out,
        })
      }
      const { data: identData } = await supabase.auth.getUserIdentities()
      setLinkedProviders((identData?.identities ?? []).map(i => i.provider))
      setLoading(false)
      const { data: xp } = await supabase.rpc('get_user_xp_total', { p_user_id: uid })
      setAvatarRingPct(levelFromXP(xp ?? 0).pct)
    })
  }, [])

  // Avertit avant de fermer/recharger l'onglet si des changements n'ont pas
  // ete enregistres -- ne couvre pas la navigation interne (Next.js ne
  // declenche pas beforeunload sur un changement de route client-side).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (initialSnapshotRef.current === null) return
      const current = JSON.stringify({ ...form, favoriteTeams, wrapOptOut })
      if (current !== initialSnapshotRef.current) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form, favoriteTeams, wrapOptOut])

  // Redimensionne cote client avant upload -- une photo prise directement au
  // telephone (souvent 3000x4000+) etait jusqu'ici stockee et servie telle
  // quelle comme avatar 80x80 partout sur le site (nav, galerie, annuaire,
  // commentaires...), gaspillant de la bande passante et rendant plus visible
  // un flash de l'image a sa taille naturelle le temps qu'elle se charge et
  // se contraigne au CSS. 512px de cote suffit largement, meme pour la
  // version agrandie affichee dans la modale de profil.
  const resizeAvatar = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const MAX = 512
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.round(img.naturalWidth * scale)
      const h = Math.round(img.naturalHeight * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.87)
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = URL.createObjectURL(file)
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image trop lourde (max 2 Mo)'); return }
    setUploading(true)
    const resized = await resizeAvatar(file).catch(() => file)
    const ext = 'jpg'
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, resized, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) { toast.error('Erreur upload : ' + upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const publicUrl = urlData.publicUrl + '?t=' + Date.now()
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
    setAvatarUrl(publicUrl)
    setUploading(false)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const slug = form.display_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + userId.substring(0, 4)

    const { error } = await supabase.from('profiles').update({
      display_name: form.display_name,
      lien_csv: form.lien_csv,
      couleur_bordure: form.couleur_bordure,
      instagram: form.instagram,
      twitter: form.twitter,
      discord: form.discord,
      bio: form.bio,
      favorite_teams: favoriteTeams,
      wrap_opt_out: wrapOptOut,
      slug,
    }).eq('id', userId)
    if (!error) {
      setCsvLinked(!!form.lien_csv)
      if (form.lien_csv) {
        const { data: { session } } = await supabase.auth.getSession()
        fetch('/api/update-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ userId, csvUrl: form.lien_csv }),
        })
      }
      initialSnapshotRef.current = JSON.stringify({ ...form, favoriteTeams, wrapOptOut })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else { toast.error('Erreur : ' + error.message) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPasswordMsg({ ok: false, text: t('profile_password_mismatch') }); return }
    if (newPassword.length < 8) { setPasswordMsg({ ok: false, text: t('profile_password_tooshort') }); return }
    setChangingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setChangingPassword(false)
    if (error) { setPasswordMsg({ ok: false, text: error.message }); return }
    setPasswordMsg({ ok: true, text: t('profile_password_success') })
    setNewPassword(''); setConfirmPassword('')
    setTimeout(() => { setShowPasswordForm(false); setPasswordMsg(null) }, 2500)
  }

  const handleLinkProvider = async (provider: 'google' | 'twitter' | 'discord') => {
    setLinkingProvider(provider)
    const { error } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}/profil` },
    })
    if (error) {
      toast.error(error.message)
      setLinkingProvider(null)
    }
    // Si pas d'erreur : redirect OAuth en cours, pas besoin de reset
  }

  const handleDownloadWrapImage = async (format: 'square' | 'story', period: 'current' | 'last') => {
    const key = `${format}-${period}`
    setWrapImgLoading(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/wrap-image?format=${format}&period=${period}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) { toast.error(t('profile_err_export_image')); return }
      const blob = await res.blob()
      await saveOrShareFile(blob, `memorabilius-wrap-${format}-${period}.png`)
    } catch (e: any) {
      toast.error('Erreur : ' + e.message)
    } finally {
      setWrapImgLoading(null)
    }
  }

  const handleWrapPreview = async (period: 'current' | 'last') => {
    setWrapSending(true)
    setWrapResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/wrap-preview?period=${period}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      const json = await res.json()
      setWrapResult(json)
    } catch (e: any) {
      setWrapResult({ error: e.message })
    } finally {
      setWrapSending(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER' || !userId) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/delete-account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ userId }) })
      if (r.ok) { await supabase.auth.signOut(); window.location.href = '/' }
      else { toast.error(t('profile_err_delete')); setDeleting(false) }
    } catch { toast.error(t('profile_err_generic')); setDeleting(false) }
  }

  if (loading) return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      {[200, 120, 180].map((h, i) => (
        <div key={i} style={{ background: '#f0f0f0', borderRadius: 16, height: h, marginBottom: 16, animation: 'pulse 1.4s ease infinite alternate' }} />
      ))}
      <style>{`@keyframes pulse { from { opacity:1 } to { opacity:0.5 } }`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>{t('profile_title')}</h1>


      {/* Avatar */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 16 }}>{t('profile_photo')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            <svg width={88} height={88} viewBox="0 0 88 88" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              <circle cx={44} cy={44} r={41} fill="none" stroke={dark ? '#2a2a2a' : '#eee'} strokeWidth={3} />
              <circle cx={44} cy={44} r={41} fill="none" stroke="#003DA6" strokeWidth={3} strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 41}
                strokeDashoffset={2 * Math.PI * 41 * (1 - avatarRingPct)}
                style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,0.61,0.36,1)' }} />
            </svg>
            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ position: 'absolute', top: 4, left: 4, width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }} alt="Avatar" />
            {uploading && <div style={{ position: 'absolute', top: 4, left: 4, width: 80, height: 80, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontSize: 11 }}>...</span></div>}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'block', marginBottom: 6 }}>
              {uploading ? t('profile_uploading') : t('profile_change_photo')}
            </button>
            <p style={{ fontSize: 11, color: '#999', margin: 0 }}>JPG, PNG ou WEBP · Max 2 Mo</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
      </div>

      {/* Formulaire */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_pseudo')}</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Votre pseudo" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_bio_label')}</label>
            <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder={t('profile_bio_placeholder')} maxLength={200} rows={3} style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{form.bio.length}/200 {t('profile_bio_chars')}</p>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_csv_label')}</label>
            <input value={form.lien_csv} onChange={e => setForm({ ...form, lien_csv: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/..." />
            <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{t('profile_csv_hint')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Instagram</label>
              <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@pseudo" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Twitter / X</label>
              <input value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="@pseudo" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Discord</label>
              <input value={form.discord} onChange={e => setForm({ ...form, discord: e.target.value })} placeholder="pseudo#0000" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 8 }}>{t('profile_fav_teams')}</label>
            <TeamPicker value={favoriteTeams} onChange={setFavoriteTeams} max={5} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_border')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="color" value={form.couleur_bordure} onChange={e => setForm({ ...form, couleur_bordure: e.target.value })} style={{ width: 50, height: 40, padding: 2, cursor: 'pointer' }} />
              <span style={{ fontSize: 13, color: '#666' }}>{form.couleur_bordure}</span>
              {/* Aperçu en direct — meme traitement que le header de galerie (avatar
                  cerclé + bouton degrade) pour voir tout de suite le rendu reel. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
                <img
                  src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.display_name || 'U')}&background=003DA6&color=fff`}
                  alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${form.couleur_bordure}`, transition: 'border-color 0.15s' }}
                />
                <span style={{
                  fontSize: 11, fontWeight: 800, color: 'white', padding: '6px 12px', borderRadius: 8,
                  background: `linear-gradient(135deg, ${form.couleur_bordure}, color-mix(in srgb, ${form.couleur_bordure} 70%, black))`,
                  transition: 'background 0.15s',
                }}>+ Ajouter</span>
              </div>
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={!wrapOptOut} onChange={e => setWrapOptOut(!e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#555' }}>
                {t('profile_wrap_before')}<strong>{t('profile_wrap_name')}</strong>{t('profile_wrap_after')}
              </span>
            </label>
          </div>
          <button type="submit" className="btn-main btn-primary" style={{ background: saved ? '#2ecc71' : undefined, borderColor: saved ? '#2ecc71' : undefined }}>
            {saved ? t('profile_saved') : t('profile_save')}
          </button>
        </form>
      </div>

      {/* Bannière Showcase (embed) */}
      {userId && <ShowcaseWidget userId={userId} />}

      {/* Notifications push */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>🔔 Notifications</h3>
        <PushNotificationSettings dark={dark} />
      </div>

      {/* Test wrap mensuel */}
      <div id="wrap-telecharger" style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 6 }}>📊 Wrap mensuel — test</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
          Envoie un email de test du wrap mensuel à ton adresse pour vérifier le rendu et les données.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => handleWrapPreview('last')} disabled={wrapSending}
            style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: wrapSending ? 'not-allowed' : 'pointer', opacity: wrapSending ? 0.6 : 1 }}>
            {wrapSending ? '⏳ Envoi…' : '📨 Mois précédent'}
          </button>
          <button onClick={() => handleWrapPreview('current')} disabled={wrapSending}
            style={{ background: '#f0f4ff', color: '#003DA6', border: '2px solid #003DA6', borderRadius: 8, padding: '10px 18px', fontWeight: 700, fontSize: 13, cursor: wrapSending ? 'not-allowed' : 'pointer', opacity: wrapSending ? 0.6 : 1 }}>
            {wrapSending ? '⏳ Envoi…' : '📨 Mois en cours'}
          </button>
        </div>
        {wrapResult && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: wrapResult.ok ? '#eafaf1' : '#fff5f5', border: `1px solid ${wrapResult.ok ? '#a9dfbf' : '#f5c6c6'}` }}>
            {wrapResult.ok
              ? <p style={{ fontSize: 13, color: '#1e8449', fontWeight: 700 }}>✓ Email envoyé — {wrapResult.month} · {wrapResult.newCards} carte{(wrapResult.newCards ?? 0) > 1 ? 's' : ''} ajoutée{(wrapResult.newCards ?? 0) > 1 ? 's' : ''}</p>
              : <p style={{ fontSize: 13, color: '#c0392b', fontWeight: 700 }}>Erreur : {wrapResult.error}</p>
            }
          </div>
        )}

        <div style={{ marginTop: 20, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#aaa', marginBottom: 10 }}>
            📸 Image pour Instagram / Story
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['square', 'story'] as const).map(fmt => (
              ['last', 'current'].map(period => {
                const key = `${fmt}-${period}`
                const loading = wrapImgLoading === key
                return (
                  <button key={key}
                    onClick={() => handleDownloadWrapImage(fmt, period as 'current' | 'last')}
                    disabled={!!wrapImgLoading}
                    style={{ background: loading ? '#eee' : fmt === 'square' ? '#f0f4ff' : '#f5f0ff', color: fmt === 'square' ? '#003DA6' : '#7b1fa2', border: `2px solid ${fmt === 'square' ? '#003DA6' : '#7b1fa2'}`, borderRadius: 8, padding: '9px 14px', fontWeight: 700, fontSize: 12, cursor: wrapImgLoading ? 'not-allowed' : 'pointer', opacity: wrapImgLoading && !loading ? 0.5 : 1 }}>
                    {loading ? '⏳ Génération…' : `${fmt === 'square' ? '⬜ Carré' : '📱 Story'} — ${period === 'last' ? 'mois précédent' : 'mois en cours'}`}
                  </button>
                )
              })
            ))}
          </div>
        </div>
      </div>

      {/* Comptes liés */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 4 }}>🔗 Comptes liés</h3>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Liez un compte social pour pouvoir vous connecter avec celui-ci.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            {
              provider: 'google' as const, label: 'Google', bg: '#fff', color: '#3c3c3c', border: '#dadce0',
              logo: <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>,
            },
            {
              provider: 'twitter' as const, label: 'X / Twitter', bg: '#000', color: '#fff', border: '#000',
              logo: <svg width="16" height="16" viewBox="0 0 1200 1227" fill="white"><path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"/></svg>,
            },
            {
              provider: 'discord' as const, label: 'Discord', bg: '#5865F2', color: '#fff', border: '#5865F2',
              logo: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/></svg>,
            },
          ] as const).map(({ provider, label, bg, color, border, logo }) => {
            const linked = linkedProviders.includes(provider)
            const isLoading = linkingProvider === provider
            return (
              <div key={provider} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => !linked && handleLinkProvider(provider)}
                  disabled={linked || !!linkingProvider}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    background: linked ? (dark ? '#1a2e1a' : '#f0faf0') : bg,
                    color: linked ? '#2ecc71' : color,
                    border: `1.5px solid ${linked ? '#2ecc71' : border}`,
                    borderRadius: 10, padding: '11px 16px',
                    fontSize: 14, fontWeight: 600,
                    cursor: linked ? 'default' : linkingProvider ? 'wait' : 'pointer',
                    opacity: linkingProvider && !isLoading ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {isLoading
                    ? <span style={{ width: 18, height: 18, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : linked ? '✓' : logo
                  }
                  {isLoading ? 'Redirection…' : linked ? `${label} lié` : `Lier avec ${label}`}
                </button>
              </div>
            )
          })}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>

      {/* Modifier le mot de passe */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>{t('profile_password')}</h3>
        {!showPasswordForm ? (
          <button onClick={() => setShowPasswordForm(true)} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {t('profile_password_change')}
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_password_new')}</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('profile_password_min')} autoComplete="new-password" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('profile_password_confirm')}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('profile_password_repeat')} autoComplete="new-password" />
            </div>
            {passwordMsg && (
              <p style={{ fontSize: 13, color: passwordMsg.ok ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>{passwordMsg.text}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={changingPassword} style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {changingPassword ? t('profile_password_saving') : t('profile_password_save')}
              </button>
              <button type="button" onClick={() => { setShowPasswordForm(false); setNewPassword(''); setConfirmPassword(''); setPasswordMsg(null) }} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {t('profile_cancel')}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Statut synchronisation collection */}
      {csvLinked ? (
        <div style={{ background: '#eef2f7', borderLeft: '4px solid #2ecc71', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <strong style={{ color: '#2ecc71' }}>{t('profile_status_label')}</strong> {t('profile_status_synced')}
          {userId && <Link href={`/galerie/${userId}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13, marginLeft: 12 }}>{t('profile_view_gallery')}</Link>}
        </div>
      ) : (
        <div style={{ background: '#fff5f5', borderLeft: '4px solid #e74c3c', padding: 15, borderRadius: 8, marginBottom: 20 }}>
          <strong style={{ color: '#e74c3c' }}>{t('profile_status_label')}</strong> {t('profile_status_none')}
          <p style={{ margin: '5px 0 0', fontSize: 12, color: '#666' }}>{t('profile_status_hint')}</p>
        </div>
      )}

      {/* Zone danger */}
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #ffebee' }}>
        <h3 style={{ fontWeight: 800, color: '#e74c3c', marginBottom: 8 }}>{t('profile_danger')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>{t('profile_delete_warning')}</p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{ background: '#fff5f5', color: '#e74c3c', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {t('profile_delete')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#e74c3c', fontWeight: 700 }}>{t('profile_delete_confirm')} <strong>{t('profile_delete_word')}</strong></p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder={t('profile_delete_word')} style={{ border: '2px solid #e74c3c' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== t('profile_delete_word') || deleting} style={{
                background: deleteConfirm === t('profile_delete_word') ? '#e74c3c' : '#f0f0f0',
                color: deleteConfirm === t('profile_delete_word') ? 'white' : '#999',
                border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13
              }}>
               {deleting ? t('profile_deleting') : t('profile_delete_btn')}
              </button>
              <button onClick={() => { setShowDelete(false); setDeleteConfirm('') }} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
