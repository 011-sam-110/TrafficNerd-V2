// Thin server-side relay for the optional Discord alert channel. Mirrors
// app/api/telegram/route.ts: the browser can't POST to a Discord webhook directly
// without leaking the URL into client network logs / hitting CORS, so it hands us
// { webhookUrl, content } and we forward it. The webhook URL is the USER'S OWN,
// used transiently and never stored server-side. It is shape-validated against the
// canonical Discord webhook pattern, so the only reachable host is discord.com /
// discordapp.com — there is no SSRF surface. Dormant-safe: every failure resolves to
// { ok: false } with a 200, never a 5xx.

export const runtime = "nodejs";

// A real webhook looks like https://discord.com/api/webhooks/<numeric id>/<token>.
// Anchoring host + shape keeps arbitrary URLs from being used as an open proxy.
const WEBHOOK_RE = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export async function POST(req: Request): Promise<Response> {
  let body: { webhookUrl?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Bad request body." }, { status: 200 });
  }

  const webhookUrl = typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : "";
  const content = typeof body.content === "string" ? body.content.slice(0, 2000) : "";

  if (!WEBHOOK_RE.test(webhookUrl)) return Response.json({ ok: false, error: "That Discord webhook URL doesn't look right." }, { status: 200 });
  if (!content) return Response.json({ ok: false, error: "Nothing to send." }, { status: 200 });

  try {
    const r = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(8000),
    });
    // Discord returns 204 No Content on success.
    if (!r.ok) return Response.json({ ok: false, error: `Discord error ${r.status}.` }, { status: 200 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "Couldn't reach Discord." }, { status: 200 });
  }
}
