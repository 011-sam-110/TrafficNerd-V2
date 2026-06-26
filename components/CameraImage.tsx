"use client";
import { useEffect, useState } from "react";
import { AttributionBadge } from "@/components/AttributionBadge";

export function CameraImage(props: {
  id: string; alt: string; attribution: string; license: string; refreshSeconds: number;
}) {
  const { id, alt, attribution, license, refreshSeconds } = props;
  const [bust, setBust] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBust((b) => b + 1), refreshSeconds * 1000);
    return () => clearInterval(t);
  }, [refreshSeconds]);

  return (
    <figure style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/proxy?id=${encodeURIComponent(id)}&_=${bust}`} alt={alt} />
      <figcaption><AttributionBadge attribution={attribution} license={license} /></figcaption>
    </figure>
  );
}
