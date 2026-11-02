import { redirect } from 'next/navigation'

// Ancienne adresse : le suivi gradation est maintenant un onglet de « Mes achats ».
export default function Page() {
  redirect('/mes-achats?onglet=gradation')
}
