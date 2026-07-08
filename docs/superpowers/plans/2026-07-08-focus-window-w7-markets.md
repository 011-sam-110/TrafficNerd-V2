# W7 — Markets detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The milestone the user cares most about — "for markets, it shows actual graphs." A markets console focus view with real 1M/6M/1Y historical charts (keyless Yahoo v8 OHLC), an instrument rail grouped by asset class with movers-first ordering, a selected-instrument primary chart + period change + 52-week hi/lo, a sortable instrument table with a stats drill-down, and CSV export.

**Architecture:** New default-export `MarketsDetail(props: WidgetDetailProps)` registered as `detail:` on `MARKETS_WIDGET`. It reuses `useJsonPoll("/api/markets")` for the live quote list (same as the docked widget) and adds a NEW keyless `/api/markets/chart` route that proxies Yahoo v8 OHLC for the selected instrument + range. Pure series parsing lives in a testable `lib/markets/chart.ts`. The shared `<Chart>` gains a `zeroBaseline` opt-out (market prices sit far from 0 and would squash against a 0 baseline). When the chart route is dormant/empty, the view honestly falls back to the accumulated live price series (`mkt:<id>` in `lib/series.ts`, ≤48 samples), clearly labelled "live session".

**Tech Stack:** Next 15 / React 19 / TS; native SVG `<Chart>`; keyless Yahoo v8 finance chart; vitest.

## Global Constraints

- Keyless-first, dormant-safe: the chart route MUST resolve to empty (never 5xx) on upstream failure; the view falls back to the live `mkt:<id>` series. Honest labels: "delayed, keyless"; "live session" for the fallback; "indicative only — not financial advice".
- Native `<Chart>` only (no new chart deps). Theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1`.
- The `<Chart>` change MUST be backward-compatible: `zeroBaseline` defaults to `true` (current behaviour) so every existing caller (events/signals/aviation/cameras details) is unaffected.
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."`.
- Owned files only; never `git add -A`/`checkout`/`reset`/`stash`; do not touch `.superpowers/sdd/progress.md`.
- **Verify every signature against source** (interfaces below are from a research pass): `useJsonPoll`, `MarketsPayload`/`MarketSection`/`MarketRow` (`lib/markets.ts`), the existing Yahoo fetch helper (`getJson`) + keyless-symbol set in `app/api/markets/route.ts`, `seriesSamples`/`recordSeries`, `Chart` internals (`components/Chart.tsx`), `shellLayoutStore.configure/.unfocus`.

## Reference pattern

`lib/console/widgets/aviation.detail.tsx` / `signals.detail.tsx` for the detail skeleton (masthead, panels grid, table, footer, export). `app/api/signals/[id]/route.ts` and the existing `app/api/markets/route.ts` for the dormant-safe cached-route pattern (getJson swallows errors, returns last-good/empty, never 5xx).

## Data shapes (verify, then consume)

- `MarketsPayload = { generatedAt: number; sections: MarketSection[] }`; `MarketSection = { key; label; source: string; dormant?: boolean; note?: string; rows: MarketRow[] }`; `MarketRow = { id: string; name: string; symbol?: string; value: string; num?: number; changePct?: number|null; sub?: string; image? }` — `lib/markets.ts`.
- `useJsonPoll<T>(url, pollMs, initial): { data, status }` — `lib/console/widgets/useJsonPoll.ts`.
- `MARKETS_WIDGET` — plain object in `lib/console/widgets/markets.tsx`, `registerWidget(MARKETS_WIDGET)`. Attach `detail: MarketsDetail`.
- Live series: `seriesSamples("mkt:"+row.id): CountSample[]` ({t,n}) — already recorded by the docked widget each poll.
- `Chart({ points, width?, height?, area?, up? })` — `components/Chart.tsx`; baseline currently `extent([0, ...ys])` at line ~27.
- Yahoo v8 chart JSON: `{ chart: { result: [ { meta, timestamp: number[] /*unix s*/, indicators: { quote: [ { open:number[], high:number[], low:number[], close:number[], volume:number[] } ], adjclose?: [ { adjclose:number[] } ] } } ], error } }`.

## File Structure

- Create `lib/markets/chart.ts` (pure series parsing + helpers), `app/api/markets/chart/route.ts`, `lib/console/widgets/markets.detail.tsx`, `tests/unit/markets-series.test.ts`.
- Modify `components/Chart.tsx` (`zeroBaseline`), `app/api/markets/route.ts` (add `^VIX`/`^TNX` to the keyless set — optional macro), `lib/console/widgets/markets.tsx` (attach `detail:`), `app/globals.css` (`.tn-mk*`).

