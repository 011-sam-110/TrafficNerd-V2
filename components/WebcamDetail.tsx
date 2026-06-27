"use client";
// In-overlay webcam body (the Windy "Webcams" layer — distinct from road CCTV).
// Rendered over the still-live globe by <FeedOverlay>. The Windy image token is
// short-lived, so the picture is pulled through the SSRF-safe /api/webcam-image
// proxy, which re-resolves a fresh URL server-side on every load. Windy's terms
// REQUIRE the "Webcams provided by Windy.com" credit plus a link back to the
// webcam's own Windy page, so both are shown beneath the image.

import { useEffect, useState } from "react";
import type { WorldObject } from "@/lib/world";

const REFRESH_SECONDS = 600; // matches the free-tier ~10 min image-token cadence

export default function WebcamDetail({ object }: { object: WorldObject }) {
  const detailUrl = (object.meta?.detailUrl as string | undefined) ?? "https://www.windy.com/webcams";
  const region = object.meta?.region as string | undefined;
  const country = object.meta?.country as string | undefined;
  const available = (object.meta?.available as boolean | undefined) ?? true;
  const place = [region, country].filter(Boolean).join(", ") || "Public webcam";

  // Cache-bust the proxied image on the token cadence so it stays current.
  const [bust, setBust] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBust((b) => b + 1), REFRESH_SECONDS * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="cam-detail">
      <h2>{object.label}</h2>
      <p className="cam-sub">{place}</p>

      <figure style={{ margin: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/webcam-image?id=${encodeURIComponent(object.id)}&_=${bust}`} alt={object.label} />
        <figcaption>
          <span className="attribution" data-testid="attribution">
            Webcams provided by{" "}
            <a href={detailUrl} target="_blank" rel="noopener noreferrer">
              Windy.com
            </a>
          </span>
        </figcaption>
      </figure>

      <div className="cam-meta">
        <span className="cam-status">
          <span className={`dot ${available ? "on" : "off"}`} aria-hidden />
          {available ? "Active" : "Inactive"}
        </span>
        <span>
          {object.lat.toFixed(4)}, {object.lon.toFixed(4)}
        </span>
        <span>Refresh {REFRESH_SECONDS}s</span>
      </div>

      <a className="cam-open" href={detailUrl} target="_blank" rel="noopener noreferrer">
        View on Windy ↗
      </a>
    </div>
  );
}
