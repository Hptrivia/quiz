# Remove Ads (RevenueCat) — Status

Native in-app "Remove Ads" purchase via RevenueCat, for the Capacitor app. Android first — no Mac/iOS device available yet, iOS is fully deferred. Separate from the existing web-only Ko-fi unlock flow (`isDesktopWeb()`-gated, unaffected by this work).

This branch (`remove-ads-android`) is intentionally **not merged into `main`**. This app loads its web content live from `https://triviagauntlet.app` at runtime (`capacitor.config.json` → `server.url`, not a bundled local copy), and GitHub Pages auto-deploys `main` on push — so merging before this is finished would put an untested, half-wired "Remove Ads" UI in front of real users immediately.

## External account state (not in this repo — RevenueCat/Google dashboards)

- RevenueCat project already existed; Android app added to it (package `com.trivia.trivia_gauntlet`)
- Google Cloud project `trivia-gauntlet-play`; service account `revenuecat-service-account@trivia-gauntlet-play.iam.gserviceaccount.com`, created via RevenueCat's automated Cloud Shell script, granted Play Console access (View app info, View financial data, Manage orders/subscriptions), key uploaded to RevenueCat and validated
- Play Console products: `remove_ads_monthly` (subscription, €2/mo) and `removeads00` (one-time non-consumable, €10, "permanent") — both Active
- RevenueCat entitlement `no_ads` created (there's also a leftover "Trivia Gauntlet Premium" entitlement with fake "Test Store" products — auto-generated demo boilerplate from account creation, unrelated, left alone, safe to ignore)
- Both products attached to `no_ads`
- Offering `default` has packages: `$rc_monthly` → `remove_ads_monthly`, `$rc_lifetime` → `removeads00`. `$rc_annual` left as "No product" for Play (no yearly product, intentional). Old Test Store demo packages (Monthly/Yearly/Lifetime) still sitting unused in this offering — harmless, can delete later
- Android public SDK API key is in code (`assets/admob.js`, `RC_API_KEYS.android`)

## Code changes on this branch

**`assets/admob.js`**
- `RC_API_KEYS` (android only — no `ios` key yet, so RevenueCat is a complete no-op on iOS for now), `RC_ENTITLEMENT_ID = 'no_ads'`, `RC_CACHE_KEY`
- `isAdsRemoved()` — cache-first localStorage check; everything else gates on this
- `rcInit()` — calls `Purchases.configure()` on app boot, fetches/caches entitlement status, listens for changes. Note: `addCustomerInfoUpdateListener`'s callback receives the `CustomerInfo` object directly, not wrapped in `{customerInfo}` (verified against the installed SDK's `.d.ts` files)
- `rcPurchasePackage()`, `rcRestorePurchases()`, `rcGetOfferings()` — used by the paywall page. `offering.monthly` / `offering.lifetime` are real shortcut fields on `PurchasesOffering`; price string is `pkg.product.priceString`
- Existing ad code (`adMobInit()`, `injectRevealMissedButton`, the reward-gated link click handler) now gated behind `isAdsRemoved()`
- `injectRemoveAdsThemeCard()` — appends a "Remove Ads" card to the mode grid on theme pages. Theme pages are static HTML generated from one build template (100+ files), so this is injected at runtime (`.panel > .grid` selector) rather than editing the template. Links to `/remove-ads.html` (absolute root path, since the app loads from the live domain regardless of page depth)
- `_offerRewardedLifeline()` (the "Watch Ad" popup for lifelines/reveal-answers/next-round) has a third "Remove Ads Instead" button

**`remove-ads.html` / `assets/remove-ads.js`**
- Added `<script src="assets/admob.js">` (page was previously desktop-web-only, didn't need it)
- Existing Ko-fi/QR/PWA/code-activation content wrapped in `#raWebContent`; new `#raAppContent` block added (title "Remove Ads", 3-bullet benefit list, price buttons, Restore Purchases), toggled by `isInApp()` via new `initAppPaywall()`
- Prices pulled live from `rcGetOfferings()`, not hardcoded

**`assets/survival.js` + `assets/wordle.js`**
- Lifeline/next-word UX cleanup for ad-free users: previously, re-using 50-50/Call a Friend/Wordle's "Next Word" after the free use always opened a "Watch a short ad?" popup that — due to existing fail-open logic — granted the reward even when no ad played. Confusing for someone who paid specifically to not see ads. Now checks `isAdsRemoved()` first and grants instantly with no popup; button labels drop the "(Watch Ad)" suffix too.

## Not done yet

- **Feature flag / hidden unlock** — discussed (e.g. a `REMOVE_ADS_LIVE` boolean gating the two visible entry points, or a tap-5x-on-footer hidden unlock) so this can be merged to `main` invisibly and tested on a real device before fully exposing it. Discussed, not built.
- **No real device/emulator testing at all.** No Android build has included the native RevenueCat plugin yet — nothing's been published to Play Store since 2026-06-04, when the RevenueCat dependency was first added to the repo.
- **Never confirmed the RevenueCat `default` offering is marked "current".** Asked the user to check; they said "done" without confirming that specific flag. If it's not current, `getOfferings()` returns null and the paywall dead-ends.
- **Play Console License Testing not set up** (Setup → License testing) — needed so test purchases don't charge real money.
- **Google Play Real-Time Developer Notifications (RTDN) not set up** — separate step from the service-account credentials done earlier. RevenueCat provides a Pub/Sub topic to paste into Play Console's Monetization setup. Not a hard blocker for a first test purchase, but needed before a real launch so subscription renewal/cancellation state syncs promptly.
- **No Terms/Privacy links on the app paywall.** Google Play policy for subscriptions expects clear terms/cancellation info directly on or near the purchase screen. Worth adding before any real store review.
- **No build uploaded to Play Console Internal Testing track yet.**
- **iOS fully deferred** — no `ios` key in `RC_API_KEYS`, App Store Connect setup not started.

## To resume

1. `git checkout remove-ads-android` (or branch off it if `main` has since moved)
2. Add the feature flag / hidden unlock first, so merging to `main` is safe
3. Confirm the `default` offering is current in RevenueCat
4. Add license testers in Play Console
5. Build & upload to Internal Testing (this also gets the native plugin into a testable build for the first time)
6. Set up RTDN
7. Test the full purchase + restore flow for real
8. Add Terms/Privacy links to the paywall
9. Only then consider merging to `main` / production release
