interface Props {
  html: string // déjà sanitisé par l'appelant (même sanitize-html que le bloc `text`)
  image: string
  imagePosition: 'left' | 'right'
}

// Texte + image côte à côte. Rendu 100% serveur (pas d'interactivité) : flex 2
// colonnes sur desktop, empilé en 1 colonne sur mobile.
export default function TextImageBlock({ html, image, imagePosition }: Props) {
  if (!html && !image) return null
  const imageEl = image && <img src={image} alt="" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
  const textEl = html && <div className="guide-content" style={{ fontSize: 16, lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: html }} />

  return (
    <div className="text-image-block" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', margin: '32px 0', flexDirection: imagePosition === 'right' ? 'row-reverse' : 'row' }}>
      <div style={{ flex: '0 0 38%' }}>{imageEl}</div>
      <div style={{ flex: 1, minWidth: 0 }}>{textEl}</div>
      <style>{`
        @media (max-width: 620px) {
          .text-image-block { flex-direction: column !important; }
          .text-image-block > div { flex-basis: auto !important; width: 100%; }
        }
      `}</style>
    </div>
  )
}
