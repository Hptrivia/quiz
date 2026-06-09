// Edge Function: notify-install  (deployed as "clever-task")
// Receives a "new install" ping from the app, tallies it in the DB, and only
// forwards a SUMMARY to Telegram once every BATCH_SIZE installs (e.g. every 10:
// "📲 10 new installs — Android: 4, iOS: 6").
//
// The Telegram bot token + chat id live as Supabase secrets (TELEGRAM_TOKEN,
// TELEGRAM_CHAT_ID) so they never appear in the public repo or client code.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are auto-injected into Edge Functions.
//
// One-time DB setup (run the SQL in install-counter.sql in the Supabase SQL editor)
// creates the install_counter table + the bump_install() RPC this calls.

const BATCH_SIZE = 10; // notify once per this many installs

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
  try {
    const body = await req.json();
    if (typeof body.platform === "string") platform = body.platform.slice(0, 20);
  } catch { /* ignore malformed body, still count it */ }

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
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!tg.ok) {
      return new Response(JSON.stringify({ error: "telegram failed" }), {
        status: 502,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
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
