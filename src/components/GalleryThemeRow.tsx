'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { GALLERY_THEMES, isGalleryTheme, favoriteTeamColors, type GalleryThemeId } from '@/lib/galleryThemes'
import GalleryThemePicker from '@/components/GalleryThemePicker'

// Réglage « Thème de ma galerie » (page Paramètres) : même choix que le bouton 🎨 de la galerie, enregistré sur le profil.
export default function GalleryThemeRow({ row, rowLabel, rowSub }: { row: CSSProperties; rowLabel: CSSProperties; rowSub: CSSProperties }) {
  const [uid, setUid] = useState<string | null>(null)
  const [saved, setSaved] = useState<GalleryThemeId | null>(null)
  const [team, setTeam] = useState<[string, string] | null>(null)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<GalleryThemeId | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setUid(user.id)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (cancelled || !data) return
      const t: unknown = (data as { galerie_theme?: unknown }).galerie_theme
      setSaved(isGalleryTheme(t) ? t : null)
      setTeam(favoriteTeamColors((data as { favorite_teams?: string[] }).favorite_teams))
    })()
    return () => { cancelled = true }
  }, [])

  if (!uid) return null
  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ galerie_theme: pick }).eq('id', uid)
    setSaving(false)
    if (error) { toast.error('Enregistrement impossible (la migration du thème est-elle passée ?)'); return }
    setSaved(pick); setOpen(false); toast.success('Thème enregistré.')
  }
  const label = saved ? GALLERY_THEMES.find(t => t.id === saved)?.label : 'Aucun'
  return (
    <div style={{ ...row, alignItems: 'flex-start' }}>
      <div>
        <div style={rowLabel}>Thème de ma galerie</div>
        <div style={rowSub}>Le fond de ta galerie, vu aussi par tes visiteurs : bois, marbre, tapis, néon, ardoise, parquet, ou les couleurs de ton équipe favorite. Actuel : <b>{label}</b>.</div>
      </div>
      <button type="button" className="da-confirm-btn" onClick={() => { setPick(saved); setOpen(true) }}>🎨 Choisir</button>
      {open && <GalleryThemePicker value={pick} teamColors={team} onPreview={setPick} onSave={save} saving={saving} onClose={() => setOpen(false)} />}
    </div>
  )
}
