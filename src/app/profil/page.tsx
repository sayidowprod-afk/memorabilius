'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import TeamPicker from '@/components/TeamPicker'
import { subscribePush } from '@/components/PWAInstall'
import ShowcaseWidget from '@/components/ShowcaseWidget'

export default function Profil() {
  const router = useRouter()
  const { t, lang } = useLang()
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
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState('')
  const [wrapSending, setWrapSending] = useState(false)
  const [wrapResult, setWrapResult] = useState<{ ok?: boolean; error?: string; month?: string; newCards?: number } | null>(null)
  const [wrapImgLoading, setWrapImgLoading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      // Mettre à jour last_seen
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', data.user.id)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (p) {
        setForm({ display_name: p.display_name || '', bio: p.bio || '', lien_csv: p.lien_csv || '', couleur_bordure: p.couleur_bordure || '#003DA6', instagram: p.instagram || '', twitter: p.twitter || '', discord: p.discord || '' })
        setFavoriteTeams(Array.isArray(p.favorite_teams) ? p.favorite_teams : [])
        setWrapOptOut(!!p.wrap_opt_out)
        setCsvLinked(!!p.lien_csv)
        setAvatarUrl(p.avatar_url || null)
      }
      setLoading(false)
    })
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setPushSupported(true)
      setPushPermission(Notification.permission)
      // La permission navigateur ne peut pas être révoquée par JS et reste
      // 'granted' pour toujours : l'état réel à afficher est l'abonnement push.
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.register('/sw.js')
          .then(() => navigator.serviceWorker.ready)
          .then(sw => sw.pushManager.getSubscription())
          .then(sub => setPushSubscribed(!!sub))
          .catch(() => setPushSubscribed(false))
      }
    }
  }, [])

  const handleEnablePush = async () => {
    setPushLoading(true)
    setPushError('')
    try {
      // PWAInstall (qui enregistre normalement le SW) n'est pas monté sur cette
      // page — on s'assure ici que le service worker est bien enregistré avant
      // de tenter l'abonnement, sinon navigator.serviceWorker.ready ne résout jamais
      await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      setPushPermission(perm)
      if (perm === 'granted') {
        const ok = await subscribePush(true)
        setPushSubscribed(ok)
        if (!ok) setPushError("Échec de l'activation. Sur iPhone, assurez-vous d'avoir ajouté Memorabilius à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis réessayez.")
      }
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)
    setPushError('')
    try {
      await navigator.serviceWorker.register('/sw.js')
      const sw = await navigator.serviceWorker.ready
      const sub = await sw.pushManager.getSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
    } finally {
      setPushLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 2 * 1024 * 1024) { alert('Image trop lourde (max 2 Mo)'); return }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${userId}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { alert('Erreur upload : ' + upErr.message); setUploading(false); return }
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
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else { alert('Erreur : ' + error.message) }
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

  const handleDownloadWrapImage = async (format: 'square' | 'story', period: 'current' | 'last') => {
    const key = `${format}-${period}`
    setWrapImgLoading(key)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/wrap-image?format=${format}&period=${period}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      })
      if (!res.ok) { alert('Erreur génération image'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memorabilius-wrap-${format}-${period}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert('Erreur : ' + e.message)
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
      else { alert('Erreur lors de la suppression'); setDeleting(false) }
    } catch { alert('Erreur'); setDeleting(false) }
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 30 }}>{t('profile_title')}</h1>


      {/* Avatar */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 16 }}>{t('profile_photo')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <img src={avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }} alt="Avatar" />
            {uploading && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'white', fontSize: 11 }}>...</span></div>}
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
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
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
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>🔔 Notifications</h3>
        {!pushSupported ? (
          <p style={{ fontSize: 13, color: '#999' }}>
            Non disponible sur ce navigateur. Sur iPhone, ajoutez d'abord Memorabilius à l'écran d'accueil (Partager → Sur l'écran d'accueil).
          </p>
        ) : pushPermission === 'denied' ? (
          <p style={{ fontSize: 13, color: '#e74c3c' }}>
            Bloquées dans les réglages de votre navigateur. Autorisez les notifications pour ce site pour les recevoir.
          </p>
        ) : pushPermission === 'granted' && pushSubscribed ? (
          <div>
            <p style={{ fontSize: 13, color: '#2ecc71', fontWeight: 700, marginBottom: 12 }}>✓ Notifications activées</p>
            <button onClick={handleDisablePush} disabled={pushLoading} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {pushLoading ? '...' : 'Désactiver'}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              Recevez une alerte pour les messages, likes et cartes de votre wishlist trouvées.
            </p>
            {pushError && <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>{pushError}</p>}
            <button onClick={handleEnablePush} disabled={pushLoading} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {pushLoading ? '...' : 'Activer les notifications'}
            </button>
          </div>
        )}
      </div>

      {/* Test wrap mensuel */}
      <div id="wrap-telecharger" style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
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

      {/* Modifier le mot de passe */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
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
      <div style={{ background: 'white', borderRadius: 16, padding: 30, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #ffebee' }}>
        <h3 style={{ fontWeight: 800, color: '#e74c3c', marginBottom: 8 }}>{t('profile_danger')}</h3>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>{t('profile_delete_warning')}</p>
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} style={{ background: '#fff5f5', color: '#e74c3c', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {t('profile_delete')}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: '#e74c3c', fontWeight: 700 }}>Tapez <strong>SUPPRIMER</strong> pour confirmer :</p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="SUPPRIMER" style={{ border: '2px solid #e74c3c' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== 'SUPPRIMER' || deleting} style={{
                background: deleteConfirm === 'SUPPRIMER' ? '#e74c3c' : '#f0f0f0',
                color: deleteConfirm === 'SUPPRIMER' ? 'white' : '#999',
                border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13
              }}>
               {deleting ? 'Suppression...' : t('profile_delete_btn')}
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
