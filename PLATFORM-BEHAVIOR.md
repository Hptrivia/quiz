# Platform Behavior Reference

Source-of-truth matrix for how Trivia Gauntlet behaves across platforms. Pulled
from the code on **2026-06-07**. Update this whenever gating / ads / CTAs change.

> **Note on "platforms":** the native app is Capacitor, which only builds for
> **iOS and Android** — there is **no desktop app**. So the five real surfaces are
> **iOS app, Android app, iOS web, Android web, desktop web**. ("Desktop app" in the
> original request is treated as not existing.)

---

## 1. How each platform is detected

| Check | True when | Defined in |
|---|---|---|
| `isInApp()` / `_isNative` | Running inside Capacitor native app (iOS or Android) | admob.js / profile.js |
| `isIosWeb()` | iPhone/iPad/iPod UA **and not** native | profile.js |
| `isAndroidWeb()` | Android UA **and not** native | profile.js |
| `isDesktopWeb()` | **not** native and **not** a mobile UA (incl. most iPads) | profile.js |
| `isPremiumUser()` / `_isPremium()` | `localStorage.adsRemovedUntil` is a future date (set by unlock code) | app.js / profile.js |
| `isLimitedWeb()` | `!_isNative && !_isPremium()` — i.e. any non-premium browser visitor | profile.js |

**Key idea:** the native app is *never* limited and *never* shows the web banner/walls.
All gating lives behind `isLimitedWeb()`. Unlocking full access (a valid code) flips
`isLimitedWeb()` to false, so an unlocked web user behaves like the app.

---

## 2. Cross-cutting: Unlock Full Access

- **Mechanism:** `remove-ads.html` + `remove-ads.js`. Enter the shared `VALID_CODE`
  → sets `adsRemovedUntil = now + 30 days` → `isPremiumUser()` / `_isPremium()` true.
- **Where the *paid* unlock is offered inline:** **desktop web only** (the paywall's
  third option, $2.99/mo via Ko-fi). Mobile web is intentionally *not* offered the
  paid unlock — it's pushed to download the free app instead.
- **The code itself works on any platform** if entered on `remove-ads.html`.
- **Effect once premium (web):** no limits, no banner, no walls, no desktop upsell CTAs.

---

## 3. Static pages — homepage / category / theme pages

| Surface | iOS app | Android app | iOS web | Android web | Desktop web |
|---|---|---|---|---|---|
| **CTA banner** (lobby pages only) — whole banner clickable, copy = "download the free app" | ❌ none | ❌ none | ✅ tap → App Store | ✅ tap → Google Play | ✅ click → same end-of-game wall card (QR + "Unlock all questions"), dismissible |
| **Theme-page Unlock card** (last grid card) | ❌ | ❌ | ❌ | ❌ | ✅ (non-premium) |
| **Footer "Unlock Full Access" link** | ❌ | ❌ | ❌ | ❌ | ✅ (non-premium, all pages except remove-ads) |
| **AdMob banner on lobby pages** | ❌ (ads off) | ✅ bottom banner | ❌ | ❌ | ❌ |

- Banner injected by `_injectWebBanner()` only on lobby pages: index/`/`, category.html,
  `/categories/`, `/themes/`, `/wordle/`, `/wordsearch/` hubs — and only when `isLimitedWeb()`.
- Theme unlock card = `_injectThemeUnlockCard()`; footer link = `_injectFooterUnlock()`
  (both desktop-web + non-premium).

---

## 4. Ads present (by platform)

**AdMob mode switch** (`ADMOB_MODE_BY_PLATFORM` in admob.js) — one state per OS:

| Platform | AdMob mode | Meaning |
|---|---|---|
| **iOS app** | `off` | Fully ad-free. No banner/interstitial/rewarded. Set while iOS is pending AdMob approval. To go live: fill `_ADMOB_LIVE_IDS.ios` + set `ios: 'live'`. |
| **Android app** | `live` | Real production units (`_ADMOB_LIVE_IDS.android`) — earns revenue. |
| **iOS / Android / desktop web** | n/a | AdMob only runs inside the native app (`isInApp()`); web never loads it. |

- The three modes: **`off`** = no ads at all · **`test`** = Google sample units (visible
  "Test Ad" badge, earns nothing) · **`live`** = real units (only after AdMob approves
  that platform). `ADMOB_ADS_ENABLED = mode !== 'off'`; `ADMOB_TEST_MODE = mode === 'test'`.

| Ad | iOS app | Android app | iOS web | Android web | Desktop web |
|---|---|---|---|---|---|
| **AdMob banner** (lobby/result screens) | ❌ | ✅ | ❌ | ❌ | ❌ |
| **AdMob interstitial** (on game start) | ❌ | ✅ once/mode/session, 20-min cooldown | ❌ | ❌ | ❌ |
| **AdMob rewarded** (Next Round / lifelines) | ❌ (proceeds free) | ✅ | ❌ | ❌ | ❌ |
| **Adsterra 300×250** (Daily Trivia result only) | ⚠️ ✅ | ⚠️ ✅ | ✅ | ✅ | ✅ |

