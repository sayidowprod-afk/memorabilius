'use client'
import { GALLERY_THEMES, teamBackground, type GalleryThemeId } from '@/lib/galleryThemes'
import { ballStyle } from '@/lib/ballThemes'

// Choix du thème de la galerie : aperçu en direct (le fond de la page change au clic), enregistrement avec « Enregistrer ».
export default function GalleryThemePicker({ value, teamColors, onPreview, onSave, onClose, saving }: {
  value: GalleryThemeId | null; teamColors?: [string, string] | null; onPreview: (t: GalleryThemeId | null) => void; onSave: () => void; onClose: () => void; saving: boolean
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Thème de la galerie" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000, background: 'rgba(5,8,25,.96)', borderTop: '2px solid #3a4a8a', padding: '14px 14px calc(14px + env(safe-area-inset-bottom))', color: '#fff' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b>🎨 Thème de ma galerie</b>
          <button type="button" onClick={onClose} aria-label="Fermer sans enregistrer" style={{ background: 'none', border: 'none', color: '#b9c3e8', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          <button type="button" onClick={() => onPreview(null)} style={{ height: 64, border: `3px solid ${value === null ? '#ffd84d' : '#3a4a8a'}`, background: '#0a0f24', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aucun</button>
          {GALLERY_THEMES.map(t => (
            <button key={t.id} type="button" onClick={() => onPreview(t.id)} className="gtheme-bg" data-gtheme={t.id} data-swatch="1"
              style={{ ...(t.id === 'equipe' && teamColors ? { background: teamBackground(teamColors) } : ballStyle(t.id)), position: 'relative', height: 64, border: `3px solid ${value === t.id ? '#ffd84d' : '#3a4a8a'}`, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', textShadow: '0 1px 4px #000', display: 'flex', alignItems: 'flex-end', padding: 6 }}>
              {t.label}{t.id === 'equipe' && !teamColors ? ' (choisis une équipe favorite dans ton profil)' : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button type="button" className="btn-main btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button type="button" className="da-confirm-btn" onClick={onClose}>Annuler</button>
        </div>
        <p style={{ fontSize: 12, color: '#9aa6bb', margin: '8px 0 0' }}>Les visiteurs de ta galerie verront ce fond. Tes cartes ne sont jamais modifiées.</p>
      </div>
    </div>
  )
}
