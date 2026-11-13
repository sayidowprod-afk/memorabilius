// Affiché dès l'ouverture d'une galerie, pendant que le serveur prépare la page : un squelette (en-tête, onglets, grille) à la place
// de l'écran vide avec les trois cartes qui tournent. Les vraies cartes le remplacent ensuite sans que la mise en page bouge.
export default function GalerieLoading() {
  return (
    <div className="gal-skel" role="status" aria-label="Chargement de la galerie">
      <div className="gs-head">
        <i className="gs-av" />
        <div style={{ flex: 1 }}>
          <i style={{ height: 20, width: '45%', marginBottom: 10 }} />
          <i style={{ height: 12, width: '30%' }} />
        </div>
      </div>
      <div className="gs-tabs">
        {[0, 1, 2, 3].map(k => <i key={k} style={{ height: 34, width: 96, flex: 'none' }} />)}
      </div>
      <div className="gs-grid">
        {Array.from({ length: 12 }).map((_, k) => <i key={k} className="gs-card" />)}
      </div>
    </div>
  )
}
