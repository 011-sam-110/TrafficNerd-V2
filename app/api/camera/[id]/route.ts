import { getCameraById, nearestTo } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const camera = await getCameraById(decodeURIComponent(id));
  if (!camera) return new Response("camera not found", { status: 404 });
  const nearby = (await nearestTo(camera.lat, camera.lon, 8))
    .filter((n) => n.camera.id !== camera.id)
    .slice(0, 6)
    .map((n) => ({ id: n.camera.id, name: n.camera.name, km: Number(n.km.toFixed(2)) }));
  return Response.json({ camera, nearby });
}
