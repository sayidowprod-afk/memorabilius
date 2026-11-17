// Affiché dès l'ouverture d'une galerie, pendant que le serveur prépare la page : le logo Memorabilius animé (respiration + reflet qui passe)
// avec une fine barre de progression. Les vraies cartes le remplacent ensuite.
export default function GalerieLoading() {
  return (
    <div className="gal-logo-load" role="status" aria-label="Chargement de la galerie">
      <div className="gll-logo"><span /></div>
      <div className="gll-bar"><i /></div>
    </div>
  )
}
