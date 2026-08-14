package fr.memorabilius.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateGalleryWidget(PluginCall call) {
        String imageUrl = call.getString("imageUrl");
        String playerName = call.getString("playerName", "");
        Integer totalCards = call.getInt("totalCards", 0);
        String galleryUrl = call.getString("galleryUrl", "https://www.memorabilius.fr");

        Context context = getContext();

        new Thread(() -> {
            String savedPath = null;
            if (imageUrl != null) {
                savedPath = downloadImage(context, imageUrl);
            }
            SharedPreferences prefs = context.getSharedPreferences(GalleryWidgetProvider.PREFS, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("last_card_name", playerName);
            editor.putInt("total_cards", totalCards == null ? 0 : totalCards);
            editor.putString("gallery_url", galleryUrl);
            if (savedPath != null) editor.putString("last_card_image_path", savedPath);
            editor.apply();

            GalleryWidgetProvider.updateAll(context);
            call.resolve();
        }).start();
    }

    private String downloadImage(Context context, String urlStr) {
        try {
            URL url = new URL(urlStr);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            InputStream in = conn.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(in);
            in.close();
            if (bmp == null) return null;

            // Limite la taille pour ne pas alourdir SharedPreferences/RemoteViews inutilement
            int maxDim = 300;
            if (bmp.getWidth() > maxDim || bmp.getHeight() > maxDim) {
                float scale = Math.min((float) maxDim / bmp.getWidth(), (float) maxDim / bmp.getHeight());
                bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * scale), Math.round(bmp.getHeight() * scale), true);
            }

            File file = new File(context.getFilesDir(), "widget_last_card.jpg");
            FileOutputStream out = new FileOutputStream(file);
            bmp.compress(Bitmap.CompressFormat.JPEG, 85, out);
            out.close();
            return file.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }
}
