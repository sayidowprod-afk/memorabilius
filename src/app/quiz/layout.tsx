// Le fond transparent doit être garanti dès le tout premier rendu HTML, pas
// ajouté après coup par un <style> injecté côté client (React) une fois
// hydraté. Streamlabs/OBS (CEF) fige apparemment la transparence du Browser
// Source d'après l'état de la toute première image peinte -- un override
// ajouté seulement après l'hydratation arrivait trop tard, et pouvait aussi
// perdre la bataille de cascade contre le `body { background: var(--bg)
// !important }` de globals.css selon l'ordre d'insertion des feuilles de
// style (les deux étant !important, c'est le DERNIER inséré qui gagne -- pas
// garanti pour un <style> client). Un layout serveur pour tout le segment
// /quiz règle ça une fois pour toutes : présent dans le tout premier HTML
// envoyé, avant n'importe quel JS. Sans incidence sur la page spectateur
// (/quiz/[code]) : son propre fond plein écran (Centered, 100dvh, opaque)
// recouvre visuellement ce body transparent de toute façon.
export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  )
}
