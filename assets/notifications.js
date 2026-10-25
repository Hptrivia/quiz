// Local notifications (free Capacitor app only) — daily reminders + streak
// warnings, scheduled on the phone (no server). Loaded by admob.js only when
// the native LocalNotifications plugin exists, so older app builds without
// it skip all of this.
//
// Rescheduled from scratch on every app page load and after every finished
// daily, and only ever up to 3 days ahead — someone who stops opening the
// app gets a few nudges, then silence.

const TGN_IDS = [101, 102, 103, 104];            // 101 = streak warning, 102-104 = daily reminders
const TGN_QUIET_START = 22, TGN_QUIET_END = 9;   // never notify between 22:00 and 09:00 local
const TGN_STREAKS = [
  { key: 'dwStreak',       name: 'Daily Wordle',       url: 'daily-wordle.html' },
  { key: 'dcStreak',       name: 'Daily Trivia',       url: 'daily.html' },
  { key: 'waStreak',       name: 'Who Am I?',          url: 'daily-whoami.html' },
  { key: 'wfStreak',       name: 'Which Came First?',  url: 'daily-order.html' },
  { key: 'dmStreak',       name: 'Daily Mashup',       url: 'daily-mashup.html' },
  { key: 'cbStreak_daily', name: 'Daily Blitz',        url: 'daily-blitz.html' },
];
const TGN_REMINDERS = [
  "🧩 Today's Who Am I? is ready — can you name the famous person in 5 guesses?",
  "🟩 A new Daily Wordle is up. Keep your streak going!",
  "⏳ Which came first? Today's 5 items are waiting to be put in order.",
  "🧠 Today's Daily Trivia is live — 10 fresh questions.",
];

function tgnPlugin() {
  return window.Capacitor?.isPluginAvailable?.('LocalNotifications') ? window.Capacitor.Plugins.LocalNotifications : null;
}
// Player settings (profile → Settings): reminder on/off + hour, streak warnings on/off.
const TGN_HOURS = { 9: 'Morning', 13: 'Afternoon', 18: 'Evening' };
function tgnGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function tgnSettings() {
  const hour = parseInt(tgnGet('tg_notify_hour') || '18', 10);
  return {
    reminder: tgnGet('tg_notify_reminder_off') !== '1',
    streak: tgnGet('tg_notify_streak_off') !== '1',
    hour: TGN_HOURS[hour] ? hour : 18,
  };
}

function tgnUtcKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function tgnPlayedOn(utcKey) {
  try { return localStorage.getItem('tg_daily_played_' + utcKey) === '1'; } catch { return false; }
}
function tgnQuiet(d) { const h = d.getHours(); return h >= TGN_QUIET_START || h < TGN_QUIET_END; }

// Biggest streak that's still alive but needs today's game to survive.
function tgnStreakAtRisk(now) {
  const yesterday = new Date(now); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yKey = tgnUtcKey(yesterday);
  let best = null;
  for (const s of TGN_STREAKS) {
    let st; try { st = JSON.parse(localStorage.getItem(s.key) || 'null'); } catch { st = null; }
    if (st && st.current >= 2 && st.lastCompleted === yKey && (!best || st.current > best.current)) best = { ...s, current: st.current };
  }
  return best;
}

// ~3h before the daily reset (UTC midnight); pulled earlier if that lands in
// the player's local night. null if no sensible time is left today.
function tgnStreakWarnTime(now) {
  const reset = new Date(now); reset.setUTCHours(24, 0, 0, 0);
  for (const hoursBefore of [3, 6, 9, 12]) {
    const t = new Date(reset.getTime() - hoursBefore * 3600000);
    if (t.getTime() > now.getTime() + 10 * 60000 && !tgnQuiet(t)) return t;
  }
  return null;
}

