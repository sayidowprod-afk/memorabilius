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
