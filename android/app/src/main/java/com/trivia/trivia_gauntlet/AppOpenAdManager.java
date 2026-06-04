package com.trivia.trivia_gauntlet;

import android.app.Activity;
import android.content.Context;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.appopen.AppOpenAd;
import java.util.Date;

public class AppOpenAdManager {

    private static final String TEST_AD_UNIT_ID = "ca-app-pub-3940256099942544/9257395921";
    private static final String PROD_AD_UNIT_ID = "ca-app-pub-9506123851374920/6062430756";
    private static final boolean TEST_MODE      = true;
    private static final long AD_EXPIRY_MS      = 4 * 60 * 60 * 1000;

    private AppOpenAd appOpenAd   = null;
    private boolean isLoadingAd   = false;
    private boolean isShowingAd   = false;
    private long loadTime         = 0;
    private Activity pendingActivity = null; // show as soon as ad loads

    private final Context context;

    public AppOpenAdManager(Context context) {
        this.context = context;
    }

    private String getAdUnitId() {
        return TEST_MODE ? TEST_AD_UNIT_ID : PROD_AD_UNIT_ID;
    }

    public void loadAd(Activity activityToShowOn) {
        if (isLoadingAd || isAdAvailable()) return;
        pendingActivity = activityToShowOn;
        isLoadingAd = true;
        AdRequest request = new AdRequest.Builder().build();
        AppOpenAd.load(context, getAdUnitId(), request, new AppOpenAd.AppOpenAdLoadCallback() {
            @Override
            public void onAdLoaded(AppOpenAd ad) {
                appOpenAd = ad;
                isLoadingAd = false;
                loadTime = new Date().getTime();
                if (pendingActivity != null) {
                    showAdIfAvailable(pendingActivity);
                    pendingActivity = null;
                }
            }
            @Override
            public void onAdFailedToLoad(LoadAdError error) {
                isLoadingAd = false;
                pendingActivity = null;
            }
        });
    }

    public void loadAd() {
        loadAd(null);
    }

    private boolean isAdAvailable() {
        return appOpenAd != null && (new Date().getTime() - loadTime < AD_EXPIRY_MS);
    }

    public void showAdIfAvailable(Activity activity) {
        if (isShowingAd) return;
        if (!isAdAvailable()) {
            loadAd(activity);
            return;
        }
        appOpenAd.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                appOpenAd = null;
                isShowingAd = false;
                loadAd();
            }
            @Override
            public void onAdFailedToShowFullScreenContent(AdError adError) {
                appOpenAd = null;
                isShowingAd = false;
                loadAd();
            }
            @Override
            public void onAdShowedFullScreenContent() {
                isShowingAd = true;
            }
        });
        appOpenAd.show(activity);
    }
}
