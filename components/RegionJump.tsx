"use client";
// Quick-jump control: flies the globe to each covered camera region. Without it
// a viewer lands on London and never discovers the US coverage. Counts are live
// (passed from GlobeView); only regions with a `view` are listed.

import { CAMERA_REGIONS } from "@/lib/icons/svg";

export type RegionView = { lat: number; lng: number; altitude: number };

export default function RegionJump({
  counts,
  onJump,
}: {
  counts: Record<string, number>;
  onJump: (view: RegionView) => void;
}) {
  const regions = CAMERA_REGIONS.filter((r) => r.view && (counts[r.source] ?? 0) > 0);
  if (regions.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 20 }}>
      <div
        style={{
          background: "rgba(5,7,13,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "10px 12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          minWidth: 200,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 6,
          }}
        >
          Fly to region
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {regions.map((r) => (
            <button
              key={r.source}
              onClick={() => r.view && onJump(r.view)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "7px 8px",
                background: "transparent",
                border: "1px solid transparent",
                borderRadius: 8,
                cursor: "pointer",
                color: "#e2e8f0",
                font: "inherit",
                textAlign: "left",
                transition: "background .15s ease, border-color .15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = `${r.color}66`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  flexShrink: 0,
                  background: r.color,
                  borderRadius: "50%",
                  boxShadow: `0 0 8px ${r.color}`,
                }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.label}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: "#94a3b8",
                }}
              >
                {(counts[r.source] ?? 0).toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
