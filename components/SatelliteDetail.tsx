"use client";
// Body content for the overlay when a satellite is clicked. Renders the
// satellite's identity + live SATELLITE IMAGERY of the ground directly beneath
// it (the sub-satellite point) at click time, via Esri World Imagery's single-
// image export. Renders body content only — it sits inside <FeedOverlay>'s panel.

import type { WorldObject } from "@/lib/world";

/** Esri World Imagery single-image export for a box around (lat, lon). */
function esriImagery(lat: number, lon: number, halfDeg = 0.4): string {
  // Widen the longitude span by 1/cos(lat) so the image isn't squashed away from the equator.
  const lonHalf = halfDeg / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
  const bbox = [lon - lonHalf, lat - halfDeg, lon + lonHalf, lat + halfDeg].map((n) => n.toFixed(5)).join(",");
  return (
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export" +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=640,640&format=jpg&f=image`
  );
}

interface SatMeta {
  noradId?: string;
  objectName?: string;
  altKm?: number;
  velocityKmS?: number;
  periodMin?: number;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 14, color: "#e2e8f0" },
  figure: { margin: 0, position: "relative", borderRadius: 10, overflow: "hidden", background: "#0b1220", aspectRatio: "1 / 1" },
  img: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cap: { position: "absolute", left: 8, bottom: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(5,7,13,0.7)", color: "#cbd5e1", letterSpacing: "0.02em" },
  badge: { display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.4)", borderRadius: 999, padding: "2px 10px" },
  stats: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 16px", margin: 0 },
  row: { display: "flex", flexDirection: "column", gap: 2 },
  dt: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" },
  dd: { margin: 0, fontSize: 15, fontVariantNumeric: "tabular-nums", color: "#f8fafc" },
  note: { margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.5 },
};

export default function SatelliteDetail({ object }: { object: WorldObject }) {
  const m = (object.meta ?? {}) as SatMeta;
  const altKm = m.altKm ?? object.altKm ?? 0;
  const img = esriImagery(object.lat, object.lon);

  return (
    <div style={styles.wrap}>
      <span style={styles.badge}>Satellite · live</span>
      <figure style={styles.figure}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img style={styles.img} src={img} alt={`Satellite imagery of the ground beneath ${object.label}`} loading="lazy" />
        <figcaption style={styles.cap}>Ground beneath · Imagery © Esri, Maxar</figcaption>
      </figure>
      <dl style={styles.stats}>
        <div style={styles.row}><dt style={styles.dt}>NORAD ID</dt><dd style={styles.dd}>{m.noradId ?? "—"}</dd></div>
        <div style={styles.row}><dt style={styles.dt}>Altitude</dt><dd style={styles.dd}>{altKm.toFixed(0)} km</dd></div>
        <div style={styles.row}><dt style={styles.dt}>Speed</dt><dd style={styles.dd}>{(m.velocityKmS ?? 0).toFixed(2)} km/s</dd></div>
        <div style={styles.row}><dt style={styles.dt}>Period</dt><dd style={styles.dd}>{m.periodMin && Number.isFinite(m.periodMin) ? `${m.periodMin.toFixed(1)} min` : "—"}</dd></div>
        <div style={styles.row}><dt style={styles.dt}>Sub-point</dt><dd style={styles.dd}>{object.lat.toFixed(2)}, {object.lon.toFixed(2)}</dd></div>
      </dl>
      <p style={styles.note}>
        Real satellite imagery of the Earth directly beneath {object.label} at the moment you clicked. Data from CelesTrak · propagated with SGP4.
      </p>
    </div>
  );
}
