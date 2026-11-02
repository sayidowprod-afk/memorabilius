import { redirect } from 'next/navigation'

// Ancienne adresse : « Mes ventes » est maintenant un onglet de « Mes achats ».
export default function Page() {
  redirect('/mes-achats?onglet=ventes')
}