---

### Task 1: Pure Yahoo-series parsing + helpers

**Files:** Create `lib/markets/chart.ts`; Test `tests/unit/markets-series.test.ts`.

**Produces:** `Candle`, `parseYahooSeries`, `candlesToPoints`, `periodChange`, `hiLo`, `Range`, `RANGES`.

- [ ] **Step 1: `lib/markets/chart.ts`**

```ts
// Pure parsing/derivation for the Markets focus charts. The chart ROUTE fetches
// keyless Yahoo v8 OHLC; this module turns that JSON into candles + the derived
// figures the UI shows (period change, hi/lo), and projects candles to Chart points.
// Pure + isomorphic so it unit-tests against a captured fixture.

export type Range = "1mo" | "6mo" | "1y";
export const RANGES: Range[] = ["1mo", "6mo", "1y"];

export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

interface YahooQuote { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[]; volume?: (number | null)[] }
interface YahooResult { timestamp?: number[]; indicators?: { quote?: YahooQuote[] } }
export interface YahooChartResponse { chart?: { result?: YahooResult[] | null; error?: unknown } }

/** Pure: Yahoo v8 chart JSON → candles (drops rows with a null close). t is epoch ms. */
export function parseYahooSeries(json: YahooChartResponse | null | undefined): Candle[] {
  const r = json?.chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const q = r?.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close?.[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue; // holidays / gaps
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], v = q.volume?.[i];
    out.push({
      t: ts[i] * 1000,
      o: typeof o === "number" ? o : c,
      h: typeof h === "number" ? h : c,
      l: typeof l === "number" ? l : c,
      c,
      v: typeof v === "number" ? v : 0,
    });
  }
  return out;
}

export interface ChartPointLite { x: number; y: number }
/** Close-price line points (the default "actual graph"). */
export function candlesToPoints(candles: Candle[]): ChartPointLite[] {
  return candles.map((k) => ({ x: k.t, y: k.c }));
}

/** Absolute + percent change from first to last close; zeros on <2 candles. */
export function periodChange(candles: Candle[]): { abs: number; pct: number } {
  if (candles.length < 2) return { abs: 0, pct: 0 };
  const first = candles[0].c, last = candles[candles.length - 1].c;
  const abs = last - first;
  return { abs, pct: first !== 0 ? (abs / first) * 100 : 0 };
}

/** Min low / max high across the range (the "52-week" hi/lo when range=1y). */
export function hiLo(candles: Candle[]): { hi: number; lo: number } | null {
  if (candles.length === 0) return null;
  let hi = -Infinity, lo = Infinity;
  for (const k of candles) { if (k.h > hi) hi = k.h; if (k.l < lo) lo = k.l; }
  return { hi, lo };
}
```

- [ ] **Step 2: `tests/unit/markets-series.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseYahooSeries, candlesToPoints, periodChange, hiLo, type YahooChartResponse } from "@/lib/markets/chart";

const json: YahooChartResponse = {
  chart: { result: [ {
    timestamp: [1704067200, 1704153600, 1704240000],
    indicators: { quote: [ { open: [100, 102, null], high: [105, 106, 104], low: [99, 101, 100], close: [102, 104, null], volume: [10, 12, 0] } ] },
  } ] },
};

describe("parseYahooSeries", () => {
  it("zips timestamps + OHLC, drops null-close rows, converts to ms", () => {
    const c = parseYahooSeries(json);
    expect(c.length).toBe(2); // third row has null close → dropped
    expect(c[0]).toEqual({ t: 1704067200000, o: 100, h: 105, l: 99, c: 102, v: 10 });
  });
  it("is dormant-safe on missing data", () => {
    expect(parseYahooSeries(null)).toEqual([]);
    expect(parseYahooSeries({ chart: { result: null } })).toEqual([]);
  });
});

describe("derivations", () => {
  it("periodChange first→last close", () => {
    const c = parseYahooSeries(json);
    expect(periodChange(c).abs).toBe(2); // 104 - 102
    expect(Math.round(periodChange(c).pct * 100) / 100).toBe(1.96);
  });
  it("hiLo spans all candles", () => {
    expect(hiLo(parseYahooSeries(json))).toEqual({ hi: 106, lo: 99 });
  });
  it("candlesToPoints maps close to y", () => {
    expect(candlesToPoints(parseYahooSeries(json))[0]).toEqual({ x: 1704067200000, y: 102 });
  });
});
```