- **iOS app = fully ad-free** (`ADMOB_MODE_BY_PLATFORM.ios = 'off'`, pending AdMob
  approval). `data-rewarded-href` buttons just navigate (no ad gate).
- **Android app = `'live'`** (real units). Banner hidden on game pages, shown on lobby
  + result screens. Interstitial fires once per mode per session (sessionStorage key)
  with a 20-min cross-app cooldown. Rewarded gates "Next Round" (marathon: every round;
  challenge: every 3rd round) and "Next Word" (wordle: every 2nd) and lifelines.
- **Web = no AdMob at all.**
- ⚠️ **Quirk:** the Daily Trivia result Adsterra ad (daily.js) is gated only by
  `!isPremiumUser()`, **not** by platform — so it also renders inside the native
  app webview. On iOS app it's the *only* ad shown. Flag if undesired.

---

## 5. Question gating / limits (web, non-premium)

Native app (iOS + Android) and premium web = **no limits at all.** Everything below is
**non-premium web only.**

| Limit | Amount | Reset | Which modes count |
|---|---|---|---|
| **Questions** | 30 | **Desktop web: per-day** · **iOS/Android web: one-time (no reset)** | Marathon, Challenge, Survival (counted at round/game end) |
| **Wordle** | 2 words | Lifetime | Wordle (single + mashup) |
| **Word Search** | 1 | Lifetime | Word Search |
| **Episode** | 1 | Lifetime | Episode |

- **Daily reset is desktop-only** (`_maybeDailyReset` early-returns unless `isDesktopWeb()`).
- **Do NOT count toward any limit / never walled:** Trivia Rush, Versus, Daily Trivia,
  Daily Wordle.
- **Wall copy (questions), set in `webWallHTML`:**
  - Desktop: *"You've used today's 30 free questions 🎉 — Come back tomorrow for 30 more…"* + QR / "Unlock all questions here".
  - iOS/Android web: *"You've played your 30 free questions 🎉 — Download Trivia Gauntlet free for unlimited questions."* + their store button.

---

## 6. End-of-game buttons (per mode)

App (iOS/Android) = unlimited, so the "next" button always shows (Android wraps it in a
rewarded ad; iOS proceeds free). Web non-premium swaps the next button for a wall once
the relevant limit is hit. Desktop adds an extra upsell CTA.

| Mode | Counts toward | Primary next button | Web wall when limited | Desktop-only extra CTA | Other buttons |
|---|---|---|---|---|---|
| **Marathon** (single + mashup) | Questions | Next Round (rewarded in Android app) | Q-limit → questions wall | "Unlock Full Access" → remove-ads | Report a Question · Replay wrong · Try another theme |
| **Challenge** (single + mashup) | Questions | Next Round (rewarded **every 3rd** round, Android) | Q-limit → questions wall | "Reveal Answers" → remove-ads | Report a Question · Reveal-answers toggle · Try another theme |
| **Survival** (single + mashup) | Questions | Play Again | Q-limit → questions wall | "Unlimited Lifelines" → remove-ads | (lifelines mid-game; rewarded in Android app) |
| **Episode** | Episode | Next Episode (rewarded in Android app) | Ep-limit → episodes wall | — | Try another theme |
| **Wordle** (single + mashup) | Wordle | Next Word (rewarded **every 2nd**, Android) | Wordle-limit → Wordles wall | — | 📋 Share · resume/continue |
| **Word Search** | Word Search | Next Grid | WS-limit → Word Searches wall | — | Try another Word Search theme |
| **Trivia Rush** (single + mashup) | nothing | Play Again | never walled | — | Report a Question · Try another theme |
| **Versus** (local 2–4 players) | nothing | Play Again | never walled | — | Reveal-answers toggle · tiebreaker |
| **Daily Trivia** | nothing | See Results | never walled | — | Share · countdown to next · **Adsterra ad** (non-premium, all platforms) |
| **Daily Wordle** | nothing | (board) | never walled | — | Share · countdown to next |

---

## 7. Quick "what's different" summary

- **iOS app vs Android app:** identical *except ads* — iOS is fully ad-free (AdMob off,
  pending approval); Android serves live AdMob (banner + interstitial + rewarded). Both
  are unlimited and show no web banner/walls. (Both still render the Daily Trivia Adsterra ad.)
- **iOS web vs Android web:** identical behavior — same one-time 30-question limit, same
  walls; only the store link differs (App Store vs Google Play).
- **Mobile web vs desktop web:** desktop gets *daily-reset* questions (vs one-time on
  mobile), the inline *paid* unlock option + QR, the theme-page Unlock card, the footer
  Unlock link, and the per-mode "Unlock Full Access / Reveal Answers / Unlimited Lifelines"
  CTAs. Mobile web pushes the free app download instead.
- **Any premium (unlocked) web user** behaves like the native app: no limits, no walls,
  no banner, no upsell CTAs.
