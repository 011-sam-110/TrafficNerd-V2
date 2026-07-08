# W3 — Signals detail template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One schema-agnostic focus detail view that covers all ~30 signal layers, parameterised by the `SignalSource` descriptor.

**Architecture:** A `makeSignalDetail(source)` factory returns a `WidgetDetailProps` component (mirrors `makeSignalBody(source)` in `signals.tsx`). It reuses the SAME data pipeline as the docked widget (`useSignalFeed` → `projectSignal`) plus the shared primitives (`InsetMap`, `Chart`, `buckets`, `lib/export`, `lib/series`). Pure detail logic (distribution/sort/time) lives in a testable `lib/console/signals/signalDetail.ts`. The template is registered as `detail:` on every `signal:<id>` widget in the existing registration loop.

**Tech Stack:** Next 15 / React 19 / TS; MapLibre (InsetMap); native SVG (Chart); vitest.

## Global Constraints

- Keyless-first, dormant-safe; feeds already resolve to `[]` (never 5xx). Honest empty states — never invent data.
- Native zero-dep `<Chart>`; one shared `<InsetMap>`; theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1` (they don't exist).
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo attribution `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."` (never a `@'...'` heredoc).
- Owned files only; never `git add -A`, `git checkout`, `git reset`, `git stash`; do not touch `.superpowers/sdd/progress.md`.

## Reference pattern

`lib/console/widgets/events.detail.tsx` is the canonical W1 template — mirror its structure (header/counts, panel grid with Chart + InsetMap, grouped feed, footer with source attribution + export). W3 differs only in being a `make…(source)` factory and adding the sparkline/distribution/table/drill-down/show-on-map panels from spec §7.3.

## Data shapes (already exist — consume, don't redefine)

- `SignalFeature { id; lat; lon; title; signalId; geometry?; color?; props?; link?; ts? }` — `@/lib/signals/types`
- `SignalSource { id; label; group; color; refreshMs; attribution; fetch() }` — same file
- `useSignalFeed(id, refreshMs): { features, status, updatedAt }` — `@/lib/console/signals/useSignalFeed`
- `projectSignal(features, scope, { alertMin?, limit? }): { rows, total, shown, alerts }` — `@/lib/console/signals/signalCard` (SignalRow `{ id, title, magnitude?, ts?, link? }`)
- `useScope(): Scope` (has `.label`, used by `withinScope`) — `@/lib/shell/scope`; `withinScope(lat, lon, scope)` from same
- `recordSeries(key, value, t)`, `seriesSamples(key): CountSample[]`, `deltaOf(buf)` — `@/lib/series` + `@/lib/widgets/history` (`CountSample { t, n }`)
- `Chart({ points: ChartPoint[]; height?; up? })` (`ChartPoint { x, y }`) — `@/components/Chart`
- `InsetMap({ points: InsetPoint[]; height?; onSelect? })` (`InsetPoint { lat; lon; id?; color?; props? }`) — `@/components/InsetMap` (default), `@/lib/map/inset`
- `countBy`, `histogram(values, edges)`, `timeBins(tsList, binMs, now, spanMs): {start,count}[]` — `@/lib/widgets/buckets`
- `toCsv(rows)`, `toGeoJson(points: {lat,lon,properties}[])`, `downloadText(name, mime, text)`, `exportFilename(kind, at)` — `@/lib/export`
- `signalsStore.set(id, on)` — `@/lib/signals/store` (enable the layer on the main map)
- `shellLayoutStore.unfocus()` — `@/lib/console/store` (return to the map stage)
- `openSignalFeature(f, sourceLabel, zoom?)` — `@/lib/widgets/openSignal` (fly + open dossier)

---

## File Structure

- Create `lib/text/humanise.ts` — pure `humaniseKey(camelOrSnake): Title Case` (extracted from `components/SignalDetail.tsx`, DRY).
- Modify `components/SignalDetail.tsx` — import `humaniseKey` instead of its private `humanise`.
- Create `lib/console/signals/signalDetail.ts` — pure detail projection (distribution / sort / time / declared-severity).
- Create `lib/console/widgets/signals.detail.tsx` — `makeSignalDetail(source)` template.
- Modify `lib/console/widgets/signals.tsx` — attach `detail: makeSignalDetail(source)` in the registration loop.
- Modify `app/globals.css` — append the `.tn-sd*` block.
- Create tests `tests/unit/humanise.test.ts`, `tests/unit/signal-detail.test.ts`.

