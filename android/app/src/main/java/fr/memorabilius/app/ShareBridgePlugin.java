package fr.memorabilius.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "ShareBridge")
public class ShareBridgePlugin extends Plugin {

    private static final String CATEGORY = "fr.memorabilius.app.category.SHARE_TARGET_MESSAGE";

    // Contenu reçu d'une autre app (texte/image) et éventuellement le contact visé si
    // l'utilisateur a tapé un raccourci Partage direct plutôt que l'app générique.
    // Lu une fois côté JS au lancement/retour au premier plan, puis l'intent est
    // "consommée" (action effacée) pour ne pas la retraiter au prochain appel.
    @SuppressWarnings("deprecation")
    @PluginMethod
    public void getPendingShare(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();

        if (intent != null && Intent.ACTION_SEND.equals(intent.getAction())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            String shortcutId = intent.getStringExtra(Intent.EXTRA_SHORTCUT_ID);

            if (text != null) result.put("text", text);
            if (imageUri != null) {
                String path = copyToCache(imageUri);
                if (path != null) result.put("imagePath", path);
            }
            if (shortcutId != null && shortcutId.startsWith("contact_")) {
                result.put("toUserId", shortcutId.substring("contact_".length()));
            }

            intent.setAction(null);
        }

        call.resolve(result);
    }

    private String copyToCache(Uri uri) {
        try {
            InputStream in = getContext().getContentResolver().openInputStream(uri);
            if (in == null) return null;
            File file = new File(getContext().getCacheDir(), "shared_" + System.currentTimeMillis() + ".jpg");
            FileOutputStream out = new FileOutputStream(file);
            byte[] buf = new byte[8192];
            int len;
            while ((len = in.read(buf)) > 0) out.write(buf, 0, len);
            in.close();
            out.close();
            return file.getAbsolutePath();
        } catch (Exception e) {
            return null;
        }
    }

    // Republie la liste des contacts récents comme cibles de Partage direct — appelé
    // depuis la page Messages à chaque changement de la liste de conversations.
    @PluginMethod
    public void updateShareTargets(PluginCall call) {
        JSArray contacts = call.getArray("contacts");
        if (contacts == null) { call.resolve(); return; }
        Context context = getContext();

        new Thread(() -> {
            List<ShortcutInfoCompat> shortcuts = new ArrayList<>();
            try {
                for (int i = 0; i < contacts.length(); i++) {
                    JSONObject c = contacts.getJSONObject(i);
                    String id = c.optString("id", null);
                    String name = c.optString("name", null);
                    String avatarUrl = c.optString("avatarUrl", null);
                    if (id == null || name == null) continue;

                    IconCompat icon = downloadIcon(avatarUrl);
                    Person person = new Person.Builder().setName(name).setIcon(icon).build();

                    ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, "contact_" + id)
                        .setShortLabel(name)
                        .setLongLabel(name)
                        .setIcon(icon)
                        .setPerson(person)
                        .setCategories(Collections.singleton(CATEGORY))
                        .setIntent(new Intent(Intent.ACTION_VIEW)
                            .setPackage(context.getPackageName())
                            .setData(Uri.parse("https://www.memorabilius.fr/messages?to=" + id)))
                        .setLongLived(true)
                        .build();
                    shortcuts.add(shortcut);
                }
                ShortcutManagerCompat.removeAllDynamicShortcuts(context);
                ShortcutManagerCompat.addDynamicShortcuts(context, shortcuts);
            } catch (Exception ignored) { /* non-critique : la liste des cibles reste juste pas à jour */ }
        }).start();

        call.resolve();
    }

    private IconCompat downloadIcon(String url) {
        if (url != null) {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                InputStream in = conn.getInputStream();
                Bitmap bmp = BitmapFactory.decodeStream(in);
                in.close();
                if (bmp != null) return IconCompat.createWithAdaptiveBitmap(bmp);
            } catch (Exception ignored) { /* repli sur l'icône de l'app ci-dessous */ }
        }
        return IconCompat.createWithResource(getContext(), R.mipmap.ic_launcher);
    }
}
