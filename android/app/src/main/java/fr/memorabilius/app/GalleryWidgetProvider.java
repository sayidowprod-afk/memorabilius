package fr.memorabilius.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.widget.RemoteViews;

public class GalleryWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "widget_gallery_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(context);
        int[] ids = mgr.getAppWidgetIds(new android.content.ComponentName(context, GalleryWidgetProvider.class));
        for (int id : ids) {
            updateWidget(context, mgr, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager mgr, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_gallery);

        String name = prefs.getString("last_card_name", "");
        int total = prefs.getInt("total_cards", 0);
        views.setTextViewText(R.id.widget_player_name, name == null || name.isEmpty() ? "Ma galerie" : name);
        views.setTextViewText(R.id.widget_stats, total + (total == 1 ? " carte" : " cartes"));

        String imagePath = prefs.getString("last_card_image_path", null);
        if (imagePath != null) {
            Bitmap bmp = BitmapFactory.decodeFile(imagePath);
            if (bmp != null) views.setImageViewBitmap(R.id.widget_card_image, bmp);
        }

        String url = prefs.getString("gallery_url", "https://www.memorabilius.fr");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setPackage(context.getPackageName());
        PendingIntent pending = PendingIntent.getActivity(
            context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        mgr.updateAppWidget(id, views);
    }
}
