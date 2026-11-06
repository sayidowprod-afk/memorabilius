// Thèmes de galerie : un fond dessiné en CSS (dégradés et motifs, aucune image à héberger). Les cartes ne sont jamais modifiées.
import { teamPalette } from '@/lib/teamColors'
import { getTeamById } from '@/lib/sportsTeams'
import { BALL_THEMES } from '@/lib/ballThemes'

export const GALLERY_THEMES = [
  { id: 'equipe', label: 'Mon équipe' },
  { id: 'bois', label: 'Vitrine en bois' },
  { id: 'marbre', label: 'Marbre noir' },
  { id: 'tapis', label: 'Tapis de salon' },
  { id: 'neon', label: 'Néon' },
  { id: 'ardoise', label: 'Ardoise' },
  { id: 'parquet', label: 'Parquet' },
  { id: 'pelouse', label: 'Pelouse de foot' },
  { id: 'baseball', label: 'Terrain de baseball' },
  { id: 'glace', label: 'Glace de hockey' },
  { id: 'terre', label: 'Terre battue' },
  { id: 'piste', label: 'Piste de course' },
  { id: 'tatami', label: 'Tapis de combat' },
  { id: 'etoiles', label: 'Ciel étoilé' },
  { id: 'aurore', label: 'Aurore boréale' },
  { id: 'coucher', label: 'Coucher de soleil' },
  { id: 'ocean', label: 'Grand large' },
  { id: 'beton', label: 'Playground béton' },
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'carbone', label: 'Fibre de carbone' },
  { id: 'cuir', label: 'Cuir et coutures' },
  { id: 'vestiaire', label: 'Vestiaire' },
  ...BALL_THEMES,
] as const

export type GalleryThemeId = (typeof GALLERY_THEMES)[number]['id']
export const isGalleryTheme = (v: unknown): v is GalleryThemeId => GALLERY_THEMES.some(t => t.id === v)

// Couleurs [principale, secondaire] de la première équipe favorite du profil (null si aucune / inconnue).
export function favoriteTeamColors(favoriteTeams: unknown): [string, string] | null {
  const first = Array.isArray(favoriteTeams) ? favoriteTeams[0] : null
  if (!first) return null
  const name = getTeamById(String(first))?.name
  const p = teamPalette(name ?? null)
  return p ? [p.primary, p.secondary] : null
}

// Fond « Mon équipe » : dégradé sombre teinté de la couleur principale, liseré lumineux de la secondaire.
export const teamBackground = ([a, b]: [string, string]) =>
  `radial-gradient(ellipse at 15% 0%, ${a}cc, transparent 55%), radial-gradient(ellipse at 100% 100%, ${b}33, transparent 50%), #07101f`

// Fonds clairs : la galerie y ajoute un voile sombre pour garder les textes lisibles (da.css « 275 »).
const LIGHT_THEME_IDS: string[] = ['balle-baseball', 'balle-tennis', 'balle-golf', 'balle-volley']
export const isLightTheme = (id: string | null | undefined) => !!id && LIGHT_THEME_IDS.includes(id)