---

### Task 1: Pure detail projection + shared humanise

**Files:**
- Create: `lib/text/humanise.ts`, `lib/console/signals/signalDetail.ts`
- Modify: `components/SignalDetail.tsx` (swap private `humanise` → shared `humaniseKey`)
- Test: `tests/unit/humanise.test.ts`, `tests/unit/signal-detail.test.ts`

**Produces (later tasks rely on these exact names):**
- `humaniseKey(key: string): string`
- `declaredSeverity(props?: Record<string, unknown>): "critical" | "warn" | null`
- `magnitudeValues(features: SignalFeature[]): number[]`
- `distribution(features: SignalFeature[]): { kind: "magnitude" | "severity" | "none"; bins: { label: string; count: number }[] }`
- `timeModel(features: SignalFeature[]): { values: number[]; undated: number }`
- `SortKey = "magnitude" | "recency" | "title"`; `sortFeatures(features, key: SortKey, dir: 1 | -1): SignalFeature[]`

- [ ] **Step 1: `lib/text/humanise.ts`**

```ts
// Humanise a camelCase / snake_case / kebab key into a Title-ish label for a
// definition-list term, e.g. "forecastFor" → "Forecast for", "alert_level" → "Alert level".
export function humaniseKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
```

- [ ] **Step 2: Refactor `components/SignalDetail.tsx`** — delete its local `function humanise(...)`, add `import { humaniseKey } from "@/lib/text/humanise";`, and replace the single `humanise(k)` call site with `humaniseKey(k)`.

- [ ] **Step 3: `lib/console/signals/signalDetail.ts`**

```ts
// Pure projection helpers for the Signals FOCUS detail view. The distribution
// logic is deliberately honest: it shows a magnitude histogram only when the
// source actually carries numeric magnitudes, falls back to declared severity
// counts, and reports "none" when neither exists (the caller then hides the panel).
import type { SignalFeature } from "@/lib/signals/types";

/** Declared severity read from common alert-level props — only unambiguous words. */
export function declaredSeverity(props?: Record<string, unknown>): "critical" | "warn" | null {
  if (!props) return null;
  for (const key of ["alertlevel", "alertLevel", "severity", "level", "status"]) {
    const v = props[key];
    if (typeof v !== "string") continue;
    const s = v.toLowerCase();
    if (/red|extreme|severe|critical|emergency/.test(s)) return "critical";
    if (/orange|warning|high|moderate/.test(s)) return "warn";
  }
  return null;
}

/** Finite numeric props.magnitude values. */
export function magnitudeValues(features: SignalFeature[]): number[] {
  const out: number[] = [];
  for (const f of features) {
    const m = f.props?.magnitude;
    if (typeof m === "number" && Number.isFinite(m)) out.push(m);
  }
  return out;
}

export interface Distribution {
  kind: "magnitude" | "severity" | "none";
  bins: { label: string; count: number }[];
}

/** Honest distribution: magnitude histogram → severity counts → none. */
export function distribution(features: SignalFeature[]): Distribution {
  const mags = magnitudeValues(features);
  if (mags.length > 0) {
    const lo = Math.floor(Math.min(...mags));
    const hi = Math.ceil(Math.max(...mags));
    const span = Math.max(1, hi - lo);
    const step = Math.max(1, Math.ceil(span / 8)); // integer buckets, ≤8
    const bins: { label: string; count: number }[] = [];
    for (let edge = lo; edge < lo + step * Math.ceil(span / step); edge += step) {
      const top = edge + step;
      const count = mags.filter((m) => m >= edge && (top >= hi ? m <= top : m < top)).length;
      bins.push({ label: step === 1 ? `${edge}` : `${edge}–${top}`, count });
    }
    return { kind: "magnitude", bins };
  }
  let critical = 0, warn = 0, other = 0;
  for (const f of features) {
    const s = declaredSeverity(f.props);
    if (s === "critical") critical++;
    else if (s === "warn") warn++;
    else other++;
  }
  if (critical > 0 || warn > 0) {
    return { kind: "severity", bins: [
      { label: "Severe", count: critical },
      { label: "Warning", count: warn },
      { label: "Other", count: other },
    ] };
  }
  return { kind: "none", bins: [] };
}

/** Parseable ISO timestamps → ms, plus the count of undated features. */
export function timeModel(features: SignalFeature[]): { values: number[]; undated: number } {
  const values: number[] = [];
  let undated = 0;
  for (const f of features) {
    const t = f.ts ? Date.parse(f.ts) : NaN;
    if (Number.isFinite(t)) values.push(t);
    else undated++;
  }
  return { values, undated };
}

export type SortKey = "magnitude" | "recency" | "title";

/** Stable-ish sort by magnitude / recency / title. Missing values sort last. */
export function sortFeatures(features: SignalFeature[], key: SortKey, dir: 1 | -1): SignalFeature[] {
  const mag = (f: SignalFeature) =>
    typeof f.props?.magnitude === "number" && Number.isFinite(f.props.magnitude) ? (f.props.magnitude as number) : -Infinity;
  const rec = (f: SignalFeature) => (f.ts ? Date.parse(f.ts) : NaN);
  const cmp = (a: SignalFeature, b: SignalFeature): number => {
    if (key === "title") return a.title.localeCompare(b.title);
    if (key === "magnitude") return mag(a) - mag(b);
    const ra = rec(a), rb = rec(b);
    return (Number.isFinite(ra) ? ra : -Infinity) - (Number.isFinite(rb) ? rb : -Infinity);
  };
  return [...features].sort((a, b) => dir * cmp(a, b));
}
```

