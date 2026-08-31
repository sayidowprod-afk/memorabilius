'use client'

// DESACTIVE (31/08) : PushNotifications.checkPermissions() plante tout le
// process natif (NullPointerException dans com.getcapacitor.d0.getPermissionStates,
// bug du coeur de Capacitor confirme par adb logcat sur appareil reel -- un
// delai de 1s avant l'appel n'a pas suffi). Coupe tant qu'un vrai correctif
// (upgrade Capacitor + rebuild + test reel) n'est pas fait -- l'app doit
// rester utilisable avant tout. Ancienne implementation dans l'historique git
// (src/components/PushInit.tsx avant ce commit).
export default function PushInit() {
  return null
}
