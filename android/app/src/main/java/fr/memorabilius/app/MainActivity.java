package fr.memorabilius.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(ShareBridgePlugin.class);
        registerPlugin(NotificationPermissionPlugin.class);
        super.onCreate(savedInstanceState);
        // Le CSS overscroll-behavior (NativeInit.tsx) ne supprime pas le glow
        // orange/bleu natif de la WebView Android — il faut le désactiver ici.
        getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }

    // launchMode="singleTask" : si l'app tourne déjà, un nouveau partage arrive ici
    // plutôt que dans onCreate. setIntent() est indispensable pour que
    // ShareBridgePlugin.getPendingShare() (qui lit getActivity().getIntent()) voie
    // le nouveau contenu partagé au lieu de l'ancien intent de lancement.
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
