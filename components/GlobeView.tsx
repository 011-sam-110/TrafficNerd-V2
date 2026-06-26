"use client";
import { useEffect, useState } from "react";
import Globe from "react-globe.gl";
import { useRouter } from "next/navigation";

type Pt = { id: string; name: string; lat: number; lon: number; available: boolean };

export default function GlobeView() {
  const [pts, setPts] = useState<Pt[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setPts(d.cameras as Pt[]))
      .catch(() => setPts([]));
  }, []);

  return (
    <>
      <div className="stat-line" data-testid="stat-line">
        {pts.length.toLocaleString()} cameras · 1 source · London live
      </div>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="#05070d"
        pointsData={pts}
        pointLat="lat"
        pointLng="lon"
        pointColor={(p) => ((p as Pt).available ? "#22d3ee" : "#475569")}
        pointAltitude={0.005}
        pointRadius={0.12}
        pointLabel={(p) => (p as Pt).name}
        onPointClick={(p) =>
          router.push(`/camera/${encodeURIComponent((p as Pt).id)}`)
        }
      />
    </>
  );
}
