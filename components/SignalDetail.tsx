"use client";
// In-overlay body for a clicked global signal (earthquake, wildfire, aurora, …).
// Generic by design: it renders the signal's title, a definition list of whatever
// `props` the adapter surfaced, the source link, and the mandatory attribution —
// so a NEW signal layer needs no new detail component. Rendered over the still-
// live globe by <FeedOverlay>.

import type { WorldObject } from "@/lib/world";
import { humaniseKey } from "@/lib/text/humanise";

/**
 * Curated [label, value] rows for the two cable ASSET kinds. Cables carry no
 * magnitude / severity / time, so the dossier shows infrastructure attributes with
 * proper labels (capacity is honestly flagged unpublished, never invented). Any
 * other signal keeps the generic humanised prop dump.
 */
function assetEntries(kind: string, p: Record<string, unknown>): [string, string][] {
  const val = (v: unknown) => (v == null || v === "" ? "—" : String(v));
  if (kind === "cable") {
    const rows: [string, string][] = [
      ["Status", val(p.status)],
      ["Ready for service", val(p.rfs ?? p.rfsYear)],
      ["Length", val(p.length)],
      ["Design capacity", `${val(p.capacity)} (not published)`],
      ["Owners / consortium", val(p.owners)],
      ["Supplier", val(p.suppliers)],
      ["Landing region", val(p.region)],
      ["Landing points", val(p.landings)],
    ];
    return rows.filter(([, v]) => v && v !== "—" && v !== "— (not published)");
  }
  if (kind === "landing") {
    return [
      ["Cables landing here", val(p.cableCount)],
      ["Cables", val(p.cables)],
    ].filter(([, v]) => v && v !== "—") as [string, string][];
  }
  return [];
}

export default function SignalDetail({ object }: { object: WorldObject }) {
  const meta = object.meta ?? {};
  const props = (meta.props as Record<string, unknown> | undefined) ?? {};
  const attribution = meta.attribution as string | undefined;
  const sourceLabel = meta.sourceLabel as string | undefined;
  const link = meta.link as string | undefined;
  const accent = object.color ?? "var(--tn-accent)";

  const assetKind = typeof props.assetKind === "string" ? (props.assetKind as string) : undefined;
  const entries: [string, string][] = assetKind
    ? assetEntries(assetKind, props)
    : Object.entries(props)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => [humaniseKey(k), String(v)]);

  return (
    <div style={{ color: "var(--tn-text)", fontFamily: "var(--tn-sans)" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span
            aria-hidden
            style={{ width: 11, height: 11, borderRadius: "50%", background: accent, flexShrink: 0 }}
          />
          <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: "var(--tn-text)" }}>
            {object.label}
          </span>
        </div>
        {sourceLabel && (
          <div style={{ fontSize: 12, color: "var(--tn-text-muted)" }}>{sourceLabel}</div>
        )}
      </div>

      {/* ── Definition list of the adapter's props ── */}
      {entries.length > 0 && (
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "6px 14px",
            margin: 0,
            fontSize: 13,
          }}
        >
          {entries.map(([label, v]) => (
            <div key={label} style={{ display: "contents" }}>
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
                {label}
              </dt>
              <dd style={{ margin: 0, color: "var(--tn-text)", fontWeight: 600 }}>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--tn-text-muted)" }}>
        {object.lat.toFixed(3)}, {object.lon.toFixed(3)}
      </div>

      {/* ── Source link ── */}
      {link && (
        <a
          className="cam-open"
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 12 }}
        >
          View source ↗
        </a>
      )}

      {/* ── Attribution (mandatory) ── */}
      {attribution && (
        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            color: "var(--tn-text-faint)",
            borderTop: "1px solid var(--tn-border)",
            paddingTop: 8,
          }}
          data-testid="attribution"
        >
          {attribution}
        </div>
      )}
    </div>
  );
}
