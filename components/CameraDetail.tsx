"use client";
// In-overlay camera body. Rendered over the still-live globe by <FeedOverlay>.
// Reuses the SSRF-safe image proxy via <CameraImage>, shows the MANDATORY
// attribution, name/coords/status, and a deep-link to the full /camera/[id]
// page (which stays as a standalone fallback).

import { useEffect, useState } from "react";
import Link from "next/link";
import type { WorldObject } from "@/lib/world";
import { CameraImage } from "@/components/CameraImage";

type CamInfo = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region?: string;
  country: string;
  available: boolean;
  attribution: string;
  license: string;
  refreshSeconds: number;
};

export function CameraDetail({ object }: { object: WorldObject }) {
  // The globe only carries a thin WorldObject; fetch the full record (for the
  // attribution / license / refresh interval the live image needs).
  const [cam, setCam] = useState<CamInfo | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setCam(null);
    setErr(false);
    fetch(`/api/camera/${encodeURIComponent(object.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d) => {
        if (alive) setCam(d.camera as CamInfo);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [object.id]);

  const available =
    (object.meta?.available as boolean | undefined) ?? cam?.available ?? false;
  const href = `/camera/${encodeURIComponent(object.id)}`;

  return (
    <div className="cam-detail">
      <h2>{object.label}</h2>
      <p className="cam-sub">
        {cam ? `${cam.region ? `${cam.region}, ` : ""}${cam.country}` : "Live traffic camera"}
      </p>

      {cam ? (
        <CameraImage
          id={cam.id}
          alt={cam.name}
          attribution={cam.attribution}
          license={cam.license}
          refreshSeconds={cam.refreshSeconds}
        />
      ) : err ? (
        <div className="cam-loading">Could not load this camera.</div>
      ) : (
        <div className="cam-loading">Loading live image…</div>
      )}

      <div className="cam-meta">
        <span className="cam-status">
          <span className={`dot ${available ? "on" : "off"}`} aria-hidden />
          {available ? "Available" : "Unavailable"}
        </span>
        <span>
          {object.lat.toFixed(4)}, {object.lon.toFixed(4)}
        </span>
        {cam && <span>Refresh {cam.refreshSeconds}s</span>}
      </div>

      <Link className="cam-open" href={href}>
        Open full page ↗
      </Link>
    </div>
  );
}
