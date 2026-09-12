---
name: project-revenuecat-remove-ads
description: "ABANDONED 2026-08-22 — RevenueCat in-app purchase for ad removal, replaced by a separate paid app (see project-premium-adfree-app)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3a5eeff6-27bf-498d-9edf-58770b50a511
  modified: 2026-08-23T08:42:52.328Z
---

**ABANDONED 2026-08-22.** A real device test showed ads flickering on/off for paying users — root cause: `isAdsRemoved()` was checked synchronously in a dozen call sites, but the actual entitlement came from an async RevenueCat network call on boot, cached only once it returned, so different pages/popups caught the state at different points in that race. Fully reverted the same day: `RC_API_KEYS`, `rcInit`, `rcPurchasePackage`, `rcRestorePurchases`, `isAdsRemoved`, the app-paywall UI in `remove-ads.html`/`remove-ads.js`, and all their call sites are gone from the codebase. Current approach is a separate ad-free Android app sold as a one-time Play Store purchase instead — see [[project_premium_adfree_app]] for the live plan. Everything below this line is historical context only; do not treat any of it as current code state.

Building a native "Remove Ads" purchase (RevenueCat) for the Capacitor app, separate from the existing web-only Ko-fi unlock flow. Android first — user has no Mac/iOS device yet, iOS setup deferred.

