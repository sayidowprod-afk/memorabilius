import { Archivo_Black } from 'next/font/google'

// Typo condensée/impact pour le quiz en direct (branding "Fédération de la
// Carte", voir fdlcBranding.ts) -- next/font l'auto-héberge (aucune requête
// externe vers Google au chargement).
export const fdlcFont = Archivo_Black({ weight: '400', subsets: ['latin'], display: 'swap' })
