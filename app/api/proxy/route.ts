import type { NextRequest } from "next/server";
import { getCameraById } from "@/lib/sources/registry";
import { isAllowed } from "@/lib/proxy/allowlist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });

  const cam = await getCameraById(id);
  if (!cam?.imageUrl) return new Response("camera or image not found", { status: 404 });

  let target: URL;
  try { target = new URL(cam.imageUrl); } catch { return new Response("bad image url", { status: 500 }); }
  if (!isAllowed(target)) return new Response("forbidden host", { status: 403 });

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "TrafficNerd/2.0 (+https://github.com/011-sam-110/TrafficNerd-V2)" },
    cache: "no-store",
  });
  if (!upstream.ok) return new Response("upstream error", { status: 502 });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // Never serve a camera faster than the source refresh (TfL = 300s).
      "Cache-Control": `public, max-age=${cam.refreshSeconds}, s-maxage=${cam.refreshSeconds}`,
    },
  });
}
