"use client";
// Floating legend + layer toggles over the globe. Each layer row has a live
// count and an on/off switch; clicking the row expands the full *type key* for
// that layer (the maximal taxonomy of icons), so a viewer can decode every
// marker on the map. Wired to lib/layers (visibility store) + lib/icons (the
// single source of truth for icons/colours/labels).

import { useState } from "react";
import { useLayers, layersStore, type LayerKey } from "@/lib/layers";
import { TypeIcon } from "@/lib/icons/Icon";
import {
  SAT_META,
  PLANE_META,
  CAMERA_FEED_META,
  CAMERA_REGIONS,
  type SubtypeMeta,
} from "@/lib/icons/svg";

const LAYERS: { key: LayerKey; name: string; color: string }[] = [
  { key: "cameras", name: "Cameras", color: "#22d3ee" },
  { key: "satellites", name: "Satellites", color: "#a78bfa" },
  { key: "planes", name: "Planes", color: "#fbbf24" },
];

const SAT_SUBTYPES: SubtypeMeta[] = Object.values(SAT_META);
const PLANE_SUBTYPES: SubtypeMeta[] = Object.values(PLANE_META);
const CAMERA_FEEDS: SubtypeMeta[] = Object.values(CAMERA_FEED_META);

function Chip({ meta }: { meta: SubtypeMeta }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <TypeIcon icon={meta.key} color={meta.color} size={15} title={meta.label} />
      <span style={{ fontSize: 11.5, color: "#cbd5e1", whiteSpace: "nowrap" }}>{meta.label}</span>
    </span>
  );
}

function KeyGrid({ items }: { items: SubtypeMeta[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "6px 12px",
        padding: "8px 2px 4px",
      }}
    >
      {items.map((m) => (
        <Chip key={m.key} meta={m} />
      ))}
    </div>
  );
}

function CameraKey() {
  return (
    <div style={{ padding: "8px 2px 4px" }}>
      <div style={{ ...miniHeading }}>Feed</div>
      <div style={{ display: "flex", gap: 14, marginBottom: 8 }}>
        {CAMERA_FEEDS.map((m) => (
          <Chip key={m.key} meta={{ ...m, color: "#94a3b8" }} />
        ))}
      </div>
      <div style={{ ...miniHeading }}>Region (colour)</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
        {CAMERA_REGIONS.map((r) => (
          <span key={r.source} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: r.color,
                boxShadow: `0 0 6px ${r.color}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11.5, color: "#cbd5e1", whiteSpace: "nowrap" }}>{r.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const miniHeading: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 5,
};

export default function LayerControl({ counts }: { counts: Record<LayerKey, number> }) {
  const enabled = useLayers();
  const [open, setOpen] = useState<LayerKey | null>(null);

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
          width: 256,
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
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
          Layers
        </div>
        {LAYERS.map((l, i) => {
          const on = enabled[l.key];
          const isOpen = open === l.key;
          return (
            <div key={l.key} style={{ borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  opacity: on ? 1 : 0.45,
                  transition: "opacity .25s ease",
                }}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : l.key)}
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Hide" : "Show"} ${l.name} type key`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flex: 1,
                    minWidth: 0,
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
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
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>
                    {l.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "#64748b",
                      transform: isOpen ? "rotate(90deg)" : "none",
                      transition: "transform .2s ease",
                    }}
                  >
                    ▸
                  </span>
                </button>
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
              {isOpen && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  {l.key === "satellites" && <KeyGrid items={SAT_SUBTYPES} />}
                  {l.key === "planes" && <KeyGrid items={PLANE_SUBTYPES} />}
                  {l.key === "cameras" && <CameraKey />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
