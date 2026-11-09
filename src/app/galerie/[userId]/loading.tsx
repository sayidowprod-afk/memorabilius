import GalerieFallback from './GalerieFallback'

// Écran de chargement de la galerie : même hauteur et même aspect que l'aperçu envoyé ensuite par la page,
// donc rien ne bouge quand on passe de l'un à l'autre (avant : l'écran de chargement général, court, puis la page haute d'un coup).
export default function Loading() {
  return <GalerieFallback cards={[]} grail={[]} />
}
