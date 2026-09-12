---
name: project-premium-adfree-app
description: "Ad-free 'Trivia Gauntlet - Premium' Android app pivot (paid Play listing instead of in-app purchase) — web-side code done, native app build in progress"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cb555e3-a074-408a-a4ca-c8ebc302898d
  modified: 2026-08-23T17:32:01.720Z
---

Pivoted away from RevenueCat in-app purchase (see [[project_revenuecat_remove_ads]], abandoned 2026-08-22) to a **separate, already-published Android app** sold as a one-time paid Play Store listing. No purchase code needed at all — Play's native paid-app billing handles payment at install time.

**Why the pivot:** RevenueCat's ad-removal flickered on/off for paying users. Root cause found in the reverted code's own comments: `isAdsRemoved()` was checked synchronously in a dozen places, but the real entitlement came from an async network call to RevenueCat on every boot, cached to localStorage only once that call returned — so different pages/popups caught the state at different points in the race. The new mechanism (below) is structurally immune: no network call, no cache, a synchronous string check every time.

**The existing Premium app (external, not in this repo):**
- Already published on Play: name "Trivia Gauntlet - Premium", package `com.trivia.triviagauntlet_premium`
- **Not Capacitor** — a plain hand-written Android Studio WebView wrapper (Kotlin `MainActivity`, `WebView` + `WebViewClient`, `AppCompatActivity`). No plugins, no `window.Capacitor` bridge at all.
- Currently loads `https://premium-v8cz.onrender.com/` (an old, unrelated site) — needs repointing to `https://triviagauntlet.app/`
- Already has one build uploaded (`versionCode = 1`, `versionName = "1.0"`) — meaning **Play has a signing key locked to this package forever**; any update must be signed with that same key (or use Play Console's "Request upload key reset" under Setup → App integrity if the original keystore/upload key is lost). User was checking Android Studio / local machine for the original project + keystore as of this writing — outcome not yet known.
- `shouldOverrideUrlLoading` in its `WebViewClient` loads every link (including fully external ones) inside the same WebView rather than opening the system browser — pre-existing quirk, flagged but not fixed (not blocking).

**Exact edits still needed in that project (given to user, not yet confirmed applied):**
```kotlin
// MainActivity.kt
webSettings.userAgentString += " TriviaGauntletPremium"   // was " WebViewApp/1.0"
val pwaUrl = "https://triviagauntlet.app/"                 // was the onrender.com URL
```
```kotlin
// app/build.gradle.kts
versionCode = 2      // was 1
versionName = "1.1"  // was "1.0"
```

**The mechanism:** the native line above appends `TriviaGauntletPremium` to the WebView's `navigator.userAgent`. Every page the site's JS reads that string. No plugin/bridge needed — `navigator.userAgent` is a standard web API any native shell can modify and any JS can read.

**Web-side changes (this repo, `quiz`), all committed to the working tree but held uncommitted/unpushed as of this writing pending the app build being verified:**
- `assets/admob.js` — `_IS_PREMIUM_APP` checks the UA tag, forces `ADMOB_MODE = 'off'` (belt-and-suspenders; moot in practice since this app has no Capacitor so `isInApp()` is already false and ad code never runs at all). Restored the three pre-RevenueCat "Remove Ads" entry points that had been stripped in the rollback (`injectRemoveAdsThemeCard`, `injectRemoveAdsFooterLink`, the popup button in `_offerRewardedLifeline`) — simplified to link straight to `/remove-ads.html`, no purchase-package UI. All three now also gated by `_showRemoveAdsEntryPoints()` = `_ADMOB_PLATFORM === 'android'`, since there's no iOS premium app yet — hidden on iOS per user's explicit request rather than sending iOS users to a page that can't help them.
- `assets/profile.js` — `_isNative` now also `true` when the UA tag is present. This is the important one: it's the single flag driving `isLimitedWeb()`, `isDesktopWeb()`, `isAndroidWeb()`, the mobile "download the app" wall, replay-gating, and (via `if (_isNative) return`) `_injectFooterUnlock()` and `_injectThemeUnlockCard()` — so the premium app gets zero question limits and zero "Unlock Full Access"/"Membership" upsells, verified line-by-line.
- `assets/app.js` — `isPremiumUser()` now also `true` for the UA tag. Drives the "Unlock Full Access"/"Reveal Answers"/"Unlimited Lifelines" inline buttons in `app.js` (2 spots), `challenge.js` (2 spots), `survival.js` (2 spots) — all gated `!isPremiumUser() && isDesktopWeb()`, so all hidden for the premium app.
- `remove-ads.html` / `assets/remove-ads.js` — page now branches on native-Android: `#raWebOffer` (the existing $2.99/30-day web offer, benefits list, code activation) is hidden and replaced with `#raAppOffer` (one line of copy + one button to the Play Store premium listing) specifically for native Android app visitors (`_raIsNative() && /android/i.test(UA)`). Everyone else (web, iOS app, desktop) sees the page unchanged.
- Also discovered in passing: the existing $2.99/30-day web code-unlock (`isPremiumUser()` / `adsRemovedUntil` localStorage) **does not actually remove ads inside the existing free Capacitor app** — `adMobInit()` in `admob.js` never checks it. It's a web-browsing-only benefit despite `remove-ads.html`'s copy living on a page also reachable from the app. Not fixed, just noted — the premium-app work routes around it entirely rather than patching that gap.

**Architecture fact this all rests on:** `capacitor.config.json` → `server.url: "https://triviagauntlet.app"` — the free Capacitor app loads the live site directly, not bundled assets. Any JS/HTML pushed to `main` goes live instantly for every install of every app pointing at that URL (confirmed via `gh api repos/Hptrivia/quiz/pages` — GitHub Pages serves straight from `main` root), no store review. Same is true for the premium app once repointed. This is what makes the UA-tag approach a single-deploy fix for both apps, but also means a bad shared-JS push breaks gameplay everywhere at once.

**To resume:** confirm whether user found the original keystore/project for the Premium app, or needs the Play Console upload-key-reset flow. Once the native edits are made and a build is produced, verify: no ads/banner, no Remove Ads entry points visible anywhere, no question limits, no Unlock Full Access upsells — then commit + push the five held-back web files together with confirmation the app build actually works.

**2026-08-23 addendum:** install/open Telegram tracking added for this app (and its iOS twin) — see [[project_install_tracking_supabase]] for the full mechanism. Confirmed via `git log -S` that this app is genuinely not Capacitor (an earlier session's stale code comment had wrongly claimed otherwise; corrected).

See also [[feedback_direct_plain_answers]], [[feedback_stepwise_terse_guidance]], [[feedback_verify_before_asserting]], [[project_ios_premium_app]] (the iOS counterpart, built 2026-08-23), [[project_install_tracking_supabase]].
