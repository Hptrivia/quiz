package com.trivia.trivia_gauntlet;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdOptions;
import com.google.android.gms.ads.nativead.NativeAdView;

@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {

    private NativeAd loadedNativeAd = null;
    private boolean isLoading = false;
    private FrameLayout adContainer = null;

    @PluginMethod
    public void prepareNativeAd(PluginCall call) {
        String adId = call.getString("adId");
        if (adId == null) { call.reject("adId required"); return; }
        if (isLoading) { call.resolve(); return; }
        isLoading = true;

        // Destroy any existing ad
        if (loadedNativeAd != null) { loadedNativeAd.destroy(); loadedNativeAd = null; }

        getActivity().runOnUiThread(() -> {
            AdLoader loader = new AdLoader.Builder(getContext(), adId)
                .forNativeAd(ad -> {
                    loadedNativeAd = ad;
                    isLoading = false;
                    JSObject result = new JSObject();
                    result.put("loaded", true);
                    call.resolve(result);
                })
                .withNativeAdOptions(new NativeAdOptions.Builder().build())
                .withAdListener(new com.google.android.gms.ads.AdListener() {
                    @Override
                    public void onAdFailedToLoad(com.google.android.gms.ads.LoadAdError error) {
                        isLoading = false;
                        call.reject("Failed to load native ad: " + error.getMessage());
                    }
                })
                .build();
            loader.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void showNativeAd(PluginCall call) {
        if (loadedNativeAd == null) { call.reject("No native ad loaded"); return; }
        float density = getContext().getResources().getDisplayMetrics().density;
        int x = (int) (call.getFloat("x", 0f) * density);
        int y = (int) (call.getFloat("y", 0f) * density);
        int width = (int) (call.getFloat("width", 0f) * density);
        int height = call.getInt("height", 0);

        getActivity().runOnUiThread(() -> {
            hideAdContainer();

            ViewGroup root = (ViewGroup) getActivity().getWindow().getDecorView();

            NativeAdView adView = (NativeAdView) LayoutInflater.from(getContext())
                .inflate(R.layout.native_ad_view, root, false);

            // Populate views
            TextView headline = adView.findViewById(R.id.ad_headline);
            TextView body = adView.findViewById(R.id.ad_body);
            ImageView icon = adView.findViewById(R.id.ad_app_icon);
            Button cta = adView.findViewById(R.id.ad_call_to_action);

            headline.setText(loadedNativeAd.getHeadline());
            body.setText(loadedNativeAd.getBody());
            if (loadedNativeAd.getIcon() != null) {
                icon.setImageDrawable(loadedNativeAd.getIcon().getDrawable());
            } else {
                icon.setVisibility(View.GONE);
            }
            if (loadedNativeAd.getCallToAction() != null) {
                cta.setText(loadedNativeAd.getCallToAction());
            }

            adView.setHeadlineView(headline);
            adView.setBodyView(body);
            adView.setIconView(icon);
            adView.setCallToActionView(cta);
            adView.setNativeAd(loadedNativeAd);

            FrameLayout container = new FrameLayout(getContext());
            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                width > 0 ? width : ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            params.topMargin = y;
            params.leftMargin = x;
            container.addView(adView);
            container.setLayoutParams(params);

            adContainer = container;
            root.addView(container);
            call.resolve();
        });
    }

    @PluginMethod
    public void hideNativeAd(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideAdContainer();
            call.resolve();
        });
    }

    private void hideAdContainer() {
        if (adContainer != null) {
            ViewGroup root = (ViewGroup) getActivity().getWindow().getDecorView();
            root.removeView(adContainer);
            adContainer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (loadedNativeAd != null) { loadedNativeAd.destroy(); loadedNativeAd = null; }
        hideAdContainer();
    }
}
