// Lien direct vers SA galerie. Les adresses en identifiant (/galerie/<id>) sont redirigées par le serveur vers l'adresse lisible (/galerie/pseudo) :
// un aller-retour de plus (et un second rendu serveur) à chaque clic. Dès que la galerie a été ouverte une fois sur cet appareil, on retient l'adresse
// lisible et les liens de navigation pointent directement dessus. Avant cela (ou si le stockage est indisponible), on garde le lien par identifiant.
const KEY = (uid: string) => `own-gallery-${uid}`
const SIMPLE = /^\/galerie\/[^/?#]+$/

export function rememberOwnGallery(uid: string) {
  try {
    const p = window.location.pathname
    if (SIMPLE.test(p)) localStorage.setItem(KEY(uid), p)
  } catch { /* stockage indisponible : le lien par identifiant continue de fonctionner */ }
}

// Appelée pendant l'affichage, uniquement une fois l'utilisateur connu (donc jamais au rendu serveur) : pas de décalage à l'hydratation.
export function ownGalleryHref(uid?: string | null): string {
  if (!uid) return '/connexion'
  try { const s = localStorage.getItem(KEY(uid)); if (s && SIMPLE.test(s)) return s } catch { /* rien */ }
  return `/galerie/${uid}`
}
