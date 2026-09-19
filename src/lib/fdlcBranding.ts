// Identité visuelle "Fédération de la Carte" (team id 3, voir table `teams`)
// pour le quiz en direct -- demande explicite : le quiz doit reprendre leur
// DA plutôt que celle de Memorabilius. Couleurs extraites par pixel-sampling
// du logo (avatar_url ci-dessous) : bleu marine + rouge dans le style
// classique "logo de ligue sportive" (NBA-like), texte blanc condensé.
// Hardcodé plutôt que résolu dynamiquement via `teams` : ce n'est pas un
// thème par session, c'est LE branding fixe de cette fonctionnalité pour
// cette communauté -- si le logo est remis à jour côté `teams`, mettre à
// jour FDLC_LOGO_URL ici (l'URL porte un `?t=` de cache-busting qui changera).
export const FDLC_LOGO_URL = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/teams/3/avatar.png'

export const FDLC_NAVY = '#0c1a3d'
export const FDLC_NAVY_DEEP = '#050c1f'
export const FDLC_BLUE = '#1d428a'
export const FDLC_RED = '#c8102e'
export const FDLC_WHITE = '#ffffff'

export const FDLC_CHOICE_COLORS = ['#c8102e', '#1d428a', '#e8b400', '#1e9e57']

export const FDLC_FONT = "'Archivo Black', 'Segoe UI', system-ui, sans-serif"