- [ ] **Step 3: Gate + commit** — green.
`git add lib/markets/chart.ts tests/unit/markets-series.test.ts`
`git commit -m "feat(markets): pure Yahoo v8 OHLC series parsing + period/hi-lo derivations"`

---

### Task 2: Keyless `/api/markets/chart` route

**Files:** Create `app/api/markets/chart/route.ts`; optionally Modify `app/api/markets/route.ts` (add `^VIX`/`^TNX` to the keyless symbol set for a macro panel).

- [ ] **Step 1:** `GET /api/markets/chart?symbol=<yahoo>&range=1mo|6mo|1y` → `{ candles: Candle[] }`. Mirror the existing markets route's dormant-safe pattern (reuse its `getJson`/fetch helper; per-`symbol:range` in-memory cache ~5 min). Fetch `https://query1.finance.yahoo.com/v8/finance/chart/<symbol>?range=<range>&interval=<1d for 1mo/6mo, 1wk for 1y>` with the same UA header the markets route uses, `parseYahooSeries(json)`, and return `{ candles }`. Validate `range ∈ RANGES` and `symbol` (non-empty, `^?[A-Za-z0-9.=\-]+`) — reject others with `{ candles: [] }`. On any upstream error return `{ candles: [] }` (never 5xx).

- [ ] **Step 2 (optional macro):** In `app/api/markets/route.ts`, add `^VIX` and `^TNX` to the keyless Yahoo symbol set so the detail can show a small macro panel (VIX + US 10Y). If the set is not trivially extendable, skip and note it.

- [ ] **Step 3: Gate + commit** — green (add a light route test only if the repo has route tests; otherwise the pure parse is already covered).
`git add app/api/markets/chart/route.ts app/api/markets/route.ts`
`git commit -m "feat(markets): keyless /api/markets/chart route (Yahoo v8 OHLC, dormant-safe)"`

---

### Task 3: `<Chart>` non-zero baseline + value markers

**Files:** Modify `components/Chart.tsx`.

- [ ] **Step 1:** Add `zeroBaseline?: boolean` (default `true`) to the props. When `true`, keep `sy = linear(extent([0, ...ys]), …)` (current). When `false`, use `sy = linear(extent(ys), …)` so price lines auto-fit. Optionally add `markers?: boolean` (default false) that, when true, draws small circles at the min-low, max-high, and last points with tiny value labels. Keep every existing prop + default identical — this is additive and backward-compatible.

```tsx
// in the props type:
zeroBaseline?: boolean;
// …
const sy = linear(extent(zeroBaseline === false ? ys : [0, ...ys]), [height - pad, pad]);
```

- [ ] **Step 2:** Confirm no existing caller passes `zeroBaseline` (they rely on the default `true`) — a repo-wide grep. Gate + commit.
`git add components/Chart.tsx`
`git commit -m "feat(chart): opt-out zeroBaseline so price series auto-fit (backward-compatible)"`

---

### Task 4: Detail skeleton — masthead + instrument rail + movers heat-strip + register

**Files:** Create `lib/console/widgets/markets.detail.tsx`; Modify `lib/console/widgets/markets.tsx`, `app/globals.css`.

- [ ] **Step 1:** `MarketsDetail({ instanceId, config }: WidgetDetailProps)`:
  - `useJsonPoll<MarketsPayload>("/api/markets", 120000, { generatedAt: 0, sections: [] })`.
  - Masthead: title "Markets", section count + total instruments, freshness from `generatedAt`, "indicative only — not financial advice".
  - Instrument rail: grouped by `section` (label + `section.source` attribution + dormant note); within each section, rows ordered biggest-mover-first (`|changePct|` desc); each row shows name/symbol, value, `changePct` (green/red), and a tiny `mkt:<id>` sparkline (`seriesSamples` → `<Chart height={28} zeroBaseline={false}>`). Clicking a row selects it (Task 5).
  - Movers heat-strip: top gainers/losers across all sections (colour scaled by `changePct`).
  - Selected instrument state: `const [selId, setSelId] = useState<string | null>(<first row id>)`; persist via `shellLayoutStore.configure(instanceId, { selectedId })` (optional).

