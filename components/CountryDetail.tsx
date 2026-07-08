"use client";
// In-overlay body for a clicked country.
//
// The country layer is a base reference today: borders + names + a click target.
// This dossier shows the identity we already know (flag, ISO, region, rough
// population). The "Instability index" slot is now LIVE — it reads the per-country
// Composite Instability Index (CII) we already compute and shows the score, its
// top drivers and the factor breakdown, presented honestly as a composite estimate
// (not an official government figure). "Travel advisory" and "Active events" stay
// clearly-labelled "coming soon" slots rather than faking numbers.

import type { CSSProperties } from "react";
import type { WorldObject } from "@/lib/world";
import { useSignalFeatures } from "@/lib/widgets/useSignalFeatures";
import { resolveCountryInstability } from "@/lib/geo/countryInstability";

const COMING_SOON: { title: string; note: string }[] = [
  { title: "Travel advisory", note: "Government advisory level + summary" },
  { title: "Active events", note: "Live signals currently inside this country" },
];

// Shared card + chip styling (matches the existing reserved-slot look, theme vars only).
const CARD_STYLE: CSSProperties = {
  padding: "10px",
  borderRadius: 8,
  background: "var(--tn-surface-2, rgba(148,163,184,0.10))",
};
const SLOT_TITLE_STYLE: CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--tn-text)" };
const SLOT_NOTE_STYLE: CSSProperties = { fontSize: 11, color: "var(--tn-text-muted)" };
const CHIP_STYLE: CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700,
  border: "1px solid var(--tn-border)",
  borderRadius: 999,
  padding: "2px 7px",
  whiteSpace: "nowrap",
};

/** An inert "coming soon" reserved slot (Travel advisory / Active events). */
function ComingSoonSlot({ title, note }: { title: string; note: string }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={SLOT_TITLE_STYLE}>{title}</div>
        <div style={SLOT_NOTE_STYLE}>{note}</div>
      </div>
      <span style={{ ...CHIP_STYLE, color: "var(--tn-text-faint)" }}>Coming soon</span>
    </div>
  );
}

/** A single-line instability slot (loading / below-threshold / dormant / error). */
function InstabilityStatusSlot({ note, chip, chipColor }: { note: string; chip: string; chipColor: string }) {
  return (
    <div
      style={{
        ...CARD_STYLE,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={SLOT_TITLE_STYLE}>Instability index</div>
        <div style={SLOT_NOTE_STYLE}>{note}</div>
      </div>
      <span style={{ ...CHIP_STYLE, color: chipColor }}>{chip}</span>
    </div>
  );
}

/** LIVE Country Instability Index slot for the clicked country. */
function InstabilitySlot({ iso3, label }: { iso3: string | undefined; label: string }) {
  const { features, status } = useSignalFeatures("instability", true);
  const state = resolveCountryInstability(features, status, iso3, label);

  if (state.kind === "loading")
    return <InstabilityStatusSlot note="Assessing instability…" chip="Loading" chipColor="var(--tn-text-faint)" />;
  if (state.kind === "error")
    return <InstabilityStatusSlot note="Instability data is unavailable right now." chip="Unavailable" chipColor="var(--tn-text-faint)" />;
  if (state.kind === "empty")
    return <InstabilityStatusSlot note="Monitoring inputs are dormant right now." chip="No data" chipColor="var(--tn-text-faint)" />;
  if (state.kind === "below")
    return <InstabilityStatusSlot note="Stable — below the monitoring threshold." chip="Stable" chipColor="var(--tn-live)" />;

  const { view } = state;
  return (
    <div style={{ ...CARD_STYLE, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Title + score */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={SLOT_TITLE_STYLE}>Instability index</div>
          <div style={SLOT_NOTE_STYLE}>
            Composite estimate{view.coverage ? ` · ${view.coverage}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, color: view.color }}>
          <span className="tn-num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{view.score}</span>
          <span style={{ fontSize: 11, color: "var(--tn-text-muted)" }}>/100</span>
        </div>
      </div>

      {/* Top drivers */}
      {view.drivers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {view.drivers.map((d) => (
            <span
              key={d}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--tn-accent-soft)",
                color: "var(--tn-accent-strong)",
                border: "1px solid var(--tn-border)",
                textTransform: "capitalize",
                whiteSpace: "nowrap",
              }}
            >
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Factor breakdown */}
      {view.factors.length > 0 && (
        <div style={{ display: "grid", gap: 7 }}>
          {view.factors.map((f) => (
            <div key={f.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: "var(--tn-text-muted)", textTransform: "capitalize" }}>{f.label}</span>
                <span className="tn-num" style={{ color: "var(--tn-text)" }}>{f.value}</span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "var(--tn-border)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.max(0, f.pct))}%`,
                    background: view.color,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--tn-text-faint)", lineHeight: 1.4 }}>
        Composite estimate from ACLED · WFP · UNHCR · IODA — not an official government figure.
      </div>
    </div>
  );
}

export default function CountryDetail({ object }: { object: WorldObject }) {
  const meta = object.meta ?? {};
  const flag = (meta.flag as string) || "";
  const iso2 = meta.iso2 as string | undefined;
  const iso3 = meta.iso3 as string | undefined;
  const region = meta.region as string | undefined;
  const continent = meta.continent as string | undefined;
  const population = meta.population as number | undefined;

  const facts: [string, string][] = [];
  if (iso2 || iso3) facts.push(["ISO code", [iso2, iso3].filter(Boolean).join(" · ")]);
  if (region) facts.push(["Region", region]);
  if (continent && continent !== region) facts.push(["Continent", continent]);
  if (population) facts.push(["Population", `≈ ${population.toLocaleString("en-US")}`]);

  const [travelAdvisory, activeEvents] = COMING_SOON;

  return (
    <div style={{ color: "var(--tn-text)", fontFamily: "var(--tn-sans)" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        {flag && <span aria-hidden style={{ fontSize: 34, lineHeight: 1 }}>{flag}</span>}
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, color: "var(--tn-text)" }}>
            {object.label}
          </div>
          <div style={{ fontSize: 12, color: "var(--tn-text-muted)" }}>Country</div>
        </div>
      </div>

      {/* ── Known identity facts ── */}
      {facts.length > 0 && (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 14px",
            margin: 0,
            fontSize: 13,
          }}
        >
          {facts.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt
                style={{
                  color: "var(--tn-accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  fontSize: 11,
                  fontWeight: 600,
                  alignSelf: "center",
                }}
              >
                {k}
              </dt>
              <dd style={{ margin: 0, color: "var(--tn-text)", fontWeight: 600 }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* ── Live + reserved data slots ── */}
      <div
        style={{
          marginTop: 16,
          borderTop: "1px solid var(--tn-border)",
          paddingTop: 12,
          display: "grid",
          gap: 8,
        }}
      >
        <ComingSoonSlot title={travelAdvisory.title} note={travelAdvisory.note} />
        <InstabilitySlot iso3={iso3} label={object.label} />
        <ComingSoonSlot title={activeEvents.title} note={activeEvents.note} />
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--tn-text-muted)" }}>
        {object.lat.toFixed(2)}, {object.lon.toFixed(2)}
      </div>
    </div>
  );
}
