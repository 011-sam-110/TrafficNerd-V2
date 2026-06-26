"use client";

import type { WorldObject } from "@/lib/world";
import { TypeIcon } from "@/lib/icons/Icon";

interface Props {
  object: WorldObject;
}

// ---------------------------------------------------------------------------
// Unit converters
// ---------------------------------------------------------------------------

function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

function msToKnots(ms: number): number {
  return Math.round(ms * 1.944);
}

function mToFt(m: number): number {
  return Math.round(m * 3.28084);
}

function headingToCompass(deg: number): string {
  const dirs = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  primary,
  secondary,
  primaryColor = "#f59e0b",
}: {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  primaryColor?: string;
}) {
  return (
    <div
      style={{
        background: "#0b1220",
        borderRadius: 8,
        padding: "12px 14px",
        minHeight: 72,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#22d3ee",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: primaryColor, lineHeight: 1.2 }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{secondary}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaneDetail — renders inside an existing overlay panel body
// No full-screen layout, no fixed positioning.
// ---------------------------------------------------------------------------

/**
 * Renders flight information for a clicked plane {@link WorldObject}.
 * Designed to sit inside an existing overlay panel — emits body content only.
 *
 * @param object - A WorldObject with kind "plane". Reads meta keys:
 *   callsign, country, velocityMs, altKm, verticalRateMs, onGround.
 */
export default function PlaneDetail({ object }: Props) {
  const meta = object.meta ?? {};

  const callsign = (meta.callsign as string | undefined) ?? object.label;
  const country = (meta.country as string | undefined) ?? "—";
  const altKm = (meta.altKm as number | undefined) ?? 0;
  const altM = altKm * 1000;
  const velocityMs = meta.velocityMs as number | null | undefined;
  const verticalRateMs = meta.verticalRateMs as number | null | undefined;
  const onGround = (meta.onGround as boolean | undefined) ?? false;
  const headingDeg = object.heading ?? 0;

  // Classify climb/descent with a dead-band of ±0.5 m/s
  let climbLabel: React.ReactNode = null;
  let climbColor = "#94a3b8";
  if (verticalRateMs != null) {
    if (verticalRateMs > 0.5) {
      climbLabel = `+${Math.round(verticalRateMs)} m/s`;
      climbColor = "#22d3ee"; // cyan for climb
    } else if (verticalRateMs < -0.5) {
      climbLabel = `${Math.round(verticalRateMs)} m/s`;
      climbColor = "#f59e0b"; // amber for descent
    } else {
      climbLabel = "Level";
      climbColor = "#94a3b8";
    }
  }

  const altPrimary = onGround
    ? "On ground"
    : altM < 50
    ? "—"
    : `${Math.round(altM).toLocaleString()} m`;

  const altSecondary =
    !onGround && altM >= 50
      ? `${mToFt(altM).toLocaleString()} ft`
      : undefined;

  return (
    <div
      style={{
        color: "#e2e8f0",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 4,
          }}
        >
          {object.icon ? (
            <TypeIcon icon={object.icon} color={object.color ?? "#f59e0b"} size={20} />
          ) : (
            <span style={{ fontSize: 18, color: "#f59e0b", lineHeight: 1 }}>✈</span>
          )}
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#f1f5f9",
            }}
          >
            {callsign}
          </span>
          {object.typeLabel && (
            <span
              title="Type estimated from the live flight profile (no category in the OpenSky feed)"
              style={{
                background: "#1e293b",
                color: object.color ?? "#fbbf24",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 600,
                letterSpacing: "0.04em",
              }}
            >
              {object.typeLabel} · est.
            </span>
          )}
          {onGround && (
            <span
              style={{
                background: "#1e293b",
                color: "#94a3b8",
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              ON GROUND
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{country}</div>
      </div>

      {/* ── Stat grid ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        <StatCard
          label="Altitude"
          primary={altPrimary}
          secondary={altSecondary}
          primaryColor={onGround || altM < 50 ? "#94a3b8" : "#f59e0b"}
        />

        <StatCard
          label="Ground Speed"
          primary={
            velocityMs != null
              ? `${msToKmh(velocityMs)} km/h`
              : "—"
          }
          secondary={velocityMs != null ? `${msToKnots(velocityMs)} kn` : undefined}
          primaryColor={velocityMs != null ? "#f59e0b" : "#94a3b8"}
        />

        <StatCard
          label="Heading"
          primary={`${Math.round(headingDeg)}°`}
          secondary={headingToCompass(headingDeg)}
        />

        <StatCard
          label="Vertical"
          primary={climbLabel ?? "—"}
          secondary={
            verticalRateMs != null && Math.abs(verticalRateMs) > 0.5
              ? verticalRateMs > 0 ? "Climbing" : "Descending"
              : undefined
          }
          primaryColor={climbColor}
        />
      </div>

      {/* ── Attribution ── */}
      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          color: "#475569",
          borderTop: "1px solid #1e293b",
          paddingTop: 8,
        }}
      >
        Data from The OpenSky Network
      </div>
    </div>
  );
}
