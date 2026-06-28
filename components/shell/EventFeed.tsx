// components/shell/EventFeed.tsx
"use client";
// The Event Feed — the console hero. Ranked, scoped, sourced rows built by the
// pure projectEventFeed from the live EVENT_SOURCES feeds. Click a row → fly +
// open its dossier (reusing openSignalFeature, exactly like the old Top Events
// panel). Honest empty state echoes the active scope + window.

import { useMemo, useState } from "react";
import type { SignalFeature } from "@/lib/signals/types";
import { EVENT_SOURCES } from "@/lib/events/sources";
import type { EventType, SeverityTier } from "@/lib/events/model";
import { useEventFeeds } from "@/lib/widgets/useEventFeeds";
import { projectEventFeed, type FeedSort, type FeedInput } from "@/lib/widgets/eventFeed";
import { useScope } from "@/lib/shell/scope";
import { useTimeWindow, windowMsFor, TIME_WINDOWS } from "@/lib/shell/timeWindow";
import { useNow, formatAge } from "@/lib/shell/useNow";
import { openSignalFeature } from "@/lib/widgets/openSignal";

const TIERS: SeverityTier[] = ["S0", "S1", "S2", "S3", "S4"];
const TYPES: EventType[] = Array.from(new Set(EVENT_SOURCES.map((s) => s.type)));
const SORTS: { key: FeedSort; label: string }[] = [
  { key: "severity", label: "Severity" },
  { key: "recent", label: "Recent" },
  { key: "nearest", label: "Nearest" },
];

export default function EventFeed() {
  const scope = useScope();
  const win = useTimeWindow();
  const now = useNow(1000);
  const { bySource, status, updatedAt } = useEventFeeds();

  const [minTier, setMinTier] = useState<SeverityTier>("S0");
  const [sort, setSort] = useState<FeedSort>("severity");
  const [type, setType] = useState<EventType | null>(null);

  // Keep the original SignalFeature for each event id so a row click can reuse the
  // exact map-fly + dossier behaviour.
  const featureById = useMemo(() => {
    const m = new Map<string, { feature: SignalFeature; label: string }>();
    for (const s of EVENT_SOURCES) {
      for (const f of bySource[s.id] ?? []) m.set(f.id, { feature: f, label: s.label });
    }
    return m;
  }, [bySource]);

  const inputs: FeedInput[] = useMemo(
    () => EVENT_SOURCES.map((source) => ({ source, features: bySource[source.id] ?? [] })),
    [bySource],
  );

  const projected = useMemo(
    () =>
      projectEventFeed(inputs, scope, windowMsFor(win), now, {
        types: type ? new Set([type]) : null,
        minTier,
        sort: sort === "nearest" && !scope.center ? "severity" : sort,
      }),
    [inputs, scope, win, now, type, minTier, sort],
  );

  const winLabel = TIME_WINDOWS.find((w) => w.key === win)?.label ?? win;
  const open = (id: string) => {
    const hit = featureById.get(id);
    if (hit) openSignalFeature(hit.feature, hit.label, 7);
  };

  return (
    <aside className="tn-feed" role="region" aria-label="Event feed">
      <header className="tn-feed-head">
        <h2 className="tn-feed-title">Events</h2>
        <span className="tn-feed-count tn-num">
          {projected.shown}
          {projected.shown !== projected.total ? ` / ${projected.total}` : ""}
        </span>
      </header>

      <div className="tn-feed-controls">
        <select
          aria-label="Minimum severity"
          value={minTier}
          onChange={(e) => setMinTier(e.target.value as SeverityTier)}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}+
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as FeedSort)}>
          {SORTS.map((s) => (
            <option key={s.key} value={s.key} disabled={s.key === "nearest" && !scope.center}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="tn-feed-types">
          <button
            type="button"
            className={`tn-feed-type${type === null ? " on" : ""}`}
            onClick={() => setType(null)}
          >
            All
          </button>
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`tn-feed-type${type === t ? " on" : ""}`}
              onClick={() => setType(type === t ? null : t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {projected.shown === 0 ? (
        <p className="tn-feed-empty">
          {status === "loading"
            ? "Loading events…"
            : status === "error"
              ? "Event sources are unavailable right now."
              : `No events above ${minTier} in ${scope.label} · last ${winLabel}.`}
        </p>
      ) : (
        <ol className="tn-feed-list">
          {projected.rows.map((e) => (
            <li key={e.id}>
              <button type="button" className="tn-feed-item" onClick={() => open(e.id)}>
                <span className="tn-feed-sev" style={{ background: e.color, color: e.severity.tier === "S3" || e.severity.tier === "S4" ? "#fff" : "#111827" }}>
                  {e.severity.tier}
                </span>
                <span className="tn-feed-main">
                  <span className="tn-feed-item-title">
                    <span className="tn-feed-kind">{e.type}</span> {e.place.name}
                  </span>
                  <span className="tn-feed-meta">
                    {e.occurredAt ? `${formatAge(now - Date.parse(e.occurredAt))} · ` : ""}
                    {e.source.attribution}
                    {e.magnitude ? ` · ${e.magnitude.value} ${e.magnitude.unit}` : ""}
                    {" · "}
                    <span className="tn-feed-prec">{e.geo.precision.toLowerCase()}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <footer className="tn-feed-foot">
        {updatedAt != null ? `Updated ${formatAge(now - updatedAt)} ago` : "—"} ·{" "}
        {EVENT_SOURCES.length} sources
      </footer>
    </aside>
  );
}
