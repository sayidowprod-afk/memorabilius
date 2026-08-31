package fr.memorabilius.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class MemorabiliusApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    // Canaux créés au démarrage de l'app (pas seulement à l'ouverture de MainActivity)
    // pour qu'ils existent même si une notif FCM arrive avant le tout premier lancement.
    // channelId envoyé par le serveur (src/lib/pushNotify.ts) doit correspondre à l'un
    // de ces IDs, sinon Android ignore silencieusement la notif sur Android 8+.
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel messages = new NotificationChannel(
            "messages", "Messages", NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription("Nouveaux messages directs");

        NotificationChannel trades = new NotificationChannel(
            "trades", "Échanges", NotificationManager.IMPORTANCE_HIGH);
        trades.setDescription("Offres, acceptations et refus d'échanges");

        NotificationChannel wishlist = new NotificationChannel(
            "wishlist", "Wishlist", NotificationManager.IMPORTANCE_DEFAULT);
        wishlist.setDescription("Cartes de votre wishlist trouvées chez d'autres collectionneurs");

        NotificationChannel community = new NotificationChannel(
            "community", "Communauté", NotificationManager.IMPORTANCE_DEFAULT);
        community.setDescription("Likes et commentaires sur votre galerie");

        manager.createNotificationChannel(messages);
        manager.createNotificationChannel(trades);
        manager.createNotificationChannel(wishlist);
        manager.createNotificationChannel(community);
    }
}
