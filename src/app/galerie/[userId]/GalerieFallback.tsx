// Aperçu de la galerie envoyé tout de suite par le serveur, pendant que le code de la galerie se charge dans le navigateur.
// Avant : un simple texte « Chargement de la galerie… », puis tout apparaissait d'un coup (et le pied de page sautait).
// Ici : la place de l'en-tête, du Grail Wall, des onglets et des filtres est réservée (mêmes hauteurs que la vraie page, mesurées sur le site),
// puis les premières cartes. Aucune logique, aucune interaction : la vraie galerie prend le relais sans que rien ne bouge.
type Preview = { id: string; image_recto: string; is_horizontal: boolean }

const CSS = `
  .gfb { max-width: 1400px; margin: 0 auto; padding: 0 10px; min-height: 170vh; }
  .gfb-head, .gfb-bar { background: var(--bg3, rgba(128,128,160,.14)); animation: gfb-pulse 1.6s ease-in-out infinite; }
  .gfb-head { height: var(--gal-profile-h, 530px); border-radius: 16px; margin: 0 0 20px; }
  .gfb-wall { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; align-content: flex-start; min-height: var(--gal-wall-h, 434px); margin: 0 0 16px; }
  .gfb-grail { width: 90px; border-radius: 8px; overflow: hidden; background: var(--bg3, rgba(128,128,160,.14)); }
  .gfb-ctrl { height: var(--gal-ctrl-h, 660px); }
  .gfb-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .gfb-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); border-radius: 8px; overflow: hidden; background: var(--bg3, rgba(128,128,160,.14)); }
  @media (min-width: 900px) { .gfb-item { flex: 0 0 calc(20% - 10px); max-width: calc(20% - 10px); } }
  .gfb-ph { aspect-ratio: 2.5 / 3.5; width: 100%; overflow: hidden; }
  .gfb-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gfb-ph img.h { width: 140%; height: 71.43%; margin-left: -20%; margin-top: 14.286%; transform: rotate(90deg); }
  :root { --gal-profile-h: 530px; --gal-wall-h: 434px; --gal-ctrl-h: 660px; }
  @media (min-width: 768px) { :root { --gal-profile-h: 480px; --gal-wall-h: 404px; --gal-ctrl-h: 476px; } }
  @keyframes gfb-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
  @media (prefers-reduced-motion: reduce) { .gfb-head, .gfb-bar { animation: none } }
`

export default function GalerieFallback({ cards, grail }: { cards: Preview[]; grail: Preview[] }) {
  return (
    <div className="gfb" role="status" aria-busy="true" aria-label="Chargement de la galerie">
      <style>{CSS}</style>
      <div className="gfb-head" />
      {grail.length > 0 && (
        <div className="gfb-wall">
          {grail.map(c => (
            <div key={c.id} className="gfb-grail"><div className="gfb-ph">{/* eslint-disable-next-line @next/next/no-img-element */}<img className={c.is_horizontal ? 'h' : undefined} src={c.image_recto} alt="" loading="eager" /></div></div>
          ))}
        </div>
      )}
      <div className="gfb-ctrl" />
      <div className="gfb-grid">
        {(cards.length > 0 ? cards : Array.from({ length: 10 }, (_, i) => ({ id: String(i), image_recto: '', is_horizontal: false }))).map(c => (
          <div key={c.id} className="gfb-item"><div className="gfb-ph">{c.image_recto && /* eslint-disable-next-line @next/next/no-img-element */ <img className={c.is_horizontal ? 'h' : undefined} src={c.image_recto} alt="" loading="eager" />}</div></div>
        ))}
      </div>
    </div>
  )
}