function tgnBuild(now) {
  const list = [];
  const set = tgnSettings();
  const risk = set.streak && tgnStreakAtRisk(now);
  const warnAt = risk && tgnStreakWarnTime(now);
  if (warnAt) {
    list.push({
      id: 101, title: `🔥 ${risk.current}-day streak at risk`,
      body: `Play today's ${risk.name} before the daily reset to keep your streak.`,
      schedule: { at: warnAt, allowWhileIdle: true }, extra: { url: risk.url },
    });
  }
  for (let i = 0; i < 3 && set.reminder; i++) {
    const at = new Date(now); at.setDate(at.getDate() + i); at.setHours(set.hour, 0, 0, 0);
    if (at.getTime() <= now.getTime() + 10 * 60000) continue;
    if (tgnPlayedOn(tgnUtcKey(at))) continue;
    if (warnAt && Math.abs(at.getTime() - warnAt.getTime()) < 4 * 3600000) continue; // one alert a day is enough
    const body = TGN_REMINDERS[Math.floor(at.getTime() / 86400000) % TGN_REMINDERS.length];
    list.push({ id: 102 + i, title: 'Trivia Gauntlet', body, schedule: { at, allowWhileIdle: true }, extra: { url: 'daily-challenges.html' } });
  }
  return list;
}

// Runs one at a time — overlapping calls (page load + finished daily + permission
// granted) would otherwise let one call's cancel wipe another's fresh schedule.
let _tgnChain = Promise.resolve();
function tgnReschedule() {
  _tgnChain = _tgnChain.then(tgnRescheduleNow, tgnRescheduleNow);
  return _tgnChain;
}

async function tgnRescheduleNow() {
  const LN = tgnPlugin();
  if (!LN) return;
  try {
    await LN.cancel({ notifications: TGN_IDS.map(id => ({ id })) });
    const perm = await LN.checkPermissions();
    if (perm.display !== 'granted') return;
    const notifications = tgnBuild(new Date());
    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) {
    console.warn('[notify] reschedule failed', e);
  }
}

