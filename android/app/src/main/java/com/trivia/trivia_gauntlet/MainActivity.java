package com.trivia.trivia_gauntlet;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private AppOpenAdManager appOpenAdManager;
    private boolean appOpenShownOnce = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAdPlugin.class);
        super.onCreate(savedInstanceState);
        appOpenAdManager = new AppOpenAdManager(this);
        appOpenAdManager.loadAd();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (!appOpenShownOnce) {
            appOpenShownOnce = true;
            appOpenAdManager.showAdIfAvailable(this);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Reload ad for next background→foreground transition
        appOpenAdManager.loadAd();
    }
}
