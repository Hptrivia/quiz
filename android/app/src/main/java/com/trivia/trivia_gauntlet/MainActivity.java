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
    public void onStart() {
        super.onStart();
        if (!appOpenShownOnce) {
            appOpenShownOnce = true;
            appOpenAdManager.showAdIfAvailable(this);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        appOpenAdManager.loadAd();
    }
}