**External account state (not derivable from repo):**
- RevenueCat account/project already existed before this work started; Android app was added to it (package `com.trivia.trivia_gauntlet`)
- Google Cloud project `[GCP project name redacted]` created; service account `[service-account email redacted]` created via RevenueCat's automated Cloud Shell script, granted Play Console access (View app info, View financial data, Manage orders/subscriptions), key uploaded to RevenueCat and **validated** (unusually fast — normally 24-36h)
- Play Console products already created by user: `remove_ads_monthly` (subscription, [price redacted]/mo) and `removeads00` (one-time non-consumable, [price redacted], "permanent")
- RevenueCat entitlement `no_ads` created (NOT the pre-existing "Trivia Gauntlet Premium" entitlement, which turned out to be leftover demo/boilerplate content auto-generated in the project — has fake "Test Store" products, unrelated, left alone)
- Both products attached to `no_ads` entitlement
- Offering `default` (RevenueCat's default/current offering) has packages: `$rc_monthly` → `remove_ads_monthly`, `$rc_lifetime` → `removeads00`, `$rc_annual` left as "No product" for Play (no yearly product exists, intentional). Old Test Store demo packages left in place, harmless clutter, can be deleted later
- Android public SDK API key: `goog_ibOMKMipvgcZhewTvXnliZnxXsC` (already in code, see below)

**Code status: full first pass built, not yet tested on a device/emulator.**

`assets/admob.js`:
- `RC_API_KEYS` (android key only, no ios entry yet — RC is a no-op on iOS until that key is added), `RC_ENTITLEMENT_ID = 'no_ads'`, `RC_CACHE_KEY`
- `isAdsRemoved()` — cache-first localStorage check, everything else gates on this
- `rcInit()` — calls `Purchases.configure()` on app boot (from `_bootInApp()`), fetches/caches entitlement status. `addCustomerInfoUpdateListener`'s callback receives the `CustomerInfo` object directly (NOT wrapped in `{customerInfo}` — verified against `node_modules/@revenuecat/purchases-typescript-internal-esm/dist/callbackTypes.d.ts`, this was a bug in the first draft, fixed)
- `rcPurchasePackage()`, `rcRestorePurchases()`, `rcGetOfferings()` — used by the paywall page (below). `offering.monthly` / `offering.lifetime` are real shortcut fields on `PurchasesOffering` (confirmed in `dist/offerings.d.ts`), package price via `pkg.product.priceString`
- Existing ad code gated behind `isAdsRemoved()`: `adMobInit()`, `injectRevealMissedButton`, the "watch ad to continue" link-interception click handler
- `injectRemoveAdsThemeCard()` — appends a "Remove Ads" card to the mode grid on theme pages (`.panel > .grid`, selected that way since theme pages are static, generated from one build template — editing ~100+ generated files wasn't practical, so injection happens at runtime instead), links to `/remove-ads.html` (absolute root path — app loads from `https://triviagauntlet.app` per `capacitor.config.json`, so this resolves correctly regardless of page depth). Called from `_bootInApp()`
- `_offerRewardedLifeline()` (the "Watch Ad" popup used for lifelines/reveal-answers/next-round) now has a third "Remove Ads Instead" button linking to `/remove-ads.html`

`remove-ads.html` / `assets/remove-ads.js`:
- Added `<script src="assets/admob.js">` (wasn't loaded there before — page was previously desktop-web-only)
- Existing Ko-fi/QR/PWA/code-activation content wrapped in `#raWebContent`; new `#raAppContent` block added (title "Remove Ads", 3-bullet benefit list, price buttons, Restore Purchases), toggled by `isInApp()` in a new `initAppPaywall()` function
- Prices are pulled live from `rcGetOfferings()`, not hardcoded

`assets/survival.js` + `assets/wordle.js` — lifeline/next-word UX cleanup for ad-free users: previously, re-using 50-50/Call a Friend/Wordle's "Next Word" after the free use always opened a "Watch a short ad?" popup that (due to existing fail-open logic) granted the reward even if no ad played — confusing for someone who paid specifically to not see ads. Now checks `isAdsRemoved()` first and grants instantly with no popup; button labels drop the "(Watch Ad)" suffix too.

**Where the code lives:** committed on branch `remove-ads-android` (commit `bb389651`), pushed to `origin/remove-ads-android` on GitHub as of 2026-08-20. Deliberately NOT merged into `main` yet — `main` is clean and matches production. Reason: this app loads its web content live from `https://triviagauntlet.app` at runtime (`capacitor.config.json` `server.url`, not a bundled local copy) and GitHub Pages auto-deploys `main` on push, so merging to `main` would make the (untested, half-wired) "Remove Ads" UI visible to real users immediately — merge only after the items below are done.

**2026-08-20 update:** Built the feature-flag approach — `REMOVE_ADS_LIVE = false` const added in `assets/admob.js` (right after `RC_CACHE_KEY`). Entry points (theme card, "Remove Ads" popup button — label trimmed from "Remove Ads Instead") stay visible on both platforms — not platform-gated, and iOS already no-ops via missing `RC_API_KEYS.ios` so the same behavior applies there for free. When the flag is off, `initAppPaywall()` in `assets/remove-ads.js` calls a new `showComingSoon()` instead of hitting `rcInit()`/`rcGetOfferings()` at all: shows a "Coming soon" message, planned pricing text (static, not live-fetched: "[pricing figures redacted]"), and a two-way interest vote — checkbox "🔔 I'm interested" plus a small "Not interested" link, both writing `localStorage['_removeAdsVote']` ('yes'/'no', persists so repeat visits show the recorded answer instead of re-asking) and firing `gtag('event', 'remove_ads_interest')` / `gtag('event', 'remove_ads_not_interested')`. Site already has GA4 (`gtag`, property `[redacted]`) wired into `remove-ads.html` — check Reports → Realtime for immediate counts, or Reports → Engagement → Events (24-48h lag) going forward; no backend needed. Also added a terms/cancellation disclosure paragraph (links to `terms.html`/`privacy.html`) below the paywall content per Play subscription policy.

Once this flag is in place, merging the branch to `main` is safe even though the purchase flow itself is still untested on a device — no more open blocker on that front. Flip `REMOVE_ADS_LIVE` to `true` only after a real device purchase test succeeds.

**Coverage audit (2026-08-20):** did an exhaustive grep across every rewarded-ad trigger in the app (`adMobShowRewarded` callers, all "Watch a short ad" strings, `_offerRewardedLifeline` callers, every `rewardedHref`/`rewardGate` producer incl. camelCase `dataset.rewardedHref` assignments, not just the literal HTML attribute). Confirmed covered via the shared `_offerRewardedLifeline` popup (has the Remove Ads button + `isAdsRemoved()` skip already): main quiz + Mashup Next Round/Replay (`app.js`, `challenge.js` — replay routes through the same `data-rewarded-href` mechanism as Next Round, already fine), Episode mode Next Episode (`episode.js`), Word Search Next Word (`wordsearch.js`), Wordle lifelines/next word (`wordle.js`, calls it directly), Reveal Missed Answers on results screens, Survival 50/50 + Call a Friend (`survival.js`).

Found NOT covered: **Trivia Rush** (`trAdOffer()`/`trMidBreak()` in `trivia-rush.js`) and **Versus** (midpoint ad popup in `versus.js`) — both had their own hand-rolled "Watch a short ad to continue?" overlay calling `adMobShowRewarded()` directly, no Remove Ads button, no `isAdsRemoved()` check at all (meaning a paying user would still get interrupted there once purchases go live). Fixed same session: extended `_offerRewardedLifeline(name, onEarned, promptHtml, onCancel)` in `admob.js` with an optional `onCancel` param (backward compatible, all other callers unaffected), then rewired both `trMidBreak()` and the Versus midpoint check to call the shared popup with `isAdsRemoved()` pre-checks, deleting their custom overlay code entirely. `onCancel` preserves their original "decline → end the game/round" behavior (`trEnd(false)` / `vsShowResults()`).

All of the above is committed locally on `remove-ads-android`, **still not pushed to origin** — branch is 4 commits ahead of `origin/remove-ads-android`. User explicitly said to hold off and decide tomorrow (2026-08-21) whether to push. Do not push without asking again. Commits (newest first): "Route Trivia Rush + Versus mid-game ad prompts through shared rewarded-lifeline popup", "Add terms/cancellation disclosure to app paywall, rework interest vote to yes/no", "Simplify Remove Ads button label, show planned pricing on Coming Soon screen", "Gate Remove Ads paywall behind REMOVE_ADS_LIVE flag, show Coming Soon + interest checkbox" (on top of the original "WIP: RevenueCat groundwork" commit `bb389651`).

**2026-08-21 update — merged to main, went live (flag still off), UI polish, build in progress:**

Pushed `remove-ads-android` to origin (4 commits) and fast-forward merged into `main` (no conflicts, main hadn't diverged) → pushed to `origin/main` → **live on triviagauntlet.app** via GitHub Pages. `REMOVE_ADS_LIVE` is still `false` in production, so real users currently only see the entry points + Coming Soon/interest-vote page, never a real purchase flow. Confirmed live content matches source via direct `curl` of the deployed URLs.

iOS AdMob (`ADMOB_MODE_BY_PLATFORM.ios` in `admob.js`) was briefly flipped `'live' → 'test'` so the user could verify iOS ad behavior on-device without spending real ad units, then flipped back to `'live'` same session per their request. Currently `'live'`.

UI polish this session (all pushed to main, all in `remove-ads.html` / `assets/remove-ads.js` / `assets/admob.js`):
- Collapsed the 3-bullet benefits list into one top line: "No ads. No interruptions. Lifelines work instantly — nothing to watch."
- Fixed the auto-renew disclaimer, which said "Google Play subscriptions" only (leftover from when this was Android-only) → now "App Store (iOS) or Google Play (Android) subscriptions"
- Added a "(Coming Soon)" badge next to the `<h1>` title (`#raComingSoonBadge`, hidden by default, shown inside `showComingSoon()`) — user wanted this visible at the top, not buried in body text
- Replaced the checkbox + tiny "Not interested" link with two equal-weight buttons (`#raInterestBtn` / `#raNotInterestedBtn`, `.secondary-btn` class) — user felt the old checkbox was too small/easy to miss
- Restyled the "Remove Ads" button inside the rewarded-ad popup (`_offerRewardedLifeline` in `admob.js`) from a low-contrast purple outline-on-dark-purple to a solid green filled button (matches the "GO AD-FREE" badge color used on the theme-page card) — user said the old one was "blurred and misseable"
- Added `injectRemoveAdsFooterLink()` in `admob.js` — puts a "Remove Ads" link into the standard `.footer-links` block on every in-app page that loads `admob.js` (all gameplay screens + all generated theme/category/wordle/wordsearch pages, via `_bootInApp()`). Styled with the site's existing `.footer-highlight` class (light blue `#93c5fd`, bold, underlined) and placed **first** in the footer row via `.prepend()` per user request (not last). Deliberately **not** added to About/How It Works/Blog/Contact — those don't load `admob.js` at all; user confirmed leaving them out rather than wiring ad/purchase JS into pure content pages.

**Pricing decision:** user asked whether the [price redacted] one-time purchase should be "forever" or "yearly." Recommended keeping **forever** — the Play Console product `removeads00` is already built as a one-time non-consumable (switching to yearly means rebuilding it as a subscription product type), and a low-friction one-time price converts price-sensitive users who'd never subscribe, while heavier users naturally pick the [price redacted]/month plan instead. User didn't push back; treat as settled unless revisited.

**Tester-only paywall override — proposed, not built yet.** Since the app loads its JS live from the site (not bundled), flipping `REMOVE_ADS_LIVE` to `true` would expose the untested real purchase UI to every installed user instantly, not just the tester. Proposed design: a `?testpaywall=1` URL param on `remove-ads.html` sets `localStorage['_paywallTestOverride'] = '1'` (persists per-device, survives restarts, clears on uninstall); `initAppPaywall()`'s `REMOVE_ADS_LIVE` gate would then also bypass to the real flow when that override is set. **Not implemented** — came up in conversation but no explicit go-ahead was given to build it yet. Needed before any real on-device purchase test.

**Delivery mechanism for the override link — user's decision (2026-08-21):** rather than any visible button/menu entry, hide the `?testpaywall=1` link as a normal-looking hyperlink on an inconspicuous word inside the body text of one of the blog post pages (e.g. `why-wordle-became-so-popular.html` or similar) — user's reasoning: "no one will likely check that." Not implemented yet — need to pick the specific post + word once the override itself is built.

**Build verification done this session (code-side):**
- Confirmed the RevenueCat Android plugin is already registered in `android/capacitor.settings.gradle` + `android/app/capacitor.build.gradle` (synced into the native project at some point before this session).
- Confirmed `applicationId "com.trivia.trivia_gauntlet"` matches Play Console.
- Confirmed no manual `com.android.vending.BILLING` permission is needed — modern Play Billing Library auto-merges it via manifest merger.
- Confirmed the `AD_ID` permission (`com.google.android.gms.permission.AD_ID`) is already correctly present in the committed `AndroidManifest.xml` with an explanatory comment.

**Live build walkthrough (user's Windows laptop, path `C:\Users\RASHEED\quiz\quiz`, in Android Studio):**
1. `git pull` initially blocked by a local uncommitted duplicate of the `AD_ID` permission line in `AndroidManifest.xml` (functionally redundant with the already-correct committed version) — resolved via `git checkout -- android/app/src/main/AndroidManifest.xml`, then pull succeeded.
2. `npm install` — clean, "up to date," 121 packages (includes `@revenuecat/purchases-capacitor` per `package.json`). Reported 2 audit vulnerabilities (`brace-expansion` high, `tar` critical) — both are dev-tooling/build-time-only transitive deps, not shipped in the app, not urgent; safe non-`--force` fix available via `npm audit fix` but not run.
3. `npx cap sync android` — succeeded, confirmed both plugins picked up: `@capacitor-community/admob@8.0.0` and `@revenuecat/purchases-capacitor@13.1.4`. One harmless warning: `@capacitor/core@8.4.0` vs `@capacitor/android@8.3.4` version mismatch — ignored, not blocking.
4. Bumped `versionCode 10 → 13` and `versionName "1.6" → "1.9"` directly in Android Studio's `build.gradle (Module :app)` (user's choice, more headroom than the minimum needed). **This edit is local-only on the user's laptop as of this writing — not yet reflected back in the GitHub repo.**

**Not done yet:**
- Confirm user still has their original release keystore file + passwords (asked, not yet answered) — required to sign the bundle; a different key would be rejected by Play Console
- Generate the signed AAB in Android Studio (Build → Generate Signed Bundle)
- Build/implement the tester-only paywall override (see above) before any real purchase test
- Play Console **License Testing** not set up (Setup → License testing) — needed so test purchases don't charge real money
- No build/upload to Play Console Internal Testing track yet — required because Play Billing generally only works when installed through Play, not sideloaded
- Google Play **Real-Time Developer Notifications (RTDN)** not set up — not a hard blocker for a first test purchase, needed before real launch
- iOS: still fully deferred (no `ios` key in `RC_API_KEYS`, App Store Connect setup not started) — though the Coming Soon/entry-point UI already works identically on iOS today since it's not platform-gated
- Old "Test Store" demo packages in the RevenueCat `default` offering — harmless, can delete later

**To resume:** already on `main`, already live (flag off). Check in with the user on where the Android Studio build got to — likely mid-way through generating the signed bundle, or waiting on the keystore question.

See also [[feedback_stepwise_terse_guidance]], [[feedback_verify_before_asserting]].
