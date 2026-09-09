// Edge Function: notify-install  (deployed as "clever-task")
// Receives a "new install" ping from the app, tallies it in the DB, and only
// forwards a SUMMARY to Telegram once every BATCH_SIZE installs (e.g. every 10:
// "📲 10 new installs — Android: 4, iOS: 6").
//
// Premium (paid, ad-free) app installs are rare enough that they skip the batch
// entirely: every ping with app:"premium" bumps its own counter and sends its
// own "[Premium]" Telegram message immediately, into the same chat.
//
// The Telegram bot token + chat id live as Supabase secrets (TELEGRAM_TOKEN,
// TELEGRAM_CHAT_ID) so they never appear in the public repo or client code.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected into Edge Functions.
//
// The endpoint URL + anon key are visible to anyone who views the site's public
// JS (assets/admob.js), so this also rate-limits: at most one accepted ping per
// source IP per RATE_LIMIT_WINDOW_SECONDS, so a curl loop can't spam fake
// installs into the counters or Telegram (see install-rate-limit.sql).
//
// One-time DB setup: run install-counter.sql (free app, batched),
// premium-install-counter.sql (premium apps, unbatched), and
// install-rate-limit.sql (abuse guard) in the Supabase SQL editor.

const BATCH_SIZE = 10; // notify once per this many installs
const RATE_LIMIT_WINDOW_SECONDS = 120; // one accepted ping per IP per this many seconds

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS });
  }

  const token = Deno.env.get("TELEGRAM_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || !chatId || !supaUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let platform = "unknown";
  let isPremium = false;
  try {
    const body = await req.json();
    if (typeof body.platform === "string") platform = body.platform.slice(0, 20);
    isPremium = body.app === "premium";
  } catch { /* ignore malformed body, still count it */ }

  // Keyed by IP *and* which app pinged, so a free-app ping and a premium-app
  // ping from the same WiFi/IP (e.g. someone opens the free app, then installs
  // the premium one minutes later) don't share a bucket and wrongly swallow a
  // real premium install.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const rateLimitKey = `${ip}:${isPremium ? "premium" : "free"}`;
  try {
    const rl = await fetch(`${supaUrl}/rest/v1/rpc/check_install_rate_limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_ip: rateLimitKey, p_window_seconds: RATE_LIMIT_WINDOW_SECONDS }),
    });
    if (rl.ok && (await rl.json()) !== true) {
      return new Response(JSON.stringify({ ok: true, sent: false, rateLimited: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  } catch (_e) {
    // Rate-limit check itself failing shouldn't block a real install — fail open.
  }

  async function sendTelegram(text: string) {
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!tg.ok) throw new Error("telegram failed");
  }

  if (isPremium) {
    // Premium apps: bump their own counter and always notify — no batching,
    // since paid installs are infrequent enough to want a ping every time.
    try {
      const rpc = await fetch(`${supaUrl}/rest/v1/rpc/bump_premium_install`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ p_platform: platform }),
      });
      if (!rpc.ok) {
        return new Response(JSON.stringify({ error: "counter failed", detail: await rpc.text() }), {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const rows = await rpc.json();
      const counts = Array.isArray(rows) ? rows[0] : rows;
      const total = (counts?.ios || 0) + (counts?.android || 0);
      const label = platform === "ios" ? "iOS" : platform === "android" ? "Android" : platform;
      await sendTelegram(`📲 [Premium] new ${label} install — total premium installs: ${total}`);
      return new Response(JSON.stringify({ ok: true, sent: true }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (_e) {
      return new Response(JSON.stringify({ error: "premium install error" }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  }

  // Atomically tally this install. The RPC increments the per-platform counters
  // and, when the running total reaches BATCH_SIZE, resets them to 0 and returns
  // flushed=true with the counts to report. Doing it server-side in one SQL call
  // keeps it race-safe across concurrent installs.
  let counts;
  try {
    const rpc = await fetch(`${supaUrl}/rest/v1/rpc/bump_install`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ p_platform: platform, p_batch: BATCH_SIZE }),
    });
    if (!rpc.ok) {
      return new Response(JSON.stringify({ error: "counter failed", detail: await rpc.text() }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const rows = await rpc.json();
    counts = Array.isArray(rows) ? rows[0] : rows;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "counter error" }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Also log this install as a DATED row so we have per-day install history —
  // install_counter is only a reset-on-flush batch buffer and keeps no dates.
  // Best-effort: a logging hiccup must never fail the install acknowledgement.
  try {
    await fetch(`${supaUrl}/rest/v1/installs_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ platform }),
    });
  } catch (_e) { /* ignore — the running tally + Telegram flow still work */ }

  // Not yet at the batch threshold — just acknowledge, no Telegram message.
  if (!counts || !counts.flushed) {
    return new Response(JSON.stringify({ ok: true, sent: false }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Threshold reached — send one summary message and exit.
  const total = (counts.android || 0) + (counts.ios || 0) + (counts.other || 0);
  const parts: string[] = [];
  if (counts.android) parts.push(`Android: ${counts.android}`);
  if (counts.ios) parts.push(`iOS: ${counts.ios}`);
  if (counts.other) parts.push(`Other: ${counts.other}`);
  const text = `📲 ${total} new installs — ${parts.join(", ")}`;

  try {
    await sendTelegram(text);
  } catch (_e) {
    return new Response(JSON.stringify({ error: "telegram error" }), {
      status: 502,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, sent: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
