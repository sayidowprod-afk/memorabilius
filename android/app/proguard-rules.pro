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

# Garder la classe @CapacitorPlugin (regle ci-dessus) ne suffit pas a garder
# les metadonnees de l'annotation elle-meme : sans -keepattributes pour les
# annotations, R8 peut les depouiller meme sur une classe conservee. Bridge.
# getPermissionStates() lit @CapacitorPlugin(permissions=...) par reflexion
# (PluginHandle.getPluginAnnotation()) -- sans cet attribut, l'annotation
# revient null au runtime et ca plante en NullPointerException des le premier
# appel LocalNotifications.schedule()/requestPermissions(), qui tue le
# HandlerThread "CapacitorPlugins" pour le reste de la session (plus aucun
# plugin ne repond ensuite : biometrie, notifs, telechargements...).
-keepattributes RuntimeVisibleAnnotations,RuntimeVisibleParameterAnnotations,AnnotationDefault

# INSUFFISANT A LUI SEUL (confirme par logcat + mapping.txt sur le build
# 1.1.5 : le crash ci-dessus persistait identique malgre la regle precedente).
# mapping.txt montrait "com.getcapacitor.annotation.CapacitorPlugin -> u1.b"
# -- la CLASSE de l'annotation elle-meme etait renommee par R8, alors que
# -keep @CapacitorPlugin class * ne protege que les classes qui LA PORTENT,
# pas l'annotation elle-meme. C'est un piege R8 connu : Class.getAnnotation(
# CapacitorPlugin.class) peut echouer/retourner null quand le type de
# l'annotation est renomme, meme avec ses attributs (RuntimeVisibleAnnotations)
# conserves. Il faut explicitement garder la classe de l'annotation.
-keep @interface com.getcapacitor.annotation.CapacitorPlugin
-keep @interface com.getcapacitor.annotation.Permission
-keep @interface com.getcapacitor.annotation.PermissionCallback
-keep @interface com.getcapacitor.annotation.ActivityCallback
-keep @interface com.getcapacitor.PluginMethod
