'use client'

// Bouton de fermeture unifie pour les modales — le site melangeait des tailles/
// couleurs/glyphes legerement differents ("✕" vs "×", tailles 18-20px, couleurs
// variables) d'une modale a l'autre pour la meme action.
export default function ModalCloseButton({ onClick, dark }: { onClick: () => void; dark?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label="Fermer"
      style={{
        background: 'none', border: 'none', fontSize: 20, lineHeight: 1, cursor: 'pointer',
        color: dark ? '#999' : '#888', padding: 4, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      ✕
    </button>
  )
}
