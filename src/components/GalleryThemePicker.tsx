'use client'
import { GALLERY_THEMES, teamBackground, type GalleryThemeId } from '@/lib/galleryThemes'
import { ballStyle } from '@/lib/ballThemes'
import ModalShell from '@/components/ModalShell'

// Choix du thème de la galerie depuis Paramètres : choix + « Enregistrer » (la galerie n'est pas derrière, donc pas d'aperçu en direct ici).
export default function GalleryThemePicker({ value, teamColors, onPreview, onSave, onClose, saving }: {
  value: GalleryThemeId | null; teamColors?: [string, string] | null; onPreview: (t: GalleryThemeId | null) => void; onSave: () => void; onClose: () => void; saving: boolean
}) {
  return (
    <ModalShell title="🎨 Thème de ma galerie" onClose={onClose} variant="sheet" maxWidth={760}
      footer={<>
        <button type="button" className="btn-main btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="da-confirm-btn" onClick={onClose}>Annuler</button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        <button type="button" onClick={() => onPreview(null)} style={{ height: 64, border: `3px solid ${value === null ? '#ffd84d' : '#3a4a8a'}`, background: '#0a0f24', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aucun</button>
        {GALLERY_THEMES.map(t => (
          <button key={t.id} type="button" onClick={() => onPreview(t.id)} className="gtheme-bg" data-gtheme={t.id} data-swatch="1"
            style={{ ...(t.id === 'equipe' && teamColors ? { background: teamBackground(teamColors) } : ballStyle(t.id)), position: 'relative', height: 64, border: `3px solid ${value === t.id ? '#ffd84d' : '#3a4a8a'}`, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', textShadow: '0 1px 4px #000', display: 'flex', alignItems: 'flex-end', padding: 6, textAlign: 'left' }}>
            {t.label}{t.id === 'equipe' && !teamColors ? ' (choisis une équipe favorite dans ton profil)' : ''}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text2, #9aa6bb)', margin: '12px 0 0' }}>Les visiteurs de ta galerie verront ce fond. Tes cartes ne sont jamais modifiées.</p>
    </ModalShell>
  )
}
