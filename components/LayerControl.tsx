"use client";
// Floating legend + layer toggles over the globe. Adapted from a 21st.dev/Magic
// generation, wired to lib/layers (the visibility store) and the live counts
// GlobeView passes in. Each row: glowing colour dot · name · live count · switch.

import { useLayers, layersStore, type LayerKey } from "@/lib/layers";

const LAYERS: { key: LayerKey; name: string; color: string }[] = [
  { key: "cameras", name: "Cameras", color: "#22d3ee" },
  { key: "satellites", name: "Satellites", color: "#a78bfa" },
  { key: "planes", name: "Planes", color: "#fbbf24" },
];

export default function LayerControl({ counts }: { counts: Record<LayerKey, number> }) {
  const enabled = useLayers();

  return (
    <div style={{ position: "fixed", top: 52, left: 16, zIndex: 20 }}>
      <div
        style={{
          background: "rgba(5,7,13,0.82)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "12px 14px",
          minWidth: 224,
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>
          Layers
        </div>
        {LAYERS.map((l, i) => {
          const on = enabled[l.key];
          return (
            <div
              key={l.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none",
                opacity: on ? 1 : 0.45,
                transition: "opacity .25s ease",
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  flexShrink: 0,
                  background: l.color,
                  borderRadius: "50%",
                  boxShadow: on ? `0 0 8px ${l.color}` : "none",
                  transition: "box-shadow .25s ease",
                }}
              />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{l.name}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: "#f8fafc",
                  minWidth: 46,
                  textAlign: "right",
                }}
              >
                {counts[l.key].toLocaleString()}
              </span>
              <button
                onClick={() => layersStore.toggle(l.key)}
                aria-label={`Toggle ${l.name}`}
                aria-pressed={on}
                style={{
                  position: "relative",
                  width: 38,
                  height: 20,
                  background: on ? l.color : "rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  transition: "background .25s ease",
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: on ? 20 : 2,
                    width: 16,
                    height: 16,
                    background: "#fff",
                    borderRadius: "50%",
                    transition: "left .25s cubic-bezier(.4,0,.2,1)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
