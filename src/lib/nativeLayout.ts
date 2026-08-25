// Hauteur "contenu" de la bottom bar native (icône + label + padding interne),
// sans la zone de sécurité système — celle-ci s'ajoute par-dessus, jamais en
// remplacement, pour ne jamais écraser le contenu.
export const NAV_CONTENT_HEIGHT = 56

// var(--safe-area-inset-bottom, ...) vient du plugin natif Capacitor SystemBars
// (le plus fiable). env(safe-area-inset-bottom) est le repli navigateur standard,
// pas toujours fiable sur les téléphones en navigation 3 boutons selon la marque.
// max(..., 48px) garantit un espace minimum même si les deux valent 0 par erreur —
// remonté de 40 à 64px suite a un signalement (libellé "Ma galerie" caché/coupé)
// sur un appareil ou la vraie barre de gestes depassait ce plancher, mais 64px
// rendait la barre trop haute/imposante sur la plupart des autres telephones —
// 48px comme compromis. A rehausser si le meme souci de libelle coupe revient.
export const NAV_SAFE_AREA_BOTTOM = 'max(var(--safe-area-inset-bottom, env(safe-area-inset-bottom)), 48px)'

// Hauteur totale réelle de la bottom bar (contenu + zone de sécurité) —
// à utiliser partout où un élément doit se positionner juste au-dessus.
export const NAV_TOTAL_HEIGHT_CSS = `calc(${NAV_CONTENT_HEIGHT}px + ${NAV_SAFE_AREA_BOTTOM})`
