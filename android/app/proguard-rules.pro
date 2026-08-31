# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor lit les plugins par réflexion depuis le bridge JS — sans ces
# règles, R8 peut renommer/supprimer les méthodes @PluginMethod et casser
# tous les appels JS→natif (WidgetBridgePlugin, ShareBridgePlugin, etc.).
# Capacitor embarque normalement ses propres consumer-rules, mais on les
# duplique ici en filet de sécurité pour les plugins custom du projet.
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public *;
}

# Conserve les numéros de ligne pour que les stack traces envoyées à
# Crashlytics restent lisibles une fois le code minifié.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Sans ça, R8 garde la classe du plugin (regle -keep ci-dessus) mais peut
# supprimer les VALEURS des annotations (ex: la liste de permissions() dans
# @CapacitorPlugin). Bridge.getPermissionStates() lit ces valeurs par
# reflexion au runtime -- sans elles, NullPointerException. C'est ce qui
# faisait planter LocalNotifications/PushNotifications.checkPermissions()
# uniquement sur ce build minifie (jamais sur les runs de dev/beta non
# minifies), confirme par adb logcat sur appareil reel le 31/08.
-keepattributes *Annotation*
-keepattributes InnerClasses,Signature,EnclosingMethod
