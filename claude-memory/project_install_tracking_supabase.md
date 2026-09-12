---
name: project-install-tracking-supabase
description: "Full picture of the Supabase install-tracking system after the 2026-08-23 cleanup — which tables/views exist, what each is for, and the new premium-app tracking"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-23T17:31:46.552Z
  originSessionId: e422d189-4f58-4ede-8bb5-ccbb2bdbac2a
---

**Free app** (`supabase/functions/notify-install/`, deployed as edge function `clever-task`):
- `install_counter` — single running-total row (android/ios/other), resets every 10 installs via `bump_install()` RPC, triggers one batched Telegram summary per 10 (`install-counter.sql`).
- `installs_log` — one dated row per install, kept **on purpose** because `daily_promo_dashboard` (a view joining it with `promo_clicks`) computes its per-day "installs" column as `count(*) grouped by day` on this table. No other source has per-day history — `install_counter` resets and keeps no dates. **Do not drop this table** without first checking what depends on it (`drop ... cascade` will silently take dependents down too — this bit us once).
- `install_report` — **deleted 2026-08-23**. Was a pure duplicate view of `installs_log` with no independent purpose (why it grew to 11 pages of dashboard clutter for nothing). Safe removal precedent: `drop view if exists install_report;` — the table and `daily_promo_dashboard` were untouched.
- Ping site: `assets/admob.js` → `_pingNewInstall()`, gated on `isInApp()` (Capacitor only) + a `localStorage` once-per-device flag. Fires from the `DOMContentLoaded` listener at the bottom of the file only when the free app's Capacitor bridge is present.

**Premium apps** (added 2026-08-23, same `clever-task` function): neither premium app (`ios-premium/` Swift WKWebView, external Kotlin Android WebView — see [[project_premium_adfree_app]] and [[project_ios_premium_app]]) uses Capacitor, so `_pingNewInstall()`/`isInApp()` never fired for them — this was the actual reason installs looked untrackable, not a real limitation.
- `_pingPremiumInstall()` in `admob.js` — fires off the `_IS_PREMIUM_APP` UA-tag check alone (no Capacitor dependency), called unconditionally from the same `DOMContentLoaded` listener. Own `localStorage` flag (`_premiumInstallPinged`) so it can't double-fire alongside the free-app ping (moot in practice since they're mutually exclusive apps, but keeps the two counters clean).
- Client sends `{ platform, app: "premium" }`; edge function branches on `app === "premium"` before it ever touches the free-app batching path.
- `premium_install_counter` (`premium-install-counter.sql`) — same singleton-row shape as `install_counter`, bumped via `bump_premium_install()`.
- Unlike the free app, **every** premium install sends its own Telegram message immediately (`📲 [Premium] new iOS install — total premium installs: N`) — no batching, per explicit user request ("less purchases anyway"). Same Telegram chat as the free app, distinguished only by the `[Premium]` prefix (user explicitly didn't want a second chat — extra overhead for no benefit).
- Not yet device-tested as of this writing; caveat given to user: GitHub Pages asset caching may mean a device with an already-cached old `admob.js` needs a force-quit/reopen or a few minutes before the new ping code runs.

See also [[feedback_verify_before_asserting]] (the Capacitor mix-up that happened mid-build) and [[feedback_confirm_before_wide_changes]] (built the first version of this without asking first, had to revert).
