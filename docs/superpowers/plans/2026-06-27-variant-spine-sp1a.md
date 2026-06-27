# SP1a · Variant Spine (no-RGL shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shell config-driven — one `Variant` object seeds layers, signal layers, theme, accent, camera filter and map view; ship all 13 built-in variants, a header variant selector, per-variant override persistence, and shareable `?v=` URLs — with **no react-grid-layout** (that is SP1b).

**Architecture:** A new `variantStore` is the single load-time hydration authority. On boot it resolves `preset defaults → saved per-variant override → URL params`, then *seeds* the existing runtime stores (`layersStore`, `signalsStore`, `uiStore`, `cameraFilterStore`, `mapViewStore`) through their setters. The old `tn.layers.v1` / `tn.signals.v1` / `tn.ui.v1` keys become write-through caches, no longer read on load. A `PANEL_REGISTRY` + `PanelHost` render the persistent chrome (rail / freshness / news) per the active variant's panel set; on-demand slide-ins keep their existing open-stores (full docking = SP1b).

**Tech Stack:** Next.js 15.5.19, React 19.0.0, TypeScript, vitest (node env), framework-light `useSyncExternalStore` external stores, versioned `localStorage` via `lib/shell/persist.ts`.

**Spec:** `docs/superpowers/specs/2026-06-27-variant-spine-design.md` (read §3 taxonomy + §5 hydration before starting).

## Global Constraints

- **Versions:** React `19.0.0`, Next `15.5.19` — do NOT add react-grid-layout / @dnd-kit in SP1a.
- **Keyless:** no new outbound origins; all media stays behind `/api/proxy` + `/api/hls`. Variants only re-weight existing layers.
- **Store pattern:** every new store uses `useSyncExternalStore` with a module-level `state` + `Set<listener>` + `emit()`, mirroring `lib/layers.ts`.
- **Persistence:** only via `loadPersisted(key, version)` / `savePersisted(key, version, value)` from `@/lib/shell/persist`. New key: `tn.variant.v1`, version `1`.
- **Path alias:** import with `@/…`.
- **Tests:** in `tests/unit/*.test.ts`, run with `npx vitest run`. Keep the existing baseline green — read the real count with `npx vitest run` first; do not assume.
- **Build:** `npm run build` (ESLint) is authoritative; NEVER run `next dev` concurrently with it. `noUnusedLocals` is OFF — the build, not tsc, is the real gate.
- **Commits:** SOLO-attributed, **no Claude trailer** (repo convention). One commit per task.
- **`explore` is the default variant; first paint = globe + left layer rail only.**

---

### Task 1: Variant types + 13 built-in variants

**Files:**
- Create: `lib/variants/types.ts`
- Create: `lib/variants/builtins.ts`
- Test: `tests/unit/variants-builtins.test.ts`

**Interfaces:**
- Produces: `PanelKey`, `PanelPlacement`, `SignalSelection`, `OverrideDelta`, `Variant` (types); `BUILTIN_VARIANTS: Variant[]`, `BUILTIN_BY_ID: Record<string, Variant>`, `DEFAULT_VARIANT_ID = "explore"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/variants-builtins.test.ts
import { describe, it, expect } from "vitest";
import { BUILTIN_VARIANTS, BUILTIN_BY_ID, DEFAULT_VARIANT_ID } from "@/lib/variants/builtins";
import { SIGNALS } from "@/lib/signals/registry";

describe("built-in variants", () => {
  it("has explore as the default and it is minimal", () => {
    expect(DEFAULT_VARIANT_ID).toBe("explore");
    const explore = BUILTIN_BY_ID["explore"];
    expect(explore).toBeTruthy();
    expect(explore.layers.cameras).toBe(true);
    expect(explore.layers.planes).toBe(true);
    expect(explore.signals).toBeUndefined(); // no intel layers in the calm default
    expect(explore.panels.filter((p) => p.visible).map((p) => p.panel)).toEqual(["layerRail"]);
  });

  it("covers every registry signal group across the variant set", () => {
    const allGroups = new Set(SIGNALS.map((s) => s.group));
    const covered = new Set<string>();
    for (const v of BUILTIN_VARIANTS) {
      for (const g of v.signals?.groups ?? []) covered.add(g);
      // 'intel' selects all groups via a sentinel handled in resolveSignals
      if (v.id === "intel") allGroups.forEach((g) => covered.add(g));
    }
    // ids-bound variants contribute their ids' groups too
    const idGroup = new Map(SIGNALS.map((s) => [s.id, s.group]));
    for (const v of BUILTIN_VARIANTS) for (const id of v.signals?.ids ?? []) {
      const g = idGroup.get(id); if (g) covered.add(g);
    }
    for (const g of allGroups) expect(covered.has(g), `group "${g}" uncovered`).toBe(true);
  });

  it("only references signal ids that exist in the registry", () => {
    const ids = new Set(SIGNALS.map((s) => s.id));
    for (const v of BUILTIN_VARIANTS) for (const id of [...(v.signals?.ids ?? []), ...(v.signals?.exclude ?? [])]) {
      expect(ids.has(id), `unknown id "${id}" in ${v.id}`).toBe(true);
    }
  });

  it("has 13 variants with unique ids", () => {
    expect(BUILTIN_VARIANTS).toHaveLength(13);
    expect(new Set(BUILTIN_VARIANTS.map((v) => v.id)).size).toBe(13);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/variants-builtins.test.ts`
Expected: FAIL — cannot find module `@/lib/variants/builtins`.

- [ ] **Step 3: Write the types**

