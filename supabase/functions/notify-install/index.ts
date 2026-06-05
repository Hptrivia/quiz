// Edge Function: notify-install
// Receives a "new install" ping from the app and forwards it to Telegram.
// The Telegram bot token + chat id live as Supabase secrets (TELEGRAM_TOKEN,
// TELEGRAM_CHAT_ID) so they never appear in the public repo or client code.

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
  if (!token || !chatId) {
    return new Response(JSON.stringify({ error: "not configured" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let platform = "unknown", country = "Unknown", version = "?";
  try {
    const body = await req.json();
    if (typeof body.platform === "string") platform = body.platform.slice(0, 20);
    if (typeof body.country === "string") country = body.country.slice(0, 60);
    if (typeof body.version === "string") version = body.version.slice(0, 20);
  } catch { /* ignore malformed body, still send a basic ping */ }

  const label = platform === "ios" ? "iOS" : platform === "android" ? "Android" : platform;
  const text = `📲 New install — ${label}\n🌍 ${country}\n🏷️ v${version}`;

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

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
