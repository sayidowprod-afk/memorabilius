import { redirect } from 'next/navigation'

// Le pack s'ouvre depuis l'accueil (fenêtre plein écran) : l'ancienne adresse y renvoie.
export default function Page() {
  redirect('/?pack=1')
}