- [ ] **Step 4: Tests** — `tests/unit/humanise.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { humaniseKey } from "@/lib/text/humanise";

describe("humaniseKey", () => {
  it("camelCase → Title", () => expect(humaniseKey("forecastFor")).toBe("Forecast for"));
  it("snake/kebab → Title", () => {
    expect(humaniseKey("alert_level")).toBe("Alert level");
    expect(humaniseKey("wind-speed")).toBe("Wind speed");
  });
});
```

`tests/unit/signal-detail.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { distribution, timeModel, sortFeatures } from "@/lib/console/signals/signalDetail";
import type { SignalFeature } from "@/lib/signals/types";

const f = (over: Partial<SignalFeature>): SignalFeature =>
  ({ id: "x", lat: 0, lon: 0, title: "t", signalId: "s", ...over });

describe("distribution", () => {
  it("uses a magnitude histogram when numeric magnitudes exist", () => {
    const d = distribution([f({ props: { magnitude: 2 } }), f({ props: { magnitude: 6 } })]);
    expect(d.kind).toBe("magnitude");
    expect(d.bins.reduce((n, b) => n + b.count, 0)).toBe(2);
  });
  it("falls back to declared severity when no magnitudes", () => {
    const d = distribution([f({ props: { alertLevel: "Red" } }), f({ props: { severity: "warning" } })]);
    expect(d.kind).toBe("severity");
    expect(d.bins.find((b) => b.label === "Severe")!.count).toBe(1);
  });
  it("is 'none' when neither magnitude nor severity exists (honest hide)", () => {
    expect(distribution([f({ props: { note: "hi" } })]).kind).toBe("none");
  });
});

describe("timeModel", () => {
  it("splits dated from undated", () => {
    const m = timeModel([f({ ts: "2026-07-08T00:00:00Z" }), f({})]);
    expect(m.values.length).toBe(1);
    expect(m.undated).toBe(1);
  });
});

describe("sortFeatures", () => {
  it("sorts by magnitude descending with dir -1", () => {
    const out = sortFeatures([f({ id: "a", props: { magnitude: 1 } }), f({ id: "b", props: { magnitude: 9 } })], "magnitude", -1);
    expect(out[0].id).toBe("b");
  });
});
```

- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit && npm test` green.
`git add lib/text/humanise.ts lib/console/signals/signalDetail.ts components/SignalDetail.tsx tests/unit/humanise.test.ts tests/unit/signal-detail.test.ts`
`git commit -m "feat(signals): pure detail projection (distribution/time/sort) + shared humaniseKey"`

---

### Task 2: Detail template skeleton — masthead, counts, freshness, count-history sparkline + register

**Files:**
- Create: `lib/console/widgets/signals.detail.tsx`
- Modify: `lib/console/widgets/signals.tsx` (attach `detail`), `app/globals.css` (append `.tn-sd*`)

**Consumes:** Task 1 exports; `useSignalFeed`, `projectSignal`, `useScope`, `recordSeries`/`seriesSamples`/`deltaOf`, `Chart`.

- [ ] **Step 1: `lib/console/widgets/signals.detail.tsx`** — the factory + skeleton. Follow the `events.detail.tsx` idiom (`"use client"`, `useMemo`, honest empty states).

```tsx
"use client";
// Signals focus view — ONE parameterised template covering every registered signal
// layer. makeSignalDetail(source) mirrors makeSignalBody(source): it reuses the SAME
// live pipeline (useSignalFeed → projectSignal) but renders deep — masthead + count
// sparkline, source map, honest magnitude/severity + time distributions, a sortable
// feature table with per-row props drill-down, attribution, and export/show-on-map.
import { useEffect, useMemo, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { SignalSource, SignalFeature } from "@/lib/signals/types";
import { useSignalFeed } from "@/lib/console/signals/useSignalFeed";
import { useScope, withinScope } from "@/lib/shell/scope";
import { recordSeries, seriesSamples } from "@/lib/series";
import { deltaOf } from "@/lib/widgets/history";
import { Chart, type ChartPoint } from "@/components/Chart";
import InsetMap from "@/components/InsetMap";
import type { InsetPoint } from "@/lib/map/inset";
import { timeBins } from "@/lib/widgets/buckets";
import { toCsv, toGeoJson, downloadText, exportFilename } from "@/lib/export";
import { signalsStore } from "@/lib/signals/store";
import { shellLayoutStore } from "@/lib/console/store";
import { openSignalFeature } from "@/lib/widgets/openSignal";
import { humaniseKey } from "@/lib/text/humanise";
import { distribution, timeModel, sortFeatures, type SortKey } from "@/lib/console/signals/signalDetail";

// Sources whose upstream needs a key that may be unset — surface an honest dormant note.
const KEYED = new Set(["acled", "firms", "aisstream", "openaq", "reliefweb", "entsoe"]);

export function makeSignalDetail(source: SignalSource) {
  function SignalDetailView(_props: WidgetDetailProps) {
    const scope = useScope();
    const { features, status, updatedAt } = useSignalFeed(source.id, source.refreshMs);
    const [sortKey, setSortKey] = useState<SortKey>("magnitude");
    const [dir, setDir] = useState<1 | -1>(-1);
    const [open, setOpen] = useState<string | null>(null);

    const scoped = useMemo(() => features.filter((f) => withinScope(f.lat, f.lon, scope)), [features, scope]);

    // Wire count-history recording (spec: no signal records into the series yet).
    useEffect(() => {
      if (updatedAt) recordSeries(`sig:${source.id}`, scoped.length, updatedAt);
    }, [updatedAt, scoped.length]);

    const spark: ChartPoint[] = useMemo(
      () => seriesSamples(`sig:${source.id}`).map((s) => ({ x: s.t, y: s.n })),
      [updatedAt, scoped.length],
    );
    const delta = useMemo(() => deltaOf(seriesSamples(`sig:${source.id}`)), [updatedAt, scoped.length]);

    const rows = useMemo(() => sortFeatures(scoped, sortKey, dir), [scoped, sortKey, dir]);
    const dist = useMemo(() => distribution(scoped), [scoped]);
    const tm = useMemo(() => timeModel(scoped), [scoped]);
    const now = Date.now();

    const distPoints: ChartPoint[] = dist.bins.map((b, i) => ({ x: i, y: b.count }));
    const timePoints: ChartPoint[] = timeBins(tm.values, 60 * 60_000, now, 24 * 60 * 60_000).map((b) => ({ x: b.start, y: b.count }));
    const mapPoints: InsetPoint[] = scoped.map((f) => ({ lat: f.lat, lon: f.lon, id: f.id, color: f.color ?? source.color, props: { title: f.title } }));
    const freshAge = updatedAt ? `${Math.max(0, Math.round((now - updatedAt) / 60000))}m ago` : "—";

    const exportRows = rows.map((f) => ({ id: f.id, title: f.title, magnitude: f.props?.magnitude ?? "", lat: f.lat, lon: f.lon, ts: f.ts ?? "", link: f.link ?? "" }));
    const exportGeo = rows.map((f) => ({ lat: f.lat, lon: f.lon, properties: { id: f.id, title: f.title, ...(f.props ?? {}) } }));

    const showOnMap = () => { signalsStore.set(source.id, true); shellLayoutStore.unfocus(); };

    return (
      <div className="tn-sd">
        <header className="tn-sd-head">
          <div className="tn-sd-title">{source.label}</div>
          <div className="tn-sd-stat"><b>{scoped.length}</b> of {features.length} in {scope.label} · updated {freshAge}
            {delta !== 0 && <span className={`tn-sd-delta ${delta > 0 ? "up" : "down"}`}> {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}</span>}
          </div>
          {spark.length >= 2 && <div className="tn-sd-spark"><Chart points={spark} height={40} up={null} /></div>}
        </header>

        {status === "loading" && scoped.length === 0 && <p className="tn-w-empty">Loading {source.label}…</p>}
        {status !== "loading" && scoped.length === 0 && <p className="tn-w-empty">Nothing in {scope.label}.</p>}

        {/* Panels (Task 3), table (Task 4), footer (Task 5) inserted below. */}

        <footer className="tn-sd-foot">
          <span className="tn-sd-attr">{source.attribution}{KEYED.has(source.id) && " · needs an API key (dormant when unset)"}</span>
          <span className="tn-sd-actions">
            <button onClick={showOnMap}>🗺 Show on map</button>
            <button disabled={!exportRows.length} onClick={() => downloadText(`${exportFilename(`signal-${source.id}`, Date.now())}.csv`, "text/csv", toCsv(exportRows))}>⬇ CSV</button>
            <button disabled={!exportGeo.length} onClick={() => downloadText(`${exportFilename(`signal-${source.id}`, Date.now())}.geojson`, "application/geo+json", toGeoJson(exportGeo))}>⬇ GeoJSON</button>
          </span>
        </footer>
      </div>
    );
  }
  return SignalDetailView;
}
```

> The `_props`, `open`/`setOpen`, `distPoints`/`timePoints`/`mapPoints`, `openSignalFeature`, `humaniseKey`, `rows`, `setSortKey`/`setDir` bindings are consumed by Tasks 3–4. To keep this task's gate green with no unused-var errors, Task 2 MAY render a minimal panels/table stub now, OR Tasks 3–4 add the JSX in the same edit pass. Simplest: Task 2 wires everything shown and Tasks 3/4 only add JSX that references the already-declared bindings. If tsc flags an unused binding at Task 2, render it (e.g. a `hidden` table) rather than deleting it.

- [ ] **Step 2: Register** — in `lib/console/widgets/signals.tsx`, add `import { makeSignalDetail } from "./signals.detail";` and inside the `for (const source of SIGNALS)` loop add `detail: makeSignalDetail(source),` to the `registerWidget({...})` call.

- [ ] **Step 3: CSS** — append to `app/globals.css`:

```css
/* ── Signals focus detail (W3) ─────────────────────────────────────── */
.tn-sd { display: flex; flex-direction: column; gap: 14px; height: 100%; overflow: auto; padding: 4px 2px; color: var(--tn-text); }
.tn-sd-head { display: flex; flex-direction: column; gap: 4px; }
.tn-sd-title { font-size: 18px; font-weight: 700; }
.tn-sd-stat { font-size: 12px; color: var(--tn-text-muted); }
.tn-sd-delta.up { color: #16a34a; } .tn-sd-delta.down { color: #dc2626; }
.tn-sd-spark { max-width: 320px; }
.tn-sd-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 720px) { .tn-sd-panels { grid-template-columns: 1fr; } }
.tn-sd-panel h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--tn-text-faint); margin: 0 0 6px; }
.tn-sd-bars { display: flex; align-items: flex-end; gap: 4px; height: 120px; }
.tn-sd-bar { flex: 1; background: var(--tn-accent); border-radius: 2px 2px 0 0; min-height: 2px; opacity: .85; }
.tn-sd-bar-label { font-size: 10px; color: var(--tn-text-faint); text-align: center; }
.tn-sd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.tn-sd-table th { text-align: left; color: var(--tn-text-faint); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; padding: 4px 8px; border-bottom: 1px solid var(--tn-border); }
.tn-sd-table td { padding: 5px 8px; border-bottom: 1px solid var(--tn-border); }
.tn-sd-row { cursor: pointer; }
.tn-sd-row:hover { background: var(--tn-surface-2); }
.tn-sd-drill { background: var(--tn-surface-2); }
.tn-sd-drill dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 6px 0; }
.tn-sd-drill dt { color: var(--tn-accent); text-transform: uppercase; font-size: 10px; letter-spacing: .06em; font-weight: 600; }
.tn-sd-drill dd { margin: 0; }
.tn-sd-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 1px solid var(--tn-border); padding-top: 8px; margin-top: auto; }
.tn-sd-attr { font-size: 11px; color: var(--tn-text-faint); }
.tn-sd-actions { display: flex; gap: 8px; }
.tn-sd-actions button { background: var(--tn-surface-2); border: 1px solid var(--tn-border); border-radius: 6px; padding: 4px 10px; font-size: 12px; color: var(--tn-text); cursor: pointer; }
.tn-sd-actions button:disabled { opacity: .4; cursor: default; }
```

- [ ] **Step 4: Gate + commit** — green.
`git add lib/console/widgets/signals.detail.tsx lib/console/widgets/signals.tsx app/globals.css`
`git commit -m "feat(signals): focus detail skeleton — masthead, counts, freshness + count-history sparkline"`

---

### Task 3: Distribution + time + source-map panels

**Files:** Modify `lib/console/widgets/signals.detail.tsx` (add the `.tn-sd-panels` block, after the empty-state lines, before the footer).

- [ ] **Step 1:** Insert the panels JSX (references bindings already declared in Task 2):

```tsx
{scoped.length > 0 && (
  <div className="tn-sd-panels">
    <div className="tn-sd-panel">
      <h3>Locations</h3>
      {mapPoints.length > 0 ? <InsetMap points={mapPoints} height={200} onSelect={(id) => setOpen(id)} />
        : <p className="tn-w-empty">No mappable features.</p>}
    </div>
    <div className="tn-sd-panel">
      <h3>{dist.kind === "magnitude" ? "Magnitude distribution" : dist.kind === "severity" ? "Severity" : "Distribution"}</h3>
      {dist.kind !== "none" ? (
        <>
          <div className="tn-sd-bars">
            {dist.bins.map((b, i) => {
              const max = Math.max(1, ...dist.bins.map((x) => x.count));
              return <div key={i} className="tn-sd-bar" style={{ height: `${(b.count / max) * 100}%` }} title={`${b.label}: ${b.count}`} />;
            })}
          </div>
          <div style={{ display: "flex", gap: 4 }}>{dist.bins.map((b, i) => <span key={i} className="tn-sd-bar-label" style={{ flex: 1 }}>{b.label}</span>)}</div>
        </>
      ) : <p className="tn-w-empty">This source declares no magnitude or severity.</p>}
    </div>
    <div className="tn-sd-panel">
      <h3>Over the last 24h {tm.undated > 0 && <span className="tn-sd-bar-label">· {tm.undated} undated</span>}</h3>
      {timePoints.some((p) => p.y > 0) ? <Chart points={timePoints} height={120} up={null} />
        : <p className="tn-w-empty">No timestamped features in the window.</p>}
    </div>
  </div>
)}
```

- [ ] **Step 2: Gate + commit** — green.
`git add lib/console/widgets/signals.detail.tsx`
`git commit -m "feat(signals): focus detail — source map + honest magnitude/severity + 24h time panels"`

---

### Task 4: Sortable feature table + per-row props drill-down

**Files:** Modify `lib/console/widgets/signals.detail.tsx` (add the table between the panels and the footer).

- [ ] **Step 1:** Insert the table JSX (uses `rows`, `sortKey`/`setSortKey`, `dir`/`setDir`, `open`/`setOpen`, `humaniseKey`, `openSignalFeature`):

```tsx
{scoped.length > 0 && (
  <table className="tn-sd-table">
    <thead>
      <tr>
        {(["magnitude", "title", "recency"] as SortKey[]).map((k) => (
          <th key={k} onClick={() => { if (sortKey === k) setDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setDir(-1); } }}>
            {k === "recency" ? "When" : humaniseKey(k)}{sortKey === k ? (dir === -1 ? " ↓" : " ↑") : ""}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((f) => {
        const entries = Object.entries(f.props ?? {}).filter(([, v]) => v != null && v !== "");
        const isOpen = open === f.id;
        return (
          <>
            <tr key={f.id} className="tn-sd-row" onClick={() => setOpen(isOpen ? null : f.id)}>
              <td>{typeof f.props?.magnitude === "number" ? (f.props.magnitude as number) : "—"}</td>
              <td>{f.title}</td>
              <td>{f.ts ? new Date(f.ts).toISOString().slice(0, 16).replace("T", " ") : "—"}</td>
            </tr>
            {isOpen && (
              <tr key={`${f.id}-d`} className="tn-sd-drill">
                <td colSpan={3}>
                  {entries.length > 0 ? (
                    <dl>{entries.map(([k, v]) => (<div key={k} style={{ display: "contents" }}><dt>{humaniseKey(k)}</dt><dd>{String(v)}</dd></div>))}</dl>
                  ) : <span className="tn-w-empty">No extra properties.</span>}
                  <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                    <button className="tn-sd-actions" onClick={(e) => { e.stopPropagation(); openSignalFeature(f, source.label); shellLayoutStore.unfocus(); }} style={{ background: "none", border: 0, color: "var(--tn-accent)", cursor: "pointer", padding: 0 }}>Show on globe ↗</button>
                    {f.link && <a href={f.link} target="_blank" rel="noreferrer" style={{ color: "var(--tn-accent)" }}>Source ↗</a>}
                  </div>
                </td>
              </tr>
            )}
          </>
        );
      })}
    </tbody>
  </table>
)}
```

> Note: `<>{...}</>` fragment keys — React warns on keyed fragments with the shorthand; use `<Fragment key={f.id}>` (import `Fragment` from "react") wrapping the two `<tr>`s instead of putting `key` on each `<tr>`. Adjust the import line to `import { Fragment, useEffect, useMemo, useState } from "react";`.

- [ ] **Step 2: Gate + commit** — green.
`git add lib/console/widgets/signals.detail.tsx`
`git commit -m "feat(signals): focus detail — sortable feature table + per-row props drill-down"`

---

### Task 5: Verification pass

**Files:** none (review-only) unless a defect is found.

- [ ] **Step 1:** Confirm the footer (attribution + dormant-key note + Show-on-map + CSV/GeoJSON) from Task 2 renders and the export buttons disable on empty. (Already coded in Task 2 — this task verifies it end to end after 3+4 land.)
- [ ] **Step 2:** Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] **Step 3:** If the integrator has a browser: expand a live signal widget (e.g. `signal:usgs-quakes`) and confirm masthead counts, distribution (magnitude for quakes), 24h chart, map, table drill-down, export. Otherwise note that live visual verification is pending.

## Self-Review

- **Spec §7.3 coverage:** (1) masthead + sparkline + delta + freshness + "shown of total" → Task 2 ✓; (2) source InsetMap → Task 3 ✓; (3) magnitude/severity distribution, honest hide → Task 1 `distribution` + Task 3 ✓; (4) time distribution + undated note → Task 1 `timeModel` + Task 3 ✓; (5) sortable table + props drill-down (humanise def-list) → Task 4 ✓; (6) source/attribution + dormant-key note → Task 2 footer ✓; (7) CSV/GeoJSON + show-on-map → Task 2 footer ✓. "Wire count-history recording" → Task 2 `recordSeries` effect ✓.
- **Type consistency:** `SortKey`, `distribution`, `timeModel`, `sortFeatures`, `humaniseKey`, `declaredSeverity` names match across Tasks 1→4. `Chart`/`InsetMap`/export/`signalsStore.set`/`shellLayoutStore.unfocus` signatures verified against source.
- **Honesty:** distribution returns `none` (panel hidden) when a source has neither magnitude nor severity; undated features counted, not dropped; "N of M in scope"; dormant-key note for the 6 keyed sources.
