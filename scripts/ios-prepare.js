// Prépare le projet iOS généré par `npx cap add ios --packagemanager CocoaPods` (lancé par le build Codemagic, voir codemagic.yaml).
// Le dossier ios/ n'est pas dans le dépôt : il est recréé à chaque build, puis ce script y applique ce que Capacitor ne fait pas seul :
//   · textes de permission (caméra, photos, Face ID), notifications à distance, « pas de chiffrement soumis à déclaration » ;
//   · notifications : Firebase Messaging, pour que le jeton reçu par le site soit un jeton FCM (le serveur envoie déjà via Firebase) ;
//   · entitlements : notifications (aps-environment) et « Se connecter avec Apple » ;
//   · GoogleService-Info.plist ajouté au projet.
// À lancer depuis la racine du dépôt, sur un Mac : node scripts/ios-prepare.js
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const APP = path.join('ios', 'App')
const must = (f) => { if (!fs.existsSync(f)) { console.error('Introuvable : ' + f + ' (lance d\'abord : npx cap add ios --packagemanager CocoaPods)'); process.exit(1) } return f }
const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const write = (f, s) => fs.writeFileSync(f, s)

// ── 1. Info.plist ────────────────────────────────────────────────────────────
const plist = must(path.join(APP, 'App', 'Info.plist'))
let p = read(plist)
const add = (key, xml) => { if (!p.includes('<key>' + key + '</key>')) p = p.replace(/<\/dict>\s*<\/plist>\s*$/, '\t<key>' + key + '</key>\n\t' + xml + '\n</dict>\n</plist>\n') }
add('NSCameraUsageDescription', '<string>Memorabilius utilise la caméra pour photographier et scanner tes cartes.</string>')
add('NSPhotoLibraryUsageDescription', '<string>Memorabilius accède à tes photos pour ajouter des cartes à ta collection.</string>')
add('NSPhotoLibraryAddUsageDescription', '<string>Memorabilius enregistre dans tes photos les images de cartes que tu exportes.</string>')
add('NSFaceIDUsageDescription', '<string>Face ID te permet de te connecter rapidement à ton compte.</string>')
add('UIBackgroundModes', '<array>\n\t\t<string>remote-notification</string>\n\t</array>')
add('ITSAppUsesNonExemptEncryption', '<false/>')
write(plist, p)

// ── 2. Podfile : Firebase Messaging ──────────────────────────────────────────
const podfile = must(path.join(APP, 'Podfile'))
let pf = read(podfile)
if (!pf.includes("pod 'FirebaseMessaging'")) pf = pf.replace('  # Add your Pods here', "  # Add your Pods here\n  pod 'FirebaseMessaging'")
write(podfile, pf)

// ── 3. AppDelegate : Firebase + jeton de notification ────────────────────────
const del = must(path.join(APP, 'App', 'AppDelegate.swift'))
let d = read(del)
if (!d.includes('FirebaseApp.configure()')) {
  d = d.replace('import Capacitor\n', 'import Capacitor\nimport FirebaseCore\nimport FirebaseMessaging\n')
  d = d.replace('        // Override point for customization after application launch.\n        return true', '        FirebaseApp.configure()\n        return true')
  const hooks = `
    // Notifications : l'appareil donne son jeton Apple (APNs) ; Firebase le convertit en jeton FCM, que le plugin transmet au site.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token(completion: { (token, error) in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        })
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}
`
  d = d.replace(/\n\}\s*$/, '\n' + hooks)
}
if (!d.includes('FirebaseMessaging') || !d.includes('capacitorDidRegisterForRemoteNotifications')) { console.error('AppDelegate.swift : modification non appliquée'); process.exit(1) }
write(del, d)

// ── 4. Entitlements ──────────────────────────────────────────────────────────
write(path.join(APP, 'App', 'App.entitlements'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>aps-environment</key>
	<string>production</string>
	<key>com.apple.developer.applesignin</key>
	<array>
		<string>Default</string>
	</array>
</dict>
</plist>
`)

// ── 5. Projet Xcode : entitlements + GoogleService-Info.plist ────────────────
const gsi = path.join(APP, 'App', 'GoogleService-Info.plist')
if (!fs.existsSync(gsi)) { console.error('GoogleService-Info.plist manquant dans ios/App/App/ (variable GOOGLE_SERVICE_INFO_PLIST_BASE64 du build)'); process.exit(1) }
const ruby = `
require 'xcodeproj'
proj = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = proj.targets.find { |t| t.name == 'App' }
target.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'; c.build_settings['TARGETED_DEVICE_FAMILY'] = '1' }   # 1 = iPhone seulement (pas de captures iPad à fournir)
group = proj.main_group.find_subpath('App', true)
unless group.files.any? { |f| f.path == 'GoogleService-Info.plist' }
  ref = group.new_file('GoogleService-Info.plist')
  target.resources_build_phase.add_file_reference(ref)
end
proj.save
`
cp.execFileSync('ruby', ['-e', ruby], { stdio: 'inherit' })
console.log('Projet iOS préparé.')