// Soft ask first; the one-shot iOS system prompt only appears after "Yes".
function tgnAskOnce() {
  try { if (localStorage.getItem('tg_notify_asked')) return; localStorage.setItem('tg_notify_asked', '1'); } catch { return; }
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  overlay.innerHTML = `<div style="background:#1e1e2e;padding:24px;border-radius:12px;text-align:center;max-width:290px;color:#fff">
    <p style="margin:0 0 6px;font-size:1.1em"><strong>Never lose a streak 🔥</strong></p>
    <p style="margin:0 0 16px;font-size:.95em;opacity:.85">Get a reminder when new puzzles drop and before your streak runs out. Max one a day.</p>
    <button id="_tgnYes" style="margin-right:8px;padding:10px 18px;border-radius:8px;background:#6c63ff;color:#fff;border:none;font-size:1em">Yes please</button>
    <button id="_tgnNo" style="padding:10px 18px;border-radius:8px;background:#444;color:#fff;border:none;font-size:1em">No thanks</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#_tgnNo').onclick = () => {
    overlay.remove();
    if (typeof gtag === 'function') gtag('event', 'notify_prompt', { choice: 'no' });
  };
  overlay.querySelector('#_tgnYes').onclick = async () => {
    overlay.remove();
    let granted = false;
    try { granted = (await tgnPlugin().requestPermissions()).display === 'granted'; } catch {}
    if (typeof gtag === 'function') gtag('event', 'notify_prompt', { choice: granted ? 'granted' : 'denied' });
    tgnReschedule();
  };
}

// Called by every daily's finish handler (next to its daily_finished event).
function tgNotifyDailyFinished() {
  if (!tgnPlugin()) return;
  try { localStorage.setItem('tg_daily_played_' + tgnUtcKey(new Date()), '1'); } catch {}
  tgnReschedule();
  setTimeout(tgnAskOnce, 2500); // after the result screen has had a moment
}

// Profile → Settings → Notifications (#notifyRow in profile.html). Hidden
// everywhere except app builds that have the plugin.
async function tgnSettingsChange(change) {
  try {
    if ('reminder' in change) change.reminder ? localStorage.removeItem('tg_notify_reminder_off') : localStorage.setItem('tg_notify_reminder_off', '1');
    if ('streak' in change) change.streak ? localStorage.removeItem('tg_notify_streak_off') : localStorage.setItem('tg_notify_streak_off', '1');
    if ('hour' in change) localStorage.setItem('tg_notify_hour', String(change.hour));
    localStorage.setItem('tg_notify_asked', '1'); // they've found the settings — no need for the pop-up
  } catch {}
  const set = tgnSettings();
  // Turning something on without OS permission yet → ask now (iOS shows its prompt once).
  if (set.reminder || set.streak) {
    try { if ((await tgnPlugin().checkPermissions()).display !== 'granted') await tgnPlugin().requestPermissions(); } catch {}
  }
  if (typeof gtag === 'function') gtag('event', 'notify_settings', { reminder: set.reminder, streak: set.streak, hour: set.hour });
  tgnRenderSettings();
  tgnReschedule();
}

async function tgnRenderSettings() {
  const row = document.getElementById('notifyRow');
  if (!row) return;
  row.style.display = '';
  const set = tgnSettings();
  let blocked = false;
  try { blocked = (await tgnPlugin().checkPermissions()).display === 'denied'; } catch {}
  const btn = (id, on) => { const b = document.getElementById(id); if (b) b.textContent = on ? 'Turn Off' : 'Turn On'; };
  btn('notifyReminderBtn', set.reminder);
  btn('notifyStreakBtn', set.streak);
  document.getElementById('notifyHourRow').style.display = set.reminder ? '' : 'none';
  document.querySelectorAll('#notifyHourRow [data-hour]').forEach(b => b.classList.toggle('selected', +b.dataset.hour === set.hour));
  document.getElementById('notifyBlocked').style.display = blocked && (set.reminder || set.streak) ? '' : 'none';
}

function tgnWireSettings() {
  if (!document.getElementById('notifyRow')) return;
  document.getElementById('notifyReminderBtn').onclick = () => tgnSettingsChange({ reminder: !tgnSettings().reminder });
  document.getElementById('notifyStreakBtn').onclick = () => tgnSettingsChange({ streak: !tgnSettings().streak });
  document.querySelectorAll('#notifyHourRow [data-hour]').forEach(b => { b.onclick = () => tgnSettingsChange({ hour: +b.dataset.hour }); });
  const testBtn = document.getElementById('notifyTestBtn');
  if (testBtn) testBtn.onclick = async () => {
    const LN = tgnPlugin();
    try {
      if ((await LN.checkPermissions()).display !== 'granted') await LN.requestPermissions();
      await LN.schedule({ notifications: [{
        id: 199, title: 'Trivia Gauntlet', body: "Notifications are working 🎉 We'll remind you before your streak runs out.",
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { url: 'daily-challenges.html' },
      }] });
      document.getElementById('notifyTestMsg').style.display = '';
      if (typeof gtag === 'function') gtag('event', 'notify_test');
    } catch (e) { console.warn('[notify] test failed', e); }
    tgnRenderSettings();
  };
  tgnRenderSettings();
}

(function tgnInit() {
  const LN = tgnPlugin();
  if (!LN) return;
  LN.addListener('localNotificationActionPerformed', (a) => {
    const url = a?.notification?.extra?.url;
    if (typeof gtag === 'function') gtag('event', 'notify_open', { id: a?.notification?.id });
    if (url) window.location.href = '/' + url;
  });
  // ?testnotify=1 — fires a test notification 10s later (for checking a new build).
  if (new URLSearchParams(window.location.search).get('testnotify') === '1') {
    LN.requestPermissions().then(() => LN.schedule({ notifications: [{
      id: 199, title: 'Trivia Gauntlet', body: 'Test notification — it works! 🎉',
      schedule: { at: new Date(Date.now() + 10000) }, extra: { url: 'daily-challenges.html' },
    }] })).catch(e => console.warn('[notify] test failed', e));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tgnWireSettings);
  else tgnWireSettings();
  tgnReschedule();
})();
