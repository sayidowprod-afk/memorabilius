// Hauteur "contenu" de la bottom bar native (icône + label + padding interne),
// sans la zone de sécurité système — celle-ci s'ajoute par-dessus, jamais en
// remplacement, pour ne jamais écraser le contenu.
export const NAV_CONTENT_HEIGHT = 56

// var(--safe-area-inset-bottom, ...) vient du plugin natif Capacitor SystemBars
// (le plus fiable). env(safe-area-inset-bottom) est le repli navigateur standard,
// pas toujours fiable sur les téléphones en navigation 3 boutons selon la marque.
// max(..., 56px) garantit un espace minimum même si les deux valent 0 par erreur —
// historique : 40 -> 64px (signalement "Ma galerie" caché/coupé) -> 48px (64
// jugé trop haut/imposant ailleurs) -> re-signale coupe sur un appareil en
// navigation 3 boutons -> 56px, compromis entre les deux. A rehausser encore si
// le meme souci de libelle coupe revient.
export const NAV_SAFE_AREA_BOTTOM = 'max(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 56px)'

// Hauteur totale réelle de la bottom bar (contenu + zone de sécurité) —
// à utiliser partout où un élément doit se positionner juste au-dessus.
export const NAV_TOTAL_HEIGHT_CSS = `calc(${NAV_CONTENT_HEIGHT}px + ${NAV_SAFE_AREA_BOTTOM})`