```ts
// lib/variants/types.ts
import type { LayerState } from "@/lib/layers";
import type { CameraFilterState } from "@/lib/cameraFilter";
import type { Theme } from "@/lib/shell/ui";

export type PanelKey =
  | "layerRail" | "markets" | "brief"
  | "freshness" | "news" | "watchlist" | "coverage";
// NOTE: 'dossier' is intentionally NOT a panel — it is the FeedOverlay slide-in
// (transient, deep-linked via ?obj=), kept as overlay chrome.

export interface PanelPlacement {
  panel: PanelKey;
  /** Grid geometry — carried for SP1b (react-grid-layout); unused in SP1a. */
  grid: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  visible: boolean;
}

export interface SignalSelection {
  /** Registry `group` strings, or the sentinel "*" for all groups (intel). */
  groups?: string[];
  ids?: string[];
  exclude?: string[];
}

/** Persisted divergence of the live session from a preset. */
export interface OverrideDelta {
  layers?: Partial<LayerState>;
  signals?: Record<string, boolean>;
  theme?: Theme;
}

export interface Variant {
  id: string;
  builtin: boolean;
  title: string;
  tone?: string;
  accent: string; // hex → --accent
  theme: Theme;
  layers: Partial<LayerState>;
  signals?: SignalSelection;
  panels: PanelPlacement[];
  view?: { lon: number; lat: number; zoom: number };
  cameraFilter?: Partial<CameraFilterState>;
}
```

- [ ] **Step 4: Write the built-in variants**

```ts
// lib/variants/builtins.ts
import type { PanelKey, Variant } from "@/lib/variants/types";

export const DEFAULT_VARIANT_ID = "explore";

// Helper: persistent panels live in fixed slots in SP1a; grid is for SP1b.
const slot = (panel: PanelKey, visible = true): { panel: PanelKey; grid: { x: number; y: number; w: number; h: number }; visible: boolean } =>
  ({ panel, grid: { x: 0, y: 0, w: 3, h: 4 }, visible });

export const BUILTIN_VARIANTS: Variant[] = [
  { id: "explore", builtin: true, title: "Explore", accent: "#2563eb", theme: "light",
    layers: { cameras: true, planes: true, satellites: false, webcams: false },
    panels: [slot("layerRail")], tone: "calm" },

  { id: "intel", builtin: true, title: "Intel", accent: "#0f172a", theme: "light",
    layers: { cameras: true, planes: true, satellites: true },
    signals: { groups: ["*"] },
    panels: [slot("layerRail"), slot("freshness"), slot("brief"), slot("markets"), slot("news")] },

  { id: "cameras", builtin: true, title: "Cameras", accent: "#7c3aed", theme: "light",
    layers: { cameras: true, webcams: true, planes: false, satellites: false },
    cameraFilter: { liveOnly: true }, panels: [slot("layerRail")] },

  { id: "aviation", builtin: true, title: "Aviation", accent: "#0891b2", theme: "light",
    layers: { planes: true, cameras: false, satellites: false },
    signals: { ids: ["military-air", "airports", "launches"] },
    panels: [slot("layerRail"), slot("freshness")] },

  { id: "maritime", builtin: true, title: "Maritime", accent: "#0e7490", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Maritime"], ids: ["ports", "cables"] },
    panels: [slot("layerRail"), slot("freshness")] },

  { id: "orbital", builtin: true, title: "Orbital", accent: "#4338ca", theme: "light",
    layers: { satellites: true, cameras: false, planes: false },
    signals: { groups: ["Space", "Space weather"] },
    panels: [slot("layerRail")] },

  { id: "hazards", builtin: true, title: "Hazards", accent: "#b45309", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Natural hazards", "Weather"] },
    panels: [slot("layerRail"), slot("freshness"), slot("news")] },

  { id: "geopolitics", builtin: true, title: "Geopolitics", accent: "#b91c1c", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Conflict", "Intel", "Military"], ids: ["displacement", "instability"] },
    panels: [slot("layerRail"), slot("brief"), slot("news"), slot("freshness")] },

  { id: "humanitarian", builtin: true, title: "Humanitarian", accent: "#047857", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Human cost"], ids: ["airquality", "instability"] },
    panels: [slot("layerRail"), slot("brief"), slot("freshness")] },

  { id: "infrastructure", builtin: true, title: "Infrastructure", accent: "#6d28d9", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Infrastructure"] },
    panels: [slot("layerRail"), slot("freshness")] },

  { id: "cyber", builtin: true, title: "Cyber", accent: "#1d4ed8", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Cyber threat"], ids: ["internet-outages"] },
    panels: [slot("layerRail"), slot("news"), slot("freshness")] },

  { id: "civic", builtin: true, title: "Civic", accent: "#9333ea", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { groups: ["Civic safety", "Environment"] },
    panels: [slot("layerRail"), slot("freshness")] },

  { id: "markets", builtin: true, title: "Markets", accent: "#15803d", theme: "light",
    layers: { cameras: false, planes: false, satellites: false },
    signals: { ids: ["instability"] },
    panels: [slot("layerRail"), slot("markets"), slot("brief")] },
];

export const BUILTIN_BY_ID: Record<string, Variant> = Object.fromEntries(
  BUILTIN_VARIANTS.map((v) => [v.id, v]),
);
```

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run tests/unit/variants-builtins.test.ts`
Expected: PASS (4 tests).

```bash
git add lib/variants/types.ts lib/variants/builtins.ts tests/unit/variants-builtins.test.ts
git commit -m "feat(variants): variant data model + 13 built-in variants"
```

---

### Task 2: resolveSignals — selection → SignalState

**Files:**
- Create: `lib/variants/resolveSignals.ts`
- Test: `tests/unit/variants-resolveSignals.test.ts`

**Interfaces:**
- Consumes: `SignalSelection` (Task 1); `SIGNALS` from `@/lib/signals/registry`.
- Produces: `resolveSignals(sel?: SignalSelection): SignalState` — `{}` when `sel` is undefined; `"*"` group ⇒ all registry ids; applies `groups` ∪ `ids`, then drops `exclude`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/variants-resolveSignals.test.ts
import { describe, it, expect } from "vitest";
import { resolveSignals } from "@/lib/variants/resolveSignals";
import { SIGNALS } from "@/lib/signals/registry";

describe("resolveSignals", () => {
  it("returns {} for no selection", () => {
    expect(resolveSignals(undefined)).toEqual({});
  });
  it("'*' selects every registry id as true", () => {
    const r = resolveSignals({ groups: ["*"] });
    expect(Object.keys(r).length).toBe(SIGNALS.length);
    expect(Object.values(r).every((v) => v === true)).toBe(true);
  });
  it("selects a group by name", () => {
    const r = resolveSignals({ groups: ["Cyber threat"] });
    expect(r["cyber-c2"]).toBe(true);
    expect(r["cyber-ransomware"]).toBe(true);
    expect(r["earthquakes"]).toBeUndefined();
  });
  it("unions ids with groups then applies exclude", () => {
    const r = resolveSignals({ groups: ["Cyber threat"], ids: ["internet-outages"], exclude: ["cyber-c2"] });
    expect(r["internet-outages"]).toBe(true);
    expect(r["cyber-ransomware"]).toBe(true);
    expect(r["cyber-c2"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/variants-resolveSignals.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/variants/resolveSignals.ts
import type { SignalSelection } from "@/lib/variants/types";
import type { SignalState } from "@/lib/signals/store";
import { SIGNALS } from "@/lib/signals/registry";

export function resolveSignals(sel?: SignalSelection): SignalState {
  if (!sel) return {};
  const on = new Set<string>();
  const groups = sel.groups ?? [];
  const all = groups.includes("*");
  for (const s of SIGNALS) {
    if (all || groups.includes(s.group)) on.add(s.id);
  }
  for (const id of sel.ids ?? []) on.add(id);
  for (const id of sel.exclude ?? []) on.delete(id);
  const out: SignalState = {};
  for (const id of on) out[id] = true;
  return out;
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/unit/variants-resolveSignals.test.ts`
Expected: PASS (4 tests).

