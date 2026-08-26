import { supabase } from '@/lib/supabase'

// Doit être appelé AVANT supabase.auth.signOut() (a besoin du token de la
// session encore active pour s'authentifier auprès des routes DELETE).
//
// Sans ça, se déconnecter ne retirait jamais l'abonnement push : sur un
// appareil partagé, le compte qui vient de se déconnecter continuait de
// recevoir les notifications adressées à son user_id (l'abonnement navigateur
// ou le token FCM restent actifs côté OS tant qu'on ne les retire pas
// explicitement), et le compte suivant à se connecter sur le même appareil
// n'était pas re-souscrit automatiquement.
export async function unsubscribeAllPush() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }

    await Promise.all([
      fetch('/api/push-subscribe', { method: 'DELETE', headers, body: JSON.stringify({}) }).catch(() => {}),
      fetch('/api/fcm-subscribe', { method: 'DELETE', headers, body: JSON.stringify({}) }).catch(() => {}),
    ])

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      await sub?.unsubscribe()
    }
  } catch {
    // Best-effort : ne doit jamais bloquer la déconnexion elle-même.
  }
}
