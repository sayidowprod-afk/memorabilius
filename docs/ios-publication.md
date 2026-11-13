# Publier Memorabilius sur l'App Store (sans Mac)

Le code est prêt (`codemagic.yaml`, `scripts/ios-prepare.js`, `scripts/ios-icon.js`, bouton « Se connecter avec Apple »).
Il reste les démarches chez Apple, Firebase, Supabase et Codemagic, dans cet ordre.

## 1. Compte Apple Developer (99 $/an)
- https://developer.apple.com/programs/enroll/ : inscription avec ton identifiant Apple. Validation : 1 à 2 jours.
- Le renouvellement annuel est obligatoire : sans lui, l'app est retirée de la boutique.

## 2. Identifiant de l'app (Certificates, Identifiers & Profiles)
- Identifiers, puis « + », puis App IDs : **Bundle ID `fr.memorabilius.app`**.
- Capabilities à cocher : **Push Notifications** et **Sign In with Apple**.

## 3. Clé de notifications (APNs)
- Keys, puis « + », nom « Memorabilius push », cocher **Apple Push Notifications service (APNs)**. Télécharge le fichier `.p8` (une seule fois !) et note le Key ID et ton Team ID.

## 4. Firebase (même projet que l'Android)
- Paramètres du projet, puis « Ajouter une application » iOS, avec l'ID `fr.memorabilius.app`. Télécharge `GoogleService-Info.plist`.
- Paramètres du projet, puis Cloud Messaging, puis « Configuration de l'app Apple » : envoie la clé `.p8` (Key ID + Team ID).
- Convertis le plist en texte (PowerShell) et copie le résultat :
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("GoogleService-Info.plist"))`

## 5. Supabase : « Se connecter avec Apple »
- Authentication, puis Providers, puis **Apple** : activer.
- « Authorized Client IDs » : `fr.memorabilius.app`. Aucun secret à renouveler pour la connexion native.

## 6. App Store Connect
- https://appstoreconnect.apple.com, puis Apps, puis « + » Nouvelle app : nom **Memorabilius**, langue principale français, bundle ID `fr.memorabilius.app`.
- Clé d'API (Utilisateurs et accès, puis Intégrations, puis App Store Connect API) : rôle **App Manager**. Note l'Issuer ID, le Key ID et télécharge le `.p8`.
- Fiche : URL de confidentialité `https://www.memorabilius.fr/confidentialite`, catégorie (Sports ou Style de vie), classification d'âge (contenu généré par les utilisateurs : oui).
- Confidentialité de l'app (« nutrition labels ») : à remplir selon ce que le site collecte (e-mail, photos, identifiants, usage).

## 7. Codemagic (gratuit : https://codemagic.io)
- Connecte le dépôt GitHub `memorabilius`. Si le dépôt devient privé, autorise-le dans l'app GitHub de Codemagic.
- Teams, puis Integrations, puis App Store Connect : ajoute la clé de l'étape 6, **nommée exactement `Memorabilius`**.
- Teams, puis Code signing identities : laisse Codemagic gérer la signature automatique avec cette clé.
- Groupe de variables **`ios_secrets`** : variable `GOOGLE_SERVICE_INFO_PLIST_BASE64` (cochée « Secure ») = le texte de l'étape 4.
- Lance le workflow **« iOS vers TestFlight »** (bouton Start new build). Compte 10 à 20 minutes. Le premier build peut demander un ou deux ajustements : envoie-moi le journal d'erreur.

## 8. Test sur un iPhone (obligatoire avant d'envoyer à Apple)
- App TestFlight sur l'iPhone d'un proche. App Store Connect, puis TestFlight, puis testeur interne = son identifiant Apple.
- À vérifier : ouverture de l'app, connexion Google ET Apple, caméra / scan, notifications (accepter, puis envoyer un message de test), suppression du compte (Profil).

## 9. Envoi en validation
- Captures d'écran iPhone 6,9 pouces (1320 x 2868) : 3 minimum.
- **Compte de démonstration** dans « Notes pour la revue » (e-mail + mot de passe d'un compte de test) : Apple l'exige quand il y a une connexion.
- Dans les notes, citer les fonctions natives : scan par caméra, notifications, Face ID, galerie 3D. Ça évite le refus « simple site dans une app » (règle 4.2).
- Mentionner : suppression de compte dans Profil, signalement et modération des contenus.

## Ensuite
- Tu n'y touches plus : l'app charge le site, donc tes mises à jour passent par Vercel.
- Seules obligations : renouveler les 99 $/an et, de temps en temps, relancer un build Codemagic si Apple impose une version d'Xcode plus récente (message de leur part).
