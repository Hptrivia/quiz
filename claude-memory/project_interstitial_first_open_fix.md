---
name: project-interstitial-first-open-fix
description: "Live trial (started 2026-08-18) suppressing the interstitial on a new install's first game open; compare revenue after 1-2 weeks"
metadata: 
  node_type: memory
  type: project
  originSessionId: 25ae91e1-1265-4797-bcbc-a6b84e3548c8
  modified: 2026-08-18T05:53:36.183Z
---

**Status: LIVE as of 2026-08-18** (pushed in commit 66a7f137, main). Give brand-new
installs one ad-free first open, because Reddit users reported opening the app,
seeing the first interstitial, and bouncing. iOS is back to `ios: 'live'` (test mode
was only used briefly on-device to confirm the fix worked, then flipped back).
User wants to run this 1-2 weeks (roughly through 2026-09-01) and then compare
revenue numbers against the baseline below before deciding whether to keep it.

**Where it goes:** `adMobInit()` in `assets/admob.js`, at the
`showInterstitialFirst` computation (~line 151-153).

**The fix (verified design, first attempt was buggy):**
```js
const isGameStart = getRoundStartParams();
const isFirstEverOpen = isGameStart && !localStorage.getItem('_iadFirstOpenDone');
if (isFirstEverOpen) localStorage.setItem('_iadFirstOpenDone', '1');
const showInterstitialFirst = isGameStart && !sessionStorage.getItem(_modeKey)
  && !_interstitialOnCooldown() && !isFirstEverOpen;
```

**Why the first attempt failed the on-device test:** the flag was set unconditionally
at the top of `adMobInit()`, which runs on *every* page load. The home/menu page
consumed the one-time flag before the user ever reached a game, so a fresh install
still saw an interstitial on Daily Trivia. Gating on `isGameStart` fixes it. The
`localStorage` once-per-install pattern itself is sound — it mirrors the existing
`_installPinged` guard in the same file.

**Deploy facts (confirmed):** `capacitor.config.json` sets
`server.url = https://triviagauntlet.app`, so the native app loads JS live from the
site — pushing to `main` (GitHub Pages, no build workflow) ships to users
immediately, no App Store binary. Testing a fresh-install path requires
uninstall/reinstall to clear `localStorage`.

**Cost of the experiment:** one interstitial impression per new install, one time —
not an ongoing loss. Baseline for judging it (28d): [revenue baseline figures redacted]

**Plan:** compare 28d revenue after the trial period against the baseline above; if
the hit isn't worth it, revert with `git revert 66a7f137` (or restore the
pre-experiment `assets/admob.js` from before commit `4f9cfab6`).

Related: [[feedback-verify-before-asserting]], [[user-trivia-gauntlet-owner]]
