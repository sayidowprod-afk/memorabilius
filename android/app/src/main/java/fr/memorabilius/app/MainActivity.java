package fr.memorabilius.app;

import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // Le CSS overscroll-behavior (NativeInit.tsx) ne supprime pas le glow
        // orange/bleu natif de la WebView Android — il faut le désactiver ici.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
}