```bash
git add lib/variants/resolveSignals.ts tests/unit/variants-resolveSignals.test.ts
git commit -m "feat(variants): resolveSignals — selection expands against the registry"
```

---

### Task 3: `applyExact` setters on the layer + signal stores

**Files:**
- Modify: `lib/layers.ts` (add `applyExact`)
- Modify: `lib/signals/store.ts` (add `applyExact`)
- Test: `tests/unit/store-applyExact.test.ts`

**Interfaces:**
- Produces: `layersStore.applyExact(next: LayerState): void` (replaces all toggles, merging over `DEFAULT_STATE`); `signalsStore.applyExact(next: SignalState): void` (replaces the whole on-set).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/store-applyExact.test.ts
import { describe, it, expect } from "vitest";
import { layersStore } from "@/lib/layers";
import { signalsStore } from "@/lib/signals/store";

describe("applyExact", () => {
  it("layersStore.applyExact replaces the on-set over defaults", () => {
    layersStore.applyExact({ cameras: false, planes: true, satellites: true, ships: false, webcams: false, weather: false });
    expect(layersStore.get().planes).toBe(true);
    expect(layersStore.get().cameras).toBe(false);
  });
  it("signalsStore.applyExact replaces the whole on-set", () => {
    signalsStore.set("earthquakes", true);
    signalsStore.applyExact({ "cyber-c2": true });
    expect(signalsStore.isOn("cyber-c2")).toBe(true);
    expect(signalsStore.isOn("earthquakes")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/store-applyExact.test.ts`
Expected: FAIL — `applyExact` is not a function.

- [ ] **Step 3: Add `applyExact` to `lib/layers.ts`**

Add this method inside the `layersStore` object (after `applyPreset`):

```ts
  applyExact(next: LayerState) {
    state = { ...DEFAULT_STATE, ...next };
    emit();
  },
```

- [ ] **Step 4: Add `applyExact` to `lib/signals/store.ts`**

Add this method inside the `signalsStore` object (after `set`):

```ts
  applyExact(next: SignalState) {
    state = { ...next };
    emit();
  },
```

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run tests/unit/store-applyExact.test.ts`
Expected: PASS (2 tests).

```bash
git add lib/layers.ts lib/signals/store.ts tests/unit/store-applyExact.test.ts
git commit -m "feat(stores): applyExact bulk setters for variant seeding"
```

---

### Task 4: `diffFromVariant` — capture session divergence

**Files:**
- Create: `lib/variants/diff.ts`
- Test: `tests/unit/variants-diff.test.ts`

**Interfaces:**
- Consumes: `Variant`, `OverrideDelta` (Task 1); `resolveSignals` (Task 2); `LayerState`, `SignalState`, `Theme`.
- Produces: `diffFromVariant(live: { layers: LayerState; signals: SignalState; theme: Theme }, preset: Variant): OverrideDelta` — only keys that differ; **signals compared with absent ≡ false**. Also `isEmptyDelta(d: OverrideDelta): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/variants-diff.test.ts
import { describe, it, expect } from "vitest";
import { diffFromVariant, isEmptyDelta } from "@/lib/variants/diff";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";
import { DEFAULT_STATE } from "@/lib/layers";

const explore = BUILTIN_BY_ID["explore"];

describe("diffFromVariant", () => {
  it("is empty when live matches the preset", () => {
    const layers = { ...DEFAULT_STATE, cameras: true, planes: true, satellites: false, webcams: false };
    const d = diffFromVariant({ layers, signals: {}, theme: "light" }, explore);
    expect(isEmptyDelta(d)).toBe(true);
  });
  it("captures a turned-off layer", () => {
    const layers = { ...DEFAULT_STATE, cameras: false, planes: true, satellites: false, webcams: false };
    const d = diffFromVariant({ layers, signals: {}, theme: "light" }, explore);
    expect(d.layers?.cameras).toBe(false);
  });
  it("treats a signal absent in the preset but on live as a diff", () => {
    const layers = { ...DEFAULT_STATE, cameras: true, planes: true };
    const d = diffFromVariant({ layers, signals: { earthquakes: true }, theme: "light" }, explore);
    expect(d.signals?.earthquakes).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/variants-diff.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// lib/variants/diff.ts
import type { Variant, OverrideDelta } from "@/lib/variants/types";
import type { LayerState } from "@/lib/layers";
import type { SignalState } from "@/lib/signals/store";
import type { Theme } from "@/lib/shell/ui";
import { DEFAULT_STATE } from "@/lib/layers";
import { resolveSignals } from "@/lib/variants/resolveSignals";
import { SIGNALS } from "@/lib/signals/registry";

export function diffFromVariant(
  live: { layers: LayerState; signals: SignalState; theme: Theme },
  preset: Variant,
): OverrideDelta {
  const out: OverrideDelta = {};

  const presetLayers = { ...DEFAULT_STATE, ...preset.layers } as LayerState;
  const layerDiff: Partial<LayerState> = {};
  for (const k of Object.keys(live.layers) as (keyof LayerState)[]) {
    if (live.layers[k] !== presetLayers[k]) layerDiff[k] = live.layers[k];
  }
  if (Object.keys(layerDiff).length) out.layers = layerDiff;

  const presetSignals = resolveSignals(preset.signals); // id→true (absent ≡ false)
  const sigDiff: Record<string, boolean> = {};
  for (const s of SIGNALS) {
    const liveOn = live.signals[s.id] === true;
    const presetOn = presetSignals[s.id] === true;
    if (liveOn !== presetOn) sigDiff[s.id] = liveOn;
  }
  if (Object.keys(sigDiff).length) out.signals = sigDiff;

  if (live.theme !== preset.theme) out.theme = live.theme;
  return out;
}

export function isEmptyDelta(d: OverrideDelta): boolean {
  return !d.layers && !d.signals && d.theme === undefined;
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/unit/variants-diff.test.ts`
Expected: PASS (3 tests).

```bash
git add lib/variants/diff.ts tests/unit/variants-diff.test.ts
git commit -m "feat(variants): diffFromVariant — capture session override delta"
```

---

### Task 5: URL codec — carry `?v=` + `?sig=`

**Files:**
- Modify: `lib/share/url.ts`
- Test: `tests/unit/url-variant.test.ts`

**Interfaces:**
- Consumes: existing `ViewState`, `encodeViewState`, `decodeViewState`.
- Produces: `ViewState` extended with `v?: string` and `sig?: string[]` (on-signal ids). `v` is `[a-z0-9-]{1,32}`; `sig` is validated against registry ids, capped at 40 ids.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/url-variant.test.ts
import { describe, it, expect } from "vitest";
import { encodeViewState, decodeViewState } from "@/lib/share/url";

describe("url variant params", () => {
  it("round-trips v + sig", () => {
    const qs = encodeViewState({ v: "intel", sig: ["earthquakes", "cyber-c2"] });
    const back = decodeViewState(new URLSearchParams(qs));
    expect(back.v).toBe("intel");
    expect(back.sig).toEqual(["earthquakes", "cyber-c2"]);
  });
  it("drops an invalid variant id and unknown signal ids", () => {
    const back = decodeViewState(new URLSearchParams("v=BAD*ID&sig=earthquakes,not-a-signal"));
    expect(back.v).toBeUndefined();
    expect(back.sig).toEqual(["earthquakes"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/url-variant.test.ts`
Expected: FAIL — `v` is undefined on the decoded state.

- [ ] **Step 3: Extend `lib/share/url.ts`**

Add near the top (after the existing `VALID_BASEMAPS` line):

```ts
import { SIGNALS } from "@/lib/signals/registry";
const VALID_SIGNALS = new Set<string>(SIGNALS.map((s) => s.id));
const VARIANT_RE = /^[a-z0-9-]{1,32}$/;
const SIG_MAX = 40;
```

Add to the `ViewState` interface:

```ts
  /** Active variant id. */
  v?: string;
  /** On-signal ids (divergence from the variant's defaults). */
  sig?: string[];
```

In `encodeViewState`, before `return p.toString();`:

```ts
  if (state.v && VARIANT_RE.test(state.v)) p.set("v", state.v);
  if (state.sig) {
    const ids = state.sig.filter((s) => VALID_SIGNALS.has(s)).slice(0, SIG_MAX);
    p.set("sig", ids.join(","));
  }
```

In `decodeViewState`, before `return out;`:

```ts
  const v = params.get("v");
  if (v && VARIANT_RE.test(v)) out.v = v;
  if (params.has("sig")) {
    out.sig = (params.get("sig") ?? "")
      .split(",").map((s) => s.trim())
      .filter((s) => VALID_SIGNALS.has(s)).slice(0, SIG_MAX);
  }
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/unit/url-variant.test.ts`
Expected: PASS (2 tests).

```bash
git add lib/share/url.ts tests/unit/url-variant.test.ts
git commit -m "feat(share): carry variant id + signal divergence in the URL"
```

---

### Task 6: `variantStore` — the single hydration authority

**Files:**
- Create: `lib/variants/store.ts`
- Test: `tests/unit/variants-store.test.ts`

**Interfaces:**
- Consumes: `BUILTIN_BY_ID`, `DEFAULT_VARIANT_ID` (T1); `resolveSignals` (T2); `layersStore.applyExact`/`signalsStore.applyExact` (T3); `diffFromVariant`/`isEmptyDelta` (T4); `decodeViewState` (T5); `cameraFilterStore.setLiveOnly`, `mapViewStore.flyToPoint`, `uiStore.setTheme`; `loadPersisted`/`savePersisted`.
- Produces: `variantStore` with `bootstrap()`, `setActive(id)`, `resetToVariant()`, `get()`, `subscribe()`; `useVariant(): { activeId: string; edited: boolean }`; `resolveVariant(id): Variant`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/variants-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { variantStore, resolveVariant } from "@/lib/variants/store";
import { layersStore } from "@/lib/layers";
import { signalsStore } from "@/lib/signals/store";

beforeEach(() => { localStorage.clear(); });

describe("variantStore", () => {
  it("bootstraps the default explore variant when no URL/persisted state", () => {
    variantStore.bootstrap(new URLSearchParams(""));
    expect(variantStore.get().activeId).toBe("explore");
    expect(layersStore.get().cameras).toBe(true);
    expect(layersStore.get().satellites).toBe(false);
  });
  it("URL v= picks the variant and seeds its signals", () => {
    variantStore.bootstrap(new URLSearchParams("v=cyber"));
    expect(variantStore.get().activeId).toBe("cyber");
    expect(signalsStore.isOn("cyber-c2")).toBe(true);
  });
  it("falls back to explore for an unknown variant id", () => {
    variantStore.bootstrap(new URLSearchParams("v=does-not-exist"));
    expect(variantStore.get().activeId).toBe("explore");
  });
  it("resolveVariant returns a builtin by id", () => {
    expect(resolveVariant("intel").title).toBe("Intel");
  });
});
```

> The store touches `document`/`localStorage`; vitest's default jsdom-like env or the existing `tests/unit/persist.test.ts` setup provides them. If a test file runs in the node env, add `// @vitest-environment jsdom` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/variants-store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

```ts
// lib/variants/store.ts
"use client";
import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { BUILTIN_BY_ID, BUILTIN_VARIANTS, DEFAULT_VARIANT_ID } from "@/lib/variants/builtins";
import type { OverrideDelta, PanelPlacement, Variant } from "@/lib/variants/types";
import { resolveSignals } from "@/lib/variants/resolveSignals";
import { diffFromVariant, isEmptyDelta } from "@/lib/variants/diff";
import { layersStore, DEFAULT_STATE, type LayerState } from "@/lib/layers";
import { signalsStore, type SignalState } from "@/lib/signals/store";
import { uiStore } from "@/lib/shell/ui";
import { cameraFilterStore } from "@/lib/cameraFilter";
import { mapViewStore } from "@/lib/mapView";
import { decodeViewState } from "@/lib/share/url";

interface VariantStoreState {
  activeId: string;
  userVariants: Variant[]; // populated by the SP1b editor; [] in SP1a
  overrides: Record<string, OverrideDelta>;
  layoutOverrides: Record<string, PanelPlacement[]>; // SP1b
}

const PERSIST_KEY = "tn.variant.v1";
const PERSIST_VERSION = 1;

let state: VariantStoreState = { activeId: DEFAULT_VARIANT_ID, userVariants: [], overrides: {}, layoutOverrides: {} };
let applying = false; // guard: suppress override-capture while seeding
const listeners = new Set<() => void>();

export function resolveVariant(id: string): Variant {
  const all = [...BUILTIN_VARIANTS, ...state.userVariants];
  return all.find((v) => v.id === id) ?? BUILTIN_BY_ID[DEFAULT_VARIANT_ID];
}

function applyVariant(v: Variant, override?: OverrideDelta, sigFromUrl?: string[]) {
  applying = true;
  try {
    const layers = { ...DEFAULT_STATE, ...v.layers, ...override?.layers } as LayerState;
    layersStore.applyExact(layers);

    let signals: SignalState = { ...resolveSignals(v.signals), ...override?.signals };
    if (sigFromUrl) { signals = {}; for (const id of sigFromUrl) signals[id] = true; }
    signalsStore.applyExact(signals);

    uiStore.setTheme(override?.theme ?? v.theme);
    cameraFilterStore.setLiveOnly(v.cameraFilter?.liveOnly ?? false);
    if (typeof document !== "undefined") document.documentElement.style.setProperty("--accent", v.accent);
    if (v.view) mapViewStore.flyToPoint({ lat: v.view.lat, lon: v.view.lon, zoom: v.view.zoom });
  } finally {
    applying = false;
  }
}

function persist() { savePersisted(PERSIST_KEY, PERSIST_VERSION, state); }
function emit() { for (const l of listeners) l(); }

function captureOverride() {
  if (applying) return;
  const v = resolveVariant(state.activeId);
  const delta = diffFromVariant(
    { layers: layersStore.get(), signals: signalsStore.get(), theme: uiStore.get().theme },
    v,
  );
  const next = { ...state.overrides };
  if (isEmptyDelta(delta)) delete next[state.activeId]; else next[state.activeId] = delta;
  state = { ...state, overrides: next };
  persist();
  emit();
}

export const variantStore = {
  /** The ONLY load-time hydration path. Call once from ConsoleShell. */
  bootstrap(params: URLSearchParams) {
    const saved = loadPersisted<VariantStoreState>(PERSIST_KEY, PERSIST_VERSION);
    if (saved) state = { ...state, ...saved };
    const url = decodeViewState(params);
    const id = (url.v && resolveVariant(url.v).id === url.v) ? url.v
      : (BUILTIN_BY_ID[state.activeId] || state.userVariants.find((v) => v.id === state.activeId)) ? state.activeId
      : DEFAULT_VARIANT_ID;
    state = { ...state, activeId: id };
    applyVariant(resolveVariant(id), state.overrides[id], url.sig);
    // Subscribe AFTER the initial seed so we don't capture the seed as an override.
    layersStore.subscribe(captureOverride);
    signalsStore.subscribe(captureOverride);
    uiStore.subscribe(captureOverride);
    persist();
    emit();
  },
  setActive(id: string) {
    const v = resolveVariant(id);
    state = { ...state, activeId: v.id };
    applyVariant(v, state.overrides[v.id]);
    persist();
    emit();
  },
  resetToVariant() {
    const next = { ...state.overrides };
    delete next[state.activeId];
    state = { ...state, overrides: next };
    applyVariant(resolveVariant(state.activeId));
    persist();
    emit();
  },
  get(): VariantStoreState { return state; },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useVariant(): { activeId: string; edited: boolean } {
  const snap = useSyncExternalStore(variantStore.subscribe, variantStore.get, variantStore.get);
  return { activeId: snap.activeId, edited: !!snap.overrides[snap.activeId] };
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/unit/variants-store.test.ts`
Expected: PASS (4 tests).

```bash
git add lib/variants/store.ts tests/unit/variants-store.test.ts
git commit -m "feat(variants): variantStore — single hydration authority + override capture"
```

---

### Task 7: Retire `railOpen`/`newsTicker`; `uiStore` → theme only

**Files:**
- Modify: `lib/shell/ui.ts`
- Modify: `components/shell/LayerRail.tsx` (line ~304 — replace `ui.railOpen`)
- Modify: `components/shell/NewsTicker.tsx` (lines ~19/37/39 — drop `ui.newsTicker` guard)
- Test: `tests/unit/ui-store.test.ts`

**Interfaces:**
- Produces: `UIState = { theme: Theme }`; `uiStore` keeps `setTheme`/`toggleTheme`/`get`/`subscribe`/`hydrate`. `railOpen`/`newsTicker` and their methods are removed (rail collapse becomes local component state; news visibility comes from the variant via `PanelHost`, Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ui-store.test.ts
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { uiStore } from "@/lib/shell/ui";

describe("uiStore (theme only)", () => {
  it("no longer exposes railOpen / newsTicker", () => {
    expect("railOpen" in uiStore.get()).toBe(false);
    expect("newsTicker" in uiStore.get()).toBe(false);
    expect((uiStore as Record<string, unknown>).toggleRail).toBeUndefined();
  });
  it("toggles theme", () => {
    uiStore.setTheme("light");
    uiStore.toggleTheme();
    expect(uiStore.get().theme).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ui-store.test.ts`
Expected: FAIL — `railOpen` is still present / `toggleRail` defined.

- [ ] **Step 3: Slim `lib/shell/ui.ts`**

Replace the `UIState` interface, initial `state`, and remove the rail/news methods:

```ts
export interface UIState {
  theme: Theme;
}

const PERSIST_KEY = "tn.ui.v1";
const PERSIST_VERSION = 1;

let state: UIState = { theme: "light" };
```

Delete `setRailOpen`, `toggleRail`, `setNewsTicker`, `toggleNewsTicker` from `uiStore`. Keep `setTheme`, `toggleTheme`, `get`, `hydrate`, `subscribe` (and `applyTheme`). `hydrate` now only restores `theme`:

```ts
  hydrate() {
    const saved = loadPersisted<Partial<UIState>>(PERSIST_KEY, PERSIST_VERSION);
    if (saved?.theme) state = { ...state, theme: saved.theme };
    applyTheme(state.theme);
    emit();
  },
```

- [ ] **Step 4: Replace `ui.railOpen` in `LayerRail.tsx`**

Remove the `useUI()` import usage for rail open. Add local collapse state at the top of the component:

```tsx
const [railOpen, setRailOpen] = useState(true);
```

Replace `if (!ui.railOpen) {` (line ~304) with `if (!railOpen) {`, and replace whatever called `uiStore.toggleRail()` / `uiStore.setRailOpen(false)` with `setRailOpen((o) => !o)` / `setRailOpen(false)`. (Grep the file for `railOpen`/`toggleRail`/`setRailOpen` and swap each to the local state.)

- [ ] **Step 5: Drop the `newsTicker` guard in `NewsTicker.tsx`**

Remove the `ui.newsTicker` references (lines ~19, 37, 39). The render guard becomes:

```tsx
if (items.length === 0) return null;
```

NewsTicker visibility is now decided by `PanelHost` (Task 9), which only mounts it when the active variant includes the `news` panel.

- [ ] **Step 6: Run tests + build + commit**

Run: `npx vitest run tests/unit/ui-store.test.ts`
Expected: PASS (2 tests).
Run: `npm run build`
Expected: compiles (no references to removed `uiStore` members).

```bash
git add lib/shell/ui.ts components/shell/LayerRail.tsx components/shell/NewsTicker.tsx tests/unit/ui-store.test.ts
git commit -m "refactor(shell): uiStore is theme-only; rail collapse local; news visibility via variant"
```

---

### Task 8: Extract `DailyBrief` from `MarketsPanel`

**Files:**
- Modify: `components/shell/MarketsPanel.tsx` (remove import line 14 + usage line 111)
- Read first: `components/shell/DailyBrief.tsx` (confirm it renders standalone — it is `export default function DailyBrief()` with no dependency on `marketsStore`)
- Test: `tests/unit/markets-no-brief.test.tsx`

**Interfaces:**
- Produces: `DailyBrief` usable as an independent panel (registered in Task 9). `MarketsPanel` no longer renders it.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/markets-no-brief.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("DailyBrief extraction", () => {
  it("MarketsPanel no longer imports or renders DailyBrief", () => {
    const src = readFileSync("components/shell/MarketsPanel.tsx", "utf8");
    expect(src).not.toMatch(/DailyBrief/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/markets-no-brief.test.tsx`
Expected: FAIL — `DailyBrief` still referenced.

- [ ] **Step 3: Edit `MarketsPanel.tsx`**

Delete line 14 (`import DailyBrief from "@/components/shell/DailyBrief";`) and line 111 (`<DailyBrief />`).

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run tests/unit/markets-no-brief.test.tsx`
Expected: PASS.

```bash
git add components/shell/MarketsPanel.tsx tests/unit/markets-no-brief.test.tsx
git commit -m "refactor(shell): extract DailyBrief so 'brief' is an independent panel"
```

---

### Task 9: `PANEL_REGISTRY` + `PanelHost`

**Files:**
- Create: `lib/shell/panelRegistry.ts`
- Create: `components/shell/PanelHost.tsx`
- Test: `tests/unit/panel-registry.test.ts`

**Interfaces:**
- Consumes: `PanelKey` (T1); `useVariant`/`resolveVariant` (T6); the panel components.
- Produces: `PANEL_REGISTRY: Record<PanelKey, { component; title; category; defaultGrid }>`; `<PanelHost />` mounts the **persistent** panels (`layerRail`, `freshness`, `news`) the active variant marks visible. Slide-ins (`markets`, `brief`, `watchlist`, `coverage`) stay in `ConsoleShell` with their own open-stores (SP1a); their registry entries exist for SP1b.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/panel-registry.test.ts
import { describe, it, expect } from "vitest";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";

describe("PANEL_REGISTRY", () => {
  it("has an entry for every panel key", () => {
    for (const key of ["layerRail", "markets", "brief", "freshness", "news", "watchlist", "coverage"] as const) {
      expect(PANEL_REGISTRY[key]).toBeTruthy();
      expect(typeof PANEL_REGISTRY[key].title).toBe("string");
      expect(PANEL_REGISTRY[key].component).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/panel-registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

```ts
// lib/shell/panelRegistry.ts
import type { ComponentType } from "react";
import type { PanelKey } from "@/lib/variants/types";
import LayerRail from "@/components/shell/LayerRail";
import FreshnessTicker from "@/components/shell/FreshnessTicker";
import NewsTicker from "@/components/shell/NewsTicker";
import MarketsPanel from "@/components/shell/MarketsPanel";
import DailyBrief from "@/components/shell/DailyBrief";
import WatchlistPanel from "@/components/shell/WatchlistPanel";
import CoveragePanel from "@/components/shell/CoveragePanel";

export const PANEL_REGISTRY: Record<PanelKey, {
  component: ComponentType;
  title: string;
  category: "core" | "intelligence" | "markets";
  defaultGrid: { x: number; y: number; w: number; h: number };
}> = {
  layerRail:  { component: LayerRail,      title: "Layers",    category: "core",         defaultGrid: { x: 0, y: 0, w: 3, h: 8 } },
  freshness:  { component: FreshnessTicker, title: "Freshness", category: "core",         defaultGrid: { x: 0, y: 8, w: 12, h: 1 } },
  news:       { component: NewsTicker,      title: "News",      category: "intelligence", defaultGrid: { x: 0, y: 7, w: 12, h: 1 } },
  markets:    { component: MarketsPanel,    title: "Markets",   category: "markets",      defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
  brief:      { component: DailyBrief,      title: "Brief",     category: "intelligence", defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
  watchlist:  { component: WatchlistPanel,  title: "Watchlist", category: "core",         defaultGrid: { x: 9, y: 6, w: 3, h: 4 } },
  coverage:   { component: CoveragePanel,   title: "Coverage",  category: "core",         defaultGrid: { x: 9, y: 0, w: 3, h: 6 } },
};

/** Panels PanelHost mounts directly in SP1a (the persistent chrome). */
export const PERSISTENT_PANELS: PanelKey[] = ["layerRail", "freshness", "news"];
```

- [ ] **Step 4: Implement `PanelHost`**

```tsx
// components/shell/PanelHost.tsx
"use client";
import { useVariant, resolveVariant } from "@/lib/variants/store";
import { PANEL_REGISTRY, PERSISTENT_PANELS } from "@/lib/shell/panelRegistry";

export default function PanelHost() {
  const { activeId } = useVariant();
  const variant = resolveVariant(activeId);
  const visible = new Set(variant.panels.filter((p) => p.visible).map((p) => p.panel));
  return (
    <>
      {PERSISTENT_PANELS.filter((k) => visible.has(k)).map((k) => {
        const Cmp = PANEL_REGISTRY[k].component;
        return <Cmp key={k} />;
      })}
    </>
  );
}
```

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run tests/unit/panel-registry.test.ts`
Expected: PASS.

```bash
git add lib/shell/panelRegistry.ts components/shell/PanelHost.tsx tests/unit/panel-registry.test.ts
git commit -m "feat(shell): panel registry + PanelHost (variant-driven persistent chrome)"
```

---

### Task 10: `VariantSwitcher` header pill

**Files:**
- Create: `components/shell/VariantSwitcher.tsx`
- Modify: `app/globals.css` (append `.tn-variant-*` styles)
- Test: `tests/unit/variant-switcher.test.tsx`

**Interfaces:**
- Consumes: `BUILTIN_VARIANTS` (T1), `useVariant`/`variantStore` (T6).
- Produces: `<VariantSwitcher />` — a pill button showing the active variant title (+ a "· edited" marker when diverged) that opens a menu of all variants; selecting calls `variantStore.setActive(id)`; an "edited" state shows a "Reset" action calling `variantStore.resetToVariant()`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/variant-switcher.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VariantSwitcher from "@/components/shell/VariantSwitcher";
import { variantStore } from "@/lib/variants/store";

beforeEach(() => { localStorage.clear(); variantStore.bootstrap(new URLSearchParams("")); });

describe("VariantSwitcher", () => {
  it("shows the active variant and switches on select", () => {
    render(<VariantSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /variant/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Intel" }));
    expect(variantStore.get().activeId).toBe("intel");
  });
});
```

> Uses `@testing-library/react`. If absent, install as a dev dep: `npm i -D @testing-library/react @testing-library/dom` (both keyless, dev-only). Confirm with `npx vitest run` that other component tests already use it before adding.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/variant-switcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the switcher**

```tsx
// components/shell/VariantSwitcher.tsx
"use client";
import { useState } from "react";
import { BUILTIN_VARIANTS } from "@/lib/variants/builtins";
import { variantStore, useVariant, resolveVariant } from "@/lib/variants/store";

export default function VariantSwitcher() {
  const { activeId, edited } = useVariant();
  const [open, setOpen] = useState(false);
  const active = resolveVariant(activeId);
  return (
    <div className="tn-variant">
      <button type="button" className="tn-variant-pill" aria-haspopup="menu" aria-expanded={open}
        aria-label="Variant" onClick={() => setOpen((o) => !o)}>
        <span className="tn-variant-dot" style={{ background: active.accent }} aria-hidden />
        {active.title}{edited ? <span className="tn-variant-edited"> · edited</span> : null}
      </button>
      {open && (
        <ul className="tn-variant-menu" role="menu">
          {edited && (
            <li><button role="menuitem" className="tn-variant-reset"
              onClick={() => { variantStore.resetToVariant(); setOpen(false); }}>↺ Reset to {active.title}</button></li>
          )}
          {BUILTIN_VARIANTS.map((v) => (
            <li key={v.id}>
              <button role="menuitem" className={v.id === activeId ? "is-active" : ""}
                onClick={() => { variantStore.setActive(v.id); setOpen(false); }}>
                <span className="tn-variant-dot" style={{ background: v.accent }} aria-hidden /> {v.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append minimal styles to `app/globals.css`**

```css
/* Variant switcher (SP1a) */
.tn-variant { position: relative; }
.tn-variant-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-radius: 999px; border: 1px solid var(--tn-border, #e2e8f0); background: var(--tn-surface, #fff);
  font: inherit; cursor: pointer; }
.tn-variant-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tn-variant-edited { opacity: .6; }
.tn-variant-menu { position: absolute; top: 110%; left: 0; margin: 0; padding: 4px; list-style: none;
  background: var(--tn-surface, #fff); border: 1px solid var(--tn-border, #e2e8f0); border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,.12); min-width: 180px; z-index: 50; max-height: 60vh; overflow: auto; }
.tn-variant-menu button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px;
  border: 0; background: none; font: inherit; text-align: left; border-radius: 6px; cursor: pointer; }
.tn-variant-menu button:hover, .tn-variant-menu button.is-active { background: var(--tn-hover, #f1f5f9); }
```

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run tests/unit/variant-switcher.test.tsx`
Expected: PASS.

```bash
git add components/shell/VariantSwitcher.tsx app/globals.css tests/unit/variant-switcher.test.tsx
git commit -m "feat(shell): variant switcher pill with reset/edited affordance"
```

---

### Task 11: Wire `ConsoleShell` to the variant spine + URL glue

**Files:**
- Modify: `components/shell/ConsoleShell.tsx`
- Modify: `lib/share/deepLink.ts` (add a `replaceVariant(id)` helper — read the file first for its existing `history.replaceState` idiom)
- Test: manual + build (integration; the unit layers are covered by Tasks 1–10)

**Interfaces:**
- Consumes: `variantStore.bootstrap` (T6), `<PanelHost />` (T9), `<VariantSwitcher />` (T10).
- Produces: the shell hydrates via the variant authority, renders the selector + PanelHost, and writes `?v=` on switch.

- [ ] **Step 1: Replace the hydration block in `ConsoleShell.tsx`**

In the first `useEffect`, **remove** the individual `layersStore.hydrate()`, `signalsStore.hydrate()`, `uiStore.hydrate()` calls (the variant store is now the load authority — Spec §5/C2). Replace with:

```tsx
  useEffect(() => {
    uiStore.hydrate();              // theme only (applies data-theme)
    variantStore.bootstrap(new URLSearchParams(window.location.search));
    watchlistStore.hydrate();
    timeWindowStore.hydrate();
    alertStore.hydrate();
    langStore.hydrate();
    registerServiceWorker();
  }, []);
```

Add imports: `import { variantStore } from "@/lib/variants/store";`.

> Note: `uiStore.hydrate()` is kept ONLY to apply the persisted `data-theme` before paint; `variantStore` then re-asserts the variant's theme. Keep this order.

- [ ] **Step 2: Swap the hardcoded persistent panels for `PanelHost` + add the selector**

In the returned JSX: remove the direct `<LayerRail />`, `<NewsTicker />`, `<FreshnessTicker />` elements and render `<PanelHost />` instead. Keep the slide-ins (`<MarketsPanel />`, `<WatchlistPanel />`, `<CoveragePanel />`, `<FeedOverlay />`), `<BreakingBanner />`, `<PlaceSearch />`, `<StatusBar />`, `<CommandPalette />`. Mount the selector inside the top bar area:

```tsx
  return (
    <div className="tn-shell">
      {children}
      <StatusBar onOpenPalette={() => setPaletteOpen(true)} />
      <div className="tn-topbar-variant"><VariantSwitcher /></div>
      <BreakingBanner />
      <PlaceSearch />
      <PanelHost />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CoveragePanel />
      <MarketsPanel />
      <WatchlistPanel />
      <FeedOverlay />
    </div>
  );
```

Add imports for `PanelHost` and `VariantSwitcher`; remove now-unused `LayerRail`/`NewsTicker`/`FreshnessTicker` imports.

- [ ] **Step 3: Write `?v=` on switch**

In `lib/variants/store.ts` `setActive`, after `emit();`, add a guarded URL update:

```ts
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      p.set("v", v.id);
      window.history.replaceState(null, "", `?${p.toString()}`);
    }
```

- [ ] **Step 4: Build + manual verify**

Run: `npm run build`
Expected: compiles with no unused-import / missing-member errors.

Manual (`npm run dev`, separate terminal, NEVER during a build):
- First load shows globe + left layer rail only (explore). 
- The variant pill reads "Explore"; opening it and choosing "Hazards" turns on the hazard signals, hides the rail-only chrome per that variant, and the URL gains `?v=hazards`.
- Reload with `?v=hazards` → restores hazards. Toggle a layer off → pill shows "· edited"; "Reset" restores it.

- [ ] **Step 5: Full gate + commit**

Run: `npx vitest run`
Expected: all prior tests + the new SP1a tests pass (no regressions).
Run: `npm run build`
Expected: success.

```bash
git add components/shell/ConsoleShell.tsx lib/variants/store.ts lib/share/deepLink.ts
git commit -m "feat(shell): wire ConsoleShell to the variant spine + ?v= deep-link"
```

---

## Self-Review notes (for the executor)

- **Spec coverage:** §2 data model → T1; §2 resolveSignals → T2; §2 diffFromVariant → T4; §3 taxonomy (13 variants, all 14 groups, civic) → T1 (coverage test); §5 single hydration authority + precedence + fallback → T6; §5 URL → T5/T11; §6 registry/PanelHost/`brief` extraction/one-owner-state → T7/T8/T9; selector → T10. **Deferred to SP1b (out of this plan, per Spec §0.2):** react-grid-layout dockable grid, the 5-tab draft-commit editor, user-saved named variants, slide-in panels as docked cards, `view` reliability on first paint (currently best-effort `flyToPoint`).
- **Type consistency:** `applyExact`, `resolveSignals`, `diffFromVariant`/`isEmptyDelta`, `resolveVariant`, `useVariant`, `PANEL_REGISTRY`, `PERSISTENT_PANELS` are defined once (T3/T2/T4/T6/T9) and consumed by id thereafter.
- **Known soft spots to watch during execution:** (1) the `captureOverride` subscription must be registered only inside `bootstrap` after the first seed (done) so seeding isn't mis-captured; (2) confirm `DailyBrief.tsx` has no `marketsStore` dependency before T8; (3) verify `@testing-library/react` is already a dev dep before T10 (grep an existing `*.test.tsx`).
