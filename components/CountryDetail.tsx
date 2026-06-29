"use client";
// In-overlay body for a clicked country (placeholder).
//
// The country layer is a base reference today: borders + names + a click target.
// This dossier shows the identity we already know (flag, ISO, region, rough
// population) and reserves clearly-labelled slots for the live data that will be
// wired in later (travel advisory, the Country Instability Index, active events
// in-country). It deliberately says "coming soon" rather than faking numbers.

import type { WorldObject } from "@/lib/world";

const COMING_SOON: { title: string; note: string }[] = [
  { title: "Travel advisory", note: "Government advisory level + summary" },
  { title: "Instability index", note: "Composite conflict / displacement / outage score" },
  { title: "Active events", note: "Live signals currently inside this country" },
];

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

      {/* ── Reserved live-data slots (honest placeholder) ── */}
      <div
        style={{
          marginTop: 16,
          borderTop: "1px solid var(--tn-border)",
          paddingTop: 12,
          display: "grid",
          gap: 8,
        }}
      >
        {COMING_SOON.map((s) => (
          <div
            key={s.title}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--tn-surface-2, rgba(148,163,184,0.10))",
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tn-text)" }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "var(--tn-text-muted)" }}>{s.note}</div>
            </div>
            <span
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 700,
                color: "var(--tn-text-faint)",
                border: "1px solid var(--tn-border)",
                borderRadius: 999,
                padding: "2px 7px",
                whiteSpace: "nowrap",
              }}
            >
              Coming soon
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--tn-text-muted)" }}>
        {object.lat.toFixed(2)}, {object.lon.toFixed(2)}
      </div>
    </div>
  );
}
