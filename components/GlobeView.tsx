"use client";
import { useEffect, useRef, useState } from "react";
import Globe, { GlobeMethods } from "react-globe.gl";
import { useRouter } from "next/navigation";

type Pt = { id: string; name: string; lat: number; lon: number; available: boolean };

// London — where P0's cameras are. We fly the camera here on load so the
// points are front-and-centre instead of a speck off the coast of Africa.
const HOME = { lat: 51.5, lng: -0.12, altitude: 1.6 };

export default function GlobeView() {
  const [pts, setPts] = useState<Pt[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setPts(d.cameras as Pt[]))
      .catch(() => setPts([]));
  }, []);

  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleReady = () => {
    const g = globeRef.current;
    if (!g) return;
    (window as unknown as { __globe?: GlobeMethods }).__globe = g; // debug handle
    g.pointOfView(HOME, 0);
    const controls = g.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.enableDamping = true;
  };

  return (
    <>
      <div className="stat-line" data-testid="stat-line">
        {pts.length.toLocaleString()} cameras · 1 source · London live
      </div>
      <Globe
        ref={globeRef}
        width={size.w || undefined}
        height={size.h || undefined}
        onGlobeReady={handleReady}
        globeImageUrl="/textures/earth-night.jpg"
        bumpImageUrl="/textures/earth-topology.png"
        backgroundImageUrl="/textures/night-sky.png"
        showAtmosphere
        atmosphereColor="#3a86ff"
        atmosphereAltitude={0.18}
        pointsData={pts}
        pointLat="lat"
        pointLng="lon"
        pointColor={(p) => ((p as Pt).available ? "#22d3ee" : "#64748b")}
        pointAltitude={0.025}
        pointRadius={0.28}
        pointResolution={6}
        pointLabel={(p) => (p as Pt).name}
        onPointClick={(p) =>
          router.push(`/camera/${encodeURIComponent((p as Pt).id)}`)
        }
      />
    </>
  );
}
