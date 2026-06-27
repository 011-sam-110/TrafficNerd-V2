"use client";
// Map-view switcher — pick the basemap (real satellite imagery / light / topo)
// and toggle 3D terrain. Wired to WorldMap's basemap + terrain state; switching
// calls map.setStyle (WorldMap re-adds the app layers on style.load).

import { BASEMAPS, type BasemapKey } from "@/lib/basemaps";

export default function BasemapControl({
  basemap,
  onBasemap,
  terrainOn,
  onTerrain,
}: {
  basemap: BasemapKey;
  onBasemap: (k: BasemapKey) => void;
  terrainOn: boolean;
  onTerrain: (on: boolean) => void;
}) {
  const keys = Object.keys(BASEMAPS) as BasemapKey[];
  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 20 }}>
      <div
        style={{
          background: "rgba(5,7,13,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "10px 12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          minWidth: 210,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#64748b",
            marginBottom: 8,
          }}
        >
          Map view
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 9 }}>
          {keys.map((k) => {
            const on = basemap === k;
            return (
              <button
                key={k}
                onClick={() => onBasemap(k)}
                aria-pressed={on}
                style={{
                  flex: 1,
                  padding: "7px 6px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  borderRadius: 8,
                  border: on ? "1px solid #22d3ee" : "1px solid rgba(255,255,255,0.12)",
                  background: on ? "rgba(34,211,238,0.16)" : "transparent",
                  color: on ? "#e2f6fb" : "#cbd5e1",
                  font: "inherit",
                  transition: "background .15s ease, border-color .15s ease, color .15s ease",
                }}
              >
                {BASEMAPS[k].label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onTerrain(!terrainOn)}
          aria-pressed={terrainOn}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            width: "100%",
            padding: "6px 4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            font: "inherit",
            color: "#e2e8f0",
          }}
        >
          <span
            style={{
              position: "relative",
              width: 34,
              height: 18,
              flexShrink: 0,
              background: terrainOn ? "#22d3ee" : "rgba(255,255,255,0.15)",
              borderRadius: 9,
              transition: "background .2s ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: terrainOn ? 18 : 2,
                width: 14,
                height: 14,
                background: "#fff",
                borderRadius: "50%",
                transition: "left .2s cubic-bezier(.4,0,.2,1)",
              }}
            />
          </span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>3D terrain</span>
        </button>
      </div>
    </div>
  );
}
