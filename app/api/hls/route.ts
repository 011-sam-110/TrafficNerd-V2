import type { NextRequest } from "next/server";
import { getCameraById } from "@/lib/sources/registry";
import { isHlsAllowed } from "@/lib/proxy/hls-allowlist";
import { rewritePlaylist } from "@/lib/proxy/hls-rewrite";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const uParam = req.nextUrl.searchParams.get("u");

  let upstream: string | null = null;
  if (uParam) {
    upstream = uParam;
  } else if (idParam) {
    const cam = await getCameraById(idParam);
    if (!cam?.streamUrl) return new Response("camera or stream not found", { status: 404 });
    upstream = cam.streamUrl;
  }
  if (!upstream) return new Response("missing id or u", { status: 400 });

  let target: URL;
  try { target = new URL(upstream); } catch { return new Response("bad url", { status: 400 }); }

  const verdict = isHlsAllowed(target);
  if (!verdict.ok) return new Response("forbidden host", { status: 403 });

  const range = req.headers.get("range");
  let res: Response;
  try {
    res = await fetch(target.toString(), {
      headers: {
        Referer: verdict.referer ?? "",
        "User-Agent": "TrafficNerd/2.0 (+https://github.com/011-sam-110/TrafficNerd-V2)",
        Accept: "*/*",
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }
  if (!res.ok && res.status !== 206) return new Response("upstream error", { status: 502 });

  const ct = res.headers.get("content-type");
  const isPlaylist = (ct?.includes("mpegurl") ?? false) || target.pathname.toLowerCase().endsWith(".m3u8");

  if (isPlaylist) {
    const body = await res.text();
    return new Response(rewritePlaylist(body, target.toString()), {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
  }

  // Segment / binary: stream straight through (do not buffer), preserve range semantics.
  const headers = new Headers();
  headers.set("Content-Type", ct ?? "video/mp2t");
  const cr = res.headers.get("content-range"); if (cr) headers.set("Content-Range", cr);
  const cl = res.headers.get("content-length"); if (cl) headers.set("Content-Length", cl);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=5");
  return new Response(res.body, { status: res.status, headers });
}
