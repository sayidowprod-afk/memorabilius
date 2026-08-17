package fr.memorabilius.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

// Tuile Réglages rapides — glisser depuis le haut de l'écran, appui sur la tuile
// pour ouvrir directement le scanner, sans passer par l'icône de l'app.
public class ScanTileService extends TileService {

    @Override
    public void onStartListening() {
        super.onStartListening();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setState(Tile.STATE_ACTIVE);
            tile.updateTile();
        }
    }

    // startActivityAndCollapse(Intent) est dépréciée depuis API 34 (remplacée par la
    // variante PendingIntent ci-dessous) mais reste nécessaire pour minSdk 24-33.
    @SuppressWarnings("deprecation")
    @Override
    public void onClick() {
        super.onClick();

        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://www.memorabilius.fr/scanner"));
        intent.setPackage(getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            PendingIntent pending = PendingIntent.getActivity(
                this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            startActivityAndCollapse(pending);
        } else {
            startActivityAndCollapse(intent);
        }
    }
}
