// Thin server-side relay for the optional Telegram alert channel. The browser can't
// POST to api.telegram.org directly (CORS + it would expose the token in client
// network logs / history), so it hands us { botToken, chatId, text } and we forward a
// sendMessage on the user's behalf. The token is the USER'S OWN bot token, used
// transiently and never stored server-side. The only outbound host is the fixed
// Telegram API, and both token + chatId are shape-validated, so there is no SSRF
// surface. Dormant-safe: every failure resolves to { ok: false } with a 200, never a 5xx.

export const runtime = "nodejs";

// A real bot token looks like "123456789:AA...". A chat id is a signed integer or an
// "@channelusername". Validating the shapes keeps arbitrary strings out of the URL/body.
const TOKEN_RE = /^\d{4,}:[A-Za-z0-9_-]{20,}$/;
const CHAT_RE = /^(-?\d+|@[A-Za-z0-9_]{3,})$/;

export async function POST(req: Request): Promise<Response> {
  let body: { botToken?: unknown; chatId?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request body." }, { status: 200 });
  }

  const botToken = typeof body.botToken === "string" ? body.botToken.trim() : "";
  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";

  if (!TOKEN_RE.test(botToken)) return Response.json({ ok: false, error: "That bot token doesn't look right." }, { status: 200 });
  if (!CHAT_RE.test(chatId)) return Response.json({ ok: false, error: "That chat id doesn't look right." }, { status: 200 });
  if (!text) return Response.json({ ok: false, error: "Nothing to send." }, { status: 200 });

  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!r.ok || j?.ok === false) {
      return Response.json({ ok: false, error: j?.description ?? `Telegram error ${r.status}.` }, { status: 200 });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Couldn't reach Telegram." }, { status: 200 });
  }
}
