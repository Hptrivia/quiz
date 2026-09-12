---
name: bio-link-landing-page-analytics
description: GA4 setup + button click tracking + app-store deep-link attribution plan for the YouTube/Insta/TikTok bio-link landing page
metadata: 
  node_type: memory
  type: project
  originSessionId: 6b78e9bb-1bd1-4635-81c7-db9b01c22429
  modified: 2026-08-21T11:11:44.786Z
---

The bio-link landing page (hptrivia.github.io/Trivia-Gauntlet-Site/, shared on YouTube/Insta/TikTok with `?utm_source=...` per platform) is a **separate static page**, not part of this `quiz` repo and not wired into the app's existing Supabase install-tracking system. Added GA4 (measurement ID `[redacted]`) to it 2026-08-21.

**What was done:**
1. Added the gtag.js snippet to `<head>`.
2. Added a `store_click` GA4 event fired on click of every store button (`data-store="ios"/"android"`, `data-section="hero"/"mid_strip"/"final_cta"` on the wrapping div). GA4 auto-attaches session source/medium from the page's `?utm_source=` to every event, so the click event doesn't need to manually re-read/pass utm_source — cross-tab it in GA4 against `store_click` to see iOS vs Android clicks per platform (YouTube/Insta/TikTok).

**Deep-link / real-install attribution (the "one more layer" beyond GA4 clicks) — both confirmed real and current, both dashboard-only, no app code changes needed:**
- **Apple**: App Store Connect supports free "Campaign Links" — append `?pt=<providerToken>&ct=<campaignToken>&mt=8` to the App Store URL (pt = your fixed provider token, ct = a name per campaign, e.g. `youtube`, `tiktok`). View real download counts per `ct` in App Store Connect → App Analytics → Acquisition → Campaign links. First-time download must happen within 24h of the tap to attribute.
- **Google Play**: append `&referrer=utm_source%3Dyoutube%26utm_medium%3Dsocial%26utm_campaign%3Dbio_link` (URL-encoded) to the Play Store URL. Google Play Console's own "Listing conversion" / acquisition reports break this down natively — no SDK, no app rebuild needed for basic reporting. (A Play Install Referrer SDK integration only becomes necessary later if the app itself needs to read the referrer at runtime, e.g. to log it into Supabase — not needed just for dashboard reporting.)
- These give **verified installs**, not just clicks — the real complement to GA4 (which only proves someone tapped the button, not that they completed the install).

**Why NOT connect this to the existing Supabase `promo_clicks` / `install_counter` / `installs_log` system:** that system lives on triviagauntlet.app itself (the PWA/native app), firing when a visitor taps a promo banner *inside the app/web product* to upsell the native install, and separately when the native app pings `notify-install` on first real launch. It's a different funnel (in-app upsell) from the bio-link landing page (social video → landing page → store). No need to merge them — GA4 + the Apple/Google campaign-link params fully cover the bio-link funnel on their own. Revisit only if the user later wants one unified cross-funnel install dashboard.

Related: [[feedback_verify_before_asserting]], [[project_revenuecat_remove_ads]]