- [ ] **Step 2:** Add `detail: MarketsDetail` + import to `MARKETS_WIDGET` in `markets.tsx`.

- [ ] **Step 3:** Append `.tn-mk*` CSS (masthead, section rail, row with sparkline, heat-strip, chart panel, range tabs, table, footer). Theme tokens only.

- [ ] **Step 4: Gate + commit** — green.
`git commit -m "feat(markets): focus detail skeleton — instrument rail + movers heat-strip"`

---

### Task 5: Primary historical chart + range tabs + instrument table + drill-down

**Files:** Modify `lib/console/widgets/markets.detail.tsx`.

- [ ] **Step 1:** Selected-instrument primary chart:
  - `const [range, setRange] = useState<Range>("6mo")`. Fetch `/api/markets/chart?symbol=<row.symbol ?? row.id>&range=<range>` in an effect (dormant-safe; store `candles`). Render `<Chart points={candlesToPoints(candles)} height={220} zeroBaseline={false} up={periodChange(candles).abs >= 0} markers />`.
  - **Honest fallback:** when `candles.length < 2` (route dormant / no history), chart the accumulated live series `seriesSamples("mkt:"+selId)` instead, labelled "live session (accumulating) — historical unavailable".
  - Range tabs 1M/6M/1Y (`RANGES`), period change (`periodChange`) + hi/lo (`hiLo`, labelled "52-wk range" when range=1y).
  - Which symbol to query: prefer `row.symbol`; some ids are crypto/FX — if the query returns empty for a symbol, fall back to the live series (already handled by the <2-candle guard). Don't invent symbols.
  - Sortable instrument table (name / changePct / value) across all sections; row click sets `selId`; open row drill shows stats (value, changePct, `sub` = mkt cap text, section source as-of).

- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(markets): focus detail — historical chart + 1M/6M/1Y tabs + instrument table"`

---

### Task 6: Footer — attribution + CSV export

**Files:** Modify `lib/console/widgets/markets.detail.tsx`.

- [ ] **Step 1:** Footer: per-section attribution (`section.source` strings) + "Indicative only — not financial advice." Export (disabled when empty): CSV of all instruments (section, name, symbol, value, num, changePct) via `toCsv`/`downloadText`/`exportFilename("markets", Date.now())`; and a per-selected-instrument OHLC CSV (t, o, h, l, c, v) from `candles` when present.

- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(markets): focus detail — attribution/disclaimer footer + CSV (quotes + OHLC) export"`

---

### Task 7: Verification

- [ ] Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] Confirm the chart route is dormant-safe (empty on bad symbol / upstream fail, never 5xx) and the view falls back to the live series honestly.
- [ ] Confirm `zeroBaseline` default did not change any existing Chart caller.
- [ ] If the integrator has a browser: expand the Markets widget, confirm the rail, a real 1M/6M/1Y chart for an equity/index, the fallback label for a symbol without history, table sort + drill, export. Otherwise note live visual verification pending.

## Self-Review

- **Spec §7.7 coverage:** (1) instrument rail grouped by asset class, mini-spark, movers-first → Task 4 ✓; (2) primary historical chart + 1M/6M/1Y tabs + period change + hi/lo → Tasks 2+5 ✓ (candlestick/crosshair deferred as spec nice-to-have — line/area with markers delivers "actual graphs"; OHLC IS fetched and exported); (3) instrument stats drill-down → Task 5 ✓; (4) movers heat-strip → Task 4 ✓; (5) macro panel VIX/10Y → Task 2 optional ✓; (6) footer attribution + disclaimer + CSV + OHLC export → Task 6 ✓. New backend `/api/markets/chart` → Task 2 ✓.
- **Type consistency:** `Candle`/`Range`/`RANGES`/`parseYahooSeries`/`candlesToPoints`/`periodChange`/`hiLo` names match across Tasks 1→6; `zeroBaseline` prop consistent.
- **Honesty:** real OHLC when available, explicit "live session" fallback when not; "delayed, keyless"; "not financial advice"; dormant-safe route; no invented symbols; `<Chart>` change backward-compatible.
- **Risk flagged:** symbol mapping — `MarketRow.symbol` may not be a Yahoo ticker for crypto/FX. The <2-candle fallback to the live series keeps every instrument honest even when its symbol has no Yahoo history; do NOT hard-fail or fabricate. A full CoinGecko/Frankfurter symbol map is out of scope this pass (fallback covers it).
