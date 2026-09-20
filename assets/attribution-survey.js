// ── "Where did you find us?" attribution survey ────────────────────────────
// Free native app only (not premium, not web) -- UTM/referrer tracking only
// tells us what people tapped, never where an app-store install actually
// came from, so we just ask. A centered modal on the home screen, shown on
// app-opens #1, #2 and #4 (3 total, one calendar day per "open" so repeat
// opens the same day don't count) until the player answers or runs out of
// attempts. Home-screen-only on purpose --
// firing it after a quiz too would mean touching every result screen across
// several files and interrupting someone right as they want their score, for
// one extra attempt; not worth it over just allowing more app-open tries.
// See supabase/attribution-survey.sql for the table this writes to and a
// ready-made distribution query.
const AS_URL = 'https://avasbapxzgmpcosixgio.supabase.co/rest/v1/attribution_survey';
const AS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YXNiYXB4emdtcGNvc2l4Z2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NjM4MzUsImV4cCI6MjA5NTIzOTgzNX0.DLNnasmaQ1hdKXb2xqXrTBnBjISo0RxOiwy7TrlN9bg';

const AS_ANSWERED_KEY  = 'tg_attr_survey_answered';
const AS_OPEN_COUNT_KEY = 'tg_attr_survey_open_count'; // distinct days the app has been opened, counted for this survey
const AS_LAST_OPEN_KEY  = 'tg_attr_survey_last_open';  // last day counted, so re-opening same day doesn't burn an attempt
// 3 total shows, spaced out on app-opens #1, #2 and #4 -- deliberately skips
// #3 rather than showing 3 times in a row, then stops asking for good.
const AS_SHOW_ON_OPENS = [1, 2, 4];
const AS_MAX_OPENS = 4; // once we're past this open, stop counting/checking entirely

const AS_OPTIONS = [
  { id: 'google_search',    label: 'Google Search',                    placeholder: 'What did you search for?' },
  { id: 'reddit',           label: 'Reddit',                           placeholder: 'Which show or subreddit did you find us on?' },
  { id: 'other',            label: 'Other',                            placeholder: 'Where did you find us?' },
];

function _asNative() {
  return !!(window.Capacitor && (window.Capacitor.isNativePlatform?.() || window.Capacitor.isNative));
}
function _asPlatform() {
  try { return (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'unknown'; } catch { return 'unknown'; }
}
function _asTodayStr() { return new Date().toISOString().slice(0, 10); }

// Called once per eligible home-screen load. Advances the "app open" counter
// at most once per calendar day (so backgrounding/foregrounding the app
// repeatedly in one sitting doesn't burn through attempts), then reports
// whether THIS open is one of the ones that should actually show the modal.
function _asRegisterOpenAndCheck() {
  if (!_asNative()) return false; // native app only, not web
  if (typeof isPremiumUser === 'function' && isPremiumUser()) return false; // free app only
  try {
    if (localStorage.getItem(AS_ANSWERED_KEY) === 'true') return false;
    const today = _asTodayStr();
    if (localStorage.getItem(AS_LAST_OPEN_KEY) === today) return false; // already decided today
    let openCount = parseInt(localStorage.getItem(AS_OPEN_COUNT_KEY) || '0', 10) || 0;
    if (openCount >= AS_MAX_OPENS) return false; // out of attempts
    openCount += 1;
    localStorage.setItem(AS_LAST_OPEN_KEY, today);
    localStorage.setItem(AS_OPEN_COUNT_KEY, String(openCount));
    return AS_SHOW_ON_OPENS.includes(openCount);
  } catch { return false; }
}

function _asSubmit(sourceId, detail) {
  try {
    fetch(AS_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: AS_KEY,
        Authorization: 'Bearer ' + AS_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        source: sourceId,
        detail: detail || null,
        platform: _asPlatform(),
        session_id: typeof _promoSessionId === 'function' ? _promoSessionId() : null,
      }),
    }).catch(() => {});
  } catch {}
}

function _asHtml() {
  return `
    <div class="as-modal-overlay" id="asModalOverlay">
      <div class="as-modal">
        <p class="as-modal-title">Where did you originally find us?</p>
        <p class="as-modal-sub">Helps us know where to focus — pick the closest one.</p>
        <div class="as-option-row" id="asOptionRow">
          ${AS_OPTIONS.map(o => `<button type="button" class="secondary-btn as-option" data-source="${o.id}">${o.label}</button>`).join('')}
        </div>
        <div class="as-detail" id="asDetail" style="display:none;">
          <textarea id="asDetailText" class="form-input" placeholder=""></textarea>
          <button type="button" class="primary-btn" id="asSubmitBtn">Submit</button>
        </div>
        <p class="as-thanks" id="asThanks" style="display:none;">Thanks for letting us know! 🎉</p>
        <button type="button" class="as-skip" id="asSkip">Skip for now</button>
      </div>
    </div>
  `;
}

function _asBind() {
  const overlay = document.getElementById('asModalOverlay');
  if (!overlay) return;
  let source = '';
  const optRow     = document.getElementById('asOptionRow');
  const detailWrap = document.getElementById('asDetail');
  const detailText = document.getElementById('asDetailText');
  const submitBtn  = document.getElementById('asSubmitBtn');
  const thanks     = document.getElementById('asThanks');
  const skipBtn    = document.getElementById('asSkip');

  const close = () => overlay.remove();

  optRow.querySelectorAll('.as-option').forEach(btn => {
    btn.addEventListener('click', () => {
      source = btn.dataset.source;
      optRow.querySelectorAll('.as-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const opt = AS_OPTIONS.find(o => o.id === source);
      if (detailText) detailText.placeholder = opt ? opt.placeholder : '';
      if (detailWrap) detailWrap.style.display = 'block';
      if (typeof gtag === 'function') gtag('event', 'attribution_survey_select_' + source);
    });
  });

  if (submitBtn) submitBtn.addEventListener('click', () => {
    if (!source) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    const detail = detailText ? detailText.value.trim() : '';
    _asSubmit(source, detail);
    try { localStorage.setItem(AS_ANSWERED_KEY, 'true'); } catch {}
    if (typeof gtag === 'function') gtag('event', 'attribution_survey_submitted_' + source);
    if (optRow) optRow.style.display = 'none';
    if (detailWrap) detailWrap.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
    if (thanks) thanks.style.display = 'block';
    setTimeout(close, 1100);
  });

  if (skipBtn) skipBtn.addEventListener('click', () => {
    if (typeof gtag === 'function') gtag('event', 'attribution_survey_skipped');
    close();
  });
}

// Call on app open (home screen only, see index.html). Returns true if the
// survey was actually shown. Can render alongside the app announcement
// toast (assets/announcements.js) on the same load -- the toast sits at a
// higher z-index than this modal's overlay (see .app-toast in style.css) so
// both stay visible/tappable instead of one washing the other out.
function initAttributionSurvey() {
  if (!_asRegisterOpenAndCheck()) return false;
  document.body.insertAdjacentHTML('beforeend', _asHtml());
  _asBind();
  return true;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'home') return;
  setTimeout(initAttributionSurvey, 900);
});
