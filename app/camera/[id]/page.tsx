import Link from "next/link";
import { notFound } from "next/navigation";
import { getCameraById, nearestTo } from "@/lib/sources/registry";
import { isLiveStreamUrl } from "@/lib/proxy/hls-allowlist";
import { CameraImage } from "@/components/CameraImage";
import { CameraVideo } from "@/components/CameraVideo";

export const dynamic = "force-dynamic";

export default async function CameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cam = await getCameraById(decodeURIComponent(id));
  if (!cam) notFound();

  const nearby = (await nearestTo(cam.lat, cam.lon, 8))
    .filter((n) => n.camera.id !== cam.id)
    .slice(0, 6);
  const live = isLiveStreamUrl(cam.streamUrl);

  return (
    <main className="camera-detail">
      <p><Link href="/">← Globe</Link></p>
      <h1>{cam.name}</h1>
      {live ? (
        <CameraVideo
          id={cam.id} alt={cam.name}
          attribution={cam.attribution} license={cam.license}
          refreshSeconds={cam.refreshSeconds}
        />
      ) : (
        <CameraImage
          id={cam.id} alt={cam.name}
          attribution={cam.attribution} license={cam.license}
          refreshSeconds={cam.refreshSeconds}
        />
      )}
      <dl>
        <dt>Source</dt><dd>{cam.source}</dd>
        <dt>Location</dt><dd>{cam.region}, {cam.country}</dd>
        <dt>Coordinates</dt><dd>{cam.lat.toFixed(4)}, {cam.lon.toFixed(4)}</dd>
        <dt>Status</dt><dd>{cam.available ? "available" : "unavailable"}</dd>
        <dt>Refresh</dt><dd>every {cam.refreshSeconds}s</dd>
      </dl>
      <section>
        <h2>Nearby cameras</h2>
        <ul>
          {nearby.map((n) => (
            <li key={n.camera.id}>
              <Link href={`/camera/${encodeURIComponent(n.camera.id)}`}>
                {n.camera.name} · {n.km.toFixed(2)} km
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
