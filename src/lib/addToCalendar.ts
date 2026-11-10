import { Capacitor } from '@capacitor/core'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { buildEventICS, googleCalendarUrl, type EventLike } from '@/lib/eventIcs'

// « Ajouter au calendrier » sur téléphone : un fichier .ics créé en mémoire et « téléchargé » part dans les téléchargements sans ouvrir l'agenda
// (le bouton semblait ne rien faire). Android -> Google Agenda avec l'événement prérempli ; iPhone / iPad -> le fichier servi depuis le serveur
// (serverUrl), que Safari propose d'ajouter à l'agenda ; application Android -> Google Agenda (système) ; ordinateur -> fichier .ics.
export async function addToCalendar(ev: EventLike, serverUrl: string, filename: string): Promise<void> {
  // Appli Android : le partage d'un fichier .ics ne propose que « enregistrer / envoyer le fichier », jamais « ajouter à l'agenda ». window.open envoie
  // l'adresse au système (comme un lien dans le navigateur), qui l'ouvre dans l'appli Google Agenda, événement prérempli.
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') { window.open(googleCalendarUrl(ev), '_blank'); return }
  if (!Capacitor.isNativePlatform() && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/Android/i.test(ua)) { window.open(googleCalendarUrl(ev), '_blank', 'noopener'); return }
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) { window.location.assign(serverUrl); return }
  }
  const blob = new Blob([buildEventICS(ev)], { type: 'text/calendar;charset=utf-8' })
  // saveOrShareFile gere le repli natif (Filesystem+Share) -- un <a download> brut ne fait silencieusement rien dans la WebView Android.
  await saveOrShareFile(blob, filename)
}
