---
name: project-ios-premium-app
description: "iOS counterpart to the Android 'Trivia Gauntlet - Premium' app - plain WKWebView wrapper, built and shipped to TestFlight entirely via GitHub Actions CI, no Mac ever rented"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-23T17:32:04.858Z
  originSessionId: a01c5781-6205-4e3e-924a-50a5c96cb525
---

Built the iOS twin of the Android premium app (see [[project_premium_adfree_app]]) — same UA-tag mechanism, no Capacitor, no in-app purchase. Lives in this `quiz` repo under `ios-premium/` (a separate, standalone Xcode project via XcodeGen — not the existing Capacitor `ios/App/` free-app project).

**Why no Mac was needed:** the whole build/sign/upload pipeline runs on GitHub Actions' `macos-latest` runners (real Xcode, no Mac rental/purchase required). `ios-premium/project.yml` is an XcodeGen spec that generates the `.xcodeproj` at build time (avoids hand-writing a fragile `.pbxproj`). `.github/workflows/build-ios-premium.yml` (manual `workflow_dispatch` trigger) signs with a certificate generated via `openssl` + the Apple Developer Portal, then uploads to TestFlight via `fastlane pilot upload` using an App Store Connect API key. `.github/workflows/test-ios-premium-build.yml` is a signing-free simulator-build smoke test that auto-runs on any `ios-premium/**` push, useful for validating Swift changes before burning a real signed-build run.

**Identity:** Bundle ID `[redacted]`, Team ID `[redacted]`, App Store Connect Apple ID `[redacted]`, app name "Premium Trivia Gauntlet". Cert/provisioning profile issued 2026-08-23, valid 1 year (renew ~Aug 2027).

**Icon:** deliberately not the free app's icon reused as-is — same gauntlet artwork, recolored to a black/gold palette with a diagonal gold "PREMIUM" ribbon across the top-right corner (`ios-premium/Sources/Assets.xcassets/AppIcon.appiconset/`), generated locally with Pillow, not AI image-gen.

**Known accepted risk:** Apple App Store Review Guideline 4.3(a) "Spam" explicitly discourages a free + paid twin app with identical functionality (unlike Play Store, which doesn't enforce this — the Android pair already lives there fine). User was told this directly and **chose to risk submission as-is** rather than pivot to native StoreKit 2 in-app purchase inside the single free iOS app. If Apple rejects it on 4.3, the discussed fallback is StoreKit 2's local synchronous `Transaction.currentEntitlements` check — not RevenueCat again, since RevenueCat's async entitlement caching was the actual root cause of the ad-flicker bug that killed the original IAP approach ([[project_revenuecat_remove_ads]]), not IAP itself.

**Status as of 2026-08-23:** first fully green signed build succeeded and uploaded to TestFlight (GitHub Actions run `32646949126`). **Not yet verified** on a real device — user still needs to open it via TestFlight and confirm: no ads/banners, no "Remove Ads" entry points, no question limits, no "Unlock Full Access" upsells, site loads correctly. **Not yet submitted** to App Store review.

**To resume:** check TestFlight processing status / ask user if they tested it yet. If clean, next step is submitting for App Store review from App Store Connect. If Apple flags 4.3 spam on review, revisit the StoreKit 2 fallback above.

**2026-08-23 addendum:** install/open Telegram tracking added — see [[project_install_tracking_supabase]].

See also [[feedback_github_actions_dispatch_vs_rerun]], [[feedback_verify_before_asserting]], [[feedback_stepwise_terse_guidance]], [[project_install_tracking_supabase]].
