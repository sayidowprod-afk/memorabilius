import { redirect } from 'next/navigation'

// Cette page était une quasi-duplication complète de l'onglet "Mes échanges"
// de /trades (même logique fetch/accept/refuse/cancel copiée-collée, déjà
// désynchronisée par endroits) — jamais liée depuis la navigation réelle du
// site (seule une déclaration SEO JSON-LD dans page.tsx y pointait). Plutôt
// que maintenir deux implémentations divergentes du même flux, redirige vers
// le véritable point d'entrée.
export default function EchangesRedirect() {
  redirect('/trades?tab=echanges')
}
