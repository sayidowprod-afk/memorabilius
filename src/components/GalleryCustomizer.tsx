'use client'
import { GALLERY_THEMES, teamBackground, type GalleryThemeId } from '@/lib/galleryThemes'
import { ballStyle } from '@/lib/ballThemes'
import TeamColorPicker from '@/components/TeamColorPicker'
import TeamPicker from '@/components/TeamPicker'
import ModalShell from '@/components/ModalShell'

// Personnalisation de la galerie (bouton 🎨) : fond, couleur et équipes favorites au même endroit, avec aperçu en direct sur la galerie derrière.
// Un seul « Enregistrer ». Les cartes ne sont jamais modifiées.
export default function GalleryCustomizer({ theme, onTheme, accent, onAccent, favs, onFavs, teamColors, onSave, onClose, saving }: {
  theme: GalleryThemeId | null; onTheme: (t: GalleryThemeId | null) => void
  accent: string; onAccent: (hex: string) => void
  favs: string[]; onFavs: (t: string[]) => void
  teamColors: [string, string] | null
  onSave: () => void; onClose: () => void; saving: boolean
}) {
  const head: React.CSSProperties = { fontWeight: 800, fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9fb0e6', margin: '16px 0 8px' }
  const hex = /^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#003DA6'
  return (
    <ModalShell title="🎨 Personnaliser ma galerie" onClose={onClose} variant="sheet" maxWidth={760} backdrop={false}
      footer={<>
        <button type="button" className="btn-main btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="da-confirm-btn" onClick={onClose}>Annuler</button>
      </>}>
        <div style={head}>1 · Fond</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          <button type="button" onClick={() => onTheme(null)} style={{ height: 60, border: `3px solid ${theme === null ? '#ffd84d' : '#3a4a8a'}`, background: '#0a0f24', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Aucun</button>
          {GALLERY_THEMES.map(t => (
            <button key={t.id} type="button" onClick={() => onTheme(t.id)} className="gtheme-bg" data-gtheme={t.id} data-swatch="1"
              style={{ ...(t.id === 'equipe' && teamColors ? { background: teamBackground(teamColors) } : ballStyle(t.id)), position: 'relative', height: 60, border: `3px solid ${theme === t.id ? '#ffd84d' : '#3a4a8a'}`, color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', textShadow: '0 1px 4px #000', display: 'flex', alignItems: 'flex-end', padding: 6, textAlign: 'left' }}>
              {t.label}{t.id === 'equipe' && !teamColors ? ' (choisis une équipe plus bas)' : ''}
            </button>
          ))}
        </div>

        <div style={head}>2 · Couleur de la galerie</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input type="color" value={hex} onChange={e => onAccent(e.target.value)} aria-label="Couleur libre" style={{ width: 50, height: 40, padding: 2, cursor: 'pointer' }} />
          <span style={{ fontSize: 13, color: '#b9c3e8' }}>{hex}</span>
        </div>
        <div style={{ marginTop: 8 }}><TeamColorPicker value={hex} onPick={onAccent} /></div>

        <div style={head}>3 · Équipes favorites (5 maximum)</div>
        <TeamPicker value={favs} onChange={onFavs} max={5} />
        <p style={{ fontSize: 12, color: '#9aa6bb', margin: '12px 0 0' }}>Tu vois chaque changement tout de suite sur ta galerie. Rien n’est enregistré tant que tu n’appuies pas sur « Enregistrer ». Les visiteurs verront ces choix.</p>
    </ModalShell>
  )
}
