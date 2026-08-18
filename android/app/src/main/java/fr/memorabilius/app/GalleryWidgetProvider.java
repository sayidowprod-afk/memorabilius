package fr.memorabilius.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.RemoteViews;

public class GalleryWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "widget_gallery_data";

    // Arrondit les coins de la vignette de carte — sans ça c'est un simple rectangle
    // photo posé sur le fond, ça ne ressemble pas à une carte à collectionner.
    private static Bitmap roundCorners(Context context, Bitmap src, float radiusDp) {
        int w = src.getWidth(), h = src.getHeight();
        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(src, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        float radiusPx = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, radiusDp, context.getResources().getDisplayMetrics());
        canvas.drawRoundRect(new RectF(0, 0, w, h), radiusPx, radiusPx, paint);
        return out;
    }

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

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        // Beaucoup de lanceurs (dont Nothing OS) imposent une cellule sur 2 rangées
        // minimum même si targetCellHeight="1" — sans ce hook la mise en page reste
        // celle sur une ligne, centrée dans une cellule bien plus haute qu'elle, ce
        // qui laisse un grand bloc de dégradé vide au-dessus du contenu.
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    // 1 rangée (~90dp déclaré) reste sur la mise en page compacte horizontale ; à partir
    // de 2 rangées, une mise en page verticale plus dense évite le vide au-dessus.
    private static int chooseLayout(AppWidgetManager mgr, int id) {
        Bundle options = mgr.getAppWidgetOptions(id);
        int minHeightDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        return minHeightDp >= 130 ? R.layout.widget_gallery_tall : R.layout.widget_gallery;
    }

    // "" si vide, sinon les segments non vides joints par le séparateur — évite les
    // "· ·" ou " • " qui pendent quand un champ (année, set...) n'est pas renseigné.
    private static String join(String sep, String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isEmpty()) continue;
            if (sb.length() > 0) sb.append(sep);
            sb.append(p);
        }
        return sb.toString();
    }

    private static void updateWidget(Context context, AppWidgetManager mgr, int id) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = new RemoteViews(context.getPackageName(), chooseLayout(mgr, id));

        String name = prefs.getString("last_card_name", "");
        int total = prefs.getInt("total_cards", 0);
        views.setTextViewText(R.id.widget_player_name, name == null || name.isEmpty() ? "Ma galerie" : name);
        views.setTextViewText(R.id.widget_stats, total + (total == 1 ? " carte" : " cartes"));

        // Cet id n'existe que dans widget_gallery_tall.xml — RemoteViews ignore
        // silencieusement une action sur un id absent de la mise en page compacte.
        String team = prefs.getString("last_card_team", "");
        String year = prefs.getString("last_card_year", "");
        views.setTextViewText(R.id.widget_card_meta, join(" • ", team, year));

        boolean rc = prefs.getBoolean("last_card_rc", false);
        boolean auto = prefs.getBoolean("last_card_auto", false);
        boolean patch = prefs.getBoolean("last_card_patch", false);
        views.setViewVisibility(R.id.widget_badge_rc, rc ? android.view.View.VISIBLE : android.view.View.GONE);
        views.setViewVisibility(R.id.widget_badge_auto, auto ? android.view.View.VISIBLE : android.view.View.GONE);
        views.setViewVisibility(R.id.widget_badge_patch, patch ? android.view.View.VISIBLE : android.view.View.GONE);
        views.setViewVisibility(R.id.widget_badges_row, (rc || auto || patch) ? android.view.View.VISIBLE : android.view.View.GONE);

        String imagePath = prefs.getString("last_card_image_path", null);
        if (imagePath != null) {
            Bitmap bmp = BitmapFactory.decodeFile(imagePath);
            if (bmp != null) views.setImageViewBitmap(R.id.widget_card_image, roundCorners(context, bmp, 8f));
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
