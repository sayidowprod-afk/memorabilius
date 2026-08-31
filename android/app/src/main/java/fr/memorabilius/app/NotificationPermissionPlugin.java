package fr.memorabilius.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Contourne un bug du coeur de Capacitor (NullPointerException dans
// com.getcapacitor.Bridge.getPermissionStates(), confirme sur appareil reel
// via adb logcat le 31/08 -- persiste meme apres un fix ProGuard cible et
// plusieurs tentatives cote JS) qui plante/bloque tout appel a
// checkPermissions()/requestPermissions() sur les plugins officiels
// (@capacitor/local-notifications, @capacitor/push-notifications). Ce plugin
// gere la permission POST_NOTIFICATIONS avec des appels Android natifs bruts
// (ContextCompat/ActivityCompat), sans jamais passer par le systeme de
// permissions annotees de Capacitor -- donc jamais par le code qui plante.
@CapacitorPlugin(name = "NotificationPermissionBridge")
public class NotificationPermissionPlugin extends Plugin {
    private static final int REQ_CODE = 9001;

    @PluginMethod
    public void check(PluginCall call) {
        call.resolve(buildResult());
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || isGranted()) {
            call.resolve(buildResult());
            return;
        }
        saveCall(call);
        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_CODE);
    }

    @Override
    protected void handleRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_CODE) return;
        PluginCall call = getSavedCall();
        if (call == null) return;
        call.resolve(buildResult());
        freeSavedCall();
    }

    private boolean isGranted() {
        // Avant Android 13 (Tiramisu), il n'y a pas de permission runtime pour
        // les notifications -- elles sont autorisees par defaut.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject buildResult() {
        JSObject result = new JSObject();
        result.put("receive", isGranted() ? "granted" : "denied");
        return result;
    }
}
