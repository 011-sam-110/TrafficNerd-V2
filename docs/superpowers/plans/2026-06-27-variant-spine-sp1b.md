# SP1b — Dockable Workspace + Draft-Commit Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Executed in the isolated worktree `C:/Users/sampo/Desktop/tn-sp1b` (branch `feat/sp1b-workspace`, off `origin/main` @ 8f7c180, which contains the merged SP1a spine).

**Goal:** Make the SP1a `Variant.panels[].grid` geometry real — an opt-in dockable workspace where a variant's intelligence panels render as draggable/resizable `react-grid-layout` tiles, with a draft-then-commit editor that persists per-variant layout overrides.

**Architecture:** A new `workspaceStore` (mode + draft buffer) + pure layout mappers (`PanelPlacement[]` ↔ RGL `Layout[]`) + `variantStore` layout methods (resolve/commit/reset `layoutOverrides`). A `DockableWorkspace` client component renders the active variant's visible dockable panels in a `ResponsiveGridLayout` (RGL 2.x `useContainerWidth` + `mounted`-gate, the SSR-safe pattern from the spike). The four dockable panels gain a minimal `docked` prop (render inline content, skip the open-gate + close button). Calm SP1a shell stays the default; the dock is opt-in and suppresses the dockable slide-ins while open.

**Tech Stack:** Next.js 15.5.19 · React 19 · `react-grid-layout@2.2.3` · `useSyncExternalStore` framework-light stores · vitest (node env).

## Global Constraints

- **RGL 2.x API only** (per `docs/superpowers/research/2026-06-27-sp1b-rgl-spike.md`): `import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout"`. SSR-safe = gate the grid on `useContainerWidth().mounted`. Drag/resize via `dragConfig`/`resizeConfig` objects, NOT `isDraggable`/`isResizable`. CSS: `import "react-grid-layout/css/styles.css"` + `"react-resizable/css/styles.css"`. **Do NOT install `@types/react-grid-layout`** — 2.x ships its own types.
- **Controlled-grid rule:** always pass `onLayoutChange`, or the grid reverts after drop.
- **Tests are node-env, NO jsdom / @testing-library** — unit-test only pure logic + stores (DI'd/SSR-safe storage). Components (`DockableWorkspace`, `WorkspaceBar`, panel `docked` rendering) are verified by `npm run build` + a Playwright runtime smoke, never jsdom render tests.
- **Don't regress SP1a:** the calm shell is the default; workspace mode is off on load (not persisted-on). `layoutOverrides` already exists in the persisted `variantStore` state (PERSIST_VERSION stays 1 — additive).
- **Verification gate each task:** `npx tsc --noEmit` (ignore `.claude/worktrees` orphans) + `npx vitest run`; the authoritative `npm run build` runs with no `next dev` active. Commit **SOLO-attributed, NO Claude trailer**.
- **Baseline:** vitest **366** passing on `origin/main`.

## File Structure

- `lib/variants/layout.ts` (new) — pure mappers `placementsToRglItems` / `rglItemsToPlacements` + `RglItem` type. One responsibility: PanelPlacement ↔ RGL geometry. Node-testable.
- `lib/variants/store.ts` (modify) — add `layoutForVariant` / `commitLayout` / `resetLayout` / `useLayout`. Reuses existing `layoutOverrides` state + `persist()`.
- `lib/shell/workspace.ts` (new) — `workspaceStore` external store: `{ open, editing, draft }` + the draft state machine. Node-testable.
- `components/shell/PanelTile.tsx` (new) — presentational tile chrome (drag-handle header + body) wrapping a registry panel.
- `components/shell/DockableWorkspace.tsx` (new) — the RGL dock (client; build/Playwright-verified).
- `components/shell/WorkspaceBar.tsx` (new) — the toolbar (open/close · edit/save/cancel · reset).
- `components/shell/{MarketsPanel,WatchlistPanel,CoveragePanel,DailyBrief}.tsx` (modify) — add `docked?: boolean`.
- `components/shell/ConsoleShell.tsx` (modify) — render `DockableWorkspace` + `WorkspaceBar`; suppress dockable slide-ins + `PanelHost` dock-overlap while workspace open.
- `components/shell/CommandPalette.tsx` (modify) — add "Toggle workspace dock" command.
- `app/globals.css` (modify) — `.tn-workspace*`, `.tn-tile*`, `.tn-docked` tokens + RGL css imports location.
- Tests: `tests/unit/variants-layout.test.ts`, `variants-store-layout.test.ts`, `workspace-store.test.ts`.

---

### Task 1: Pure layout mappers — `lib/variants/layout.ts`

**Files:** Create `lib/variants/layout.ts`; Test `tests/unit/variants-layout.test.ts`.

**Interfaces:**
- Produces: `type RglItem = { i: PanelKey; x: number; y: number; w: number; h: number; minW?: number; minH?: number }`; `placementsToRglItems(placements: PanelPlacement[]): RglItem[]` (visible only); `rglItemsToPlacements(items: RglItem[], prev: PanelPlacement[]): PanelPlacement[]` (updates grid x/y/w/h on matching `panel===i`, preserves `visible` + any panel absent from `items`).

- [ ] **Step 1: Failing test** (`tests/unit/variants-layout.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { placementsToRglItems, rglItemsToPlacements } from "@/lib/variants/layout";
import type { PanelPlacement } from "@/lib/variants/types";

const P: PanelPlacement[] = [
  { panel: "markets", grid: { x: 9, y: 0, w: 3, h: 6, minW: 2, minH: 3 }, visible: true },
  { panel: "brief",   grid: { x: 0, y: 0, w: 3, h: 6 }, visible: false },
];

describe("layout mappers", () => {
  it("maps visible placements to RGL items, carrying minW/minH", () => {
    const items = placementsToRglItems(P);
    expect(items).toEqual([{ i: "markets", x: 9, y: 0, w: 3, h: 6, minW: 2, minH: 3 }]);
  });
  it("round-trips grid changes back into placements, preserving visible + hidden panels", () => {
    const next = rglItemsToPlacements([{ i: "markets", x: 0, y: 2, w: 4, h: 5 }], P);
    expect(next.find((p) => p.panel === "markets")!.grid).toMatchObject({ x: 0, y: 2, w: 4, h: 5 });
    expect(next.find((p) => p.panel === "markets")!.visible).toBe(true);
    expect(next.find((p) => p.panel === "brief")).toEqual(P[1]); // untouched
  });
});
```
- [ ] **Step 2:** `npx vitest run tests/unit/variants-layout.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `lib/variants/layout.ts`:
```ts
import type { PanelKey, PanelPlacement } from "@/lib/variants/types";

export type RglItem = { i: PanelKey; x: number; y: number; w: number; h: number; minW?: number; minH?: number };

export function placementsToRglItems(placements: PanelPlacement[]): RglItem[] {
  return placements
    .filter((p) => p.visible)
    .map((p) => {
      const it: RglItem = { i: p.panel, x: p.grid.x, y: p.grid.y, w: p.grid.w, h: p.grid.h };
      if (p.grid.minW != null) it.minW = p.grid.minW;
      if (p.grid.minH != null) it.minH = p.grid.minH;
      return it;
    });
}

export function rglItemsToPlacements(items: RglItem[], prev: PanelPlacement[]): PanelPlacement[] {
  const byId = new Map(items.map((it) => [it.i, it]));
  return prev.map((p) => {
    const it = byId.get(p.panel);
    if (!it) return p;
    return { ...p, grid: { ...p.grid, x: it.x, y: it.y, w: it.w, h: it.h } };
  });
}
```
- [ ] **Step 4:** vitest → PASS. **Step 5:** commit `feat(variants): pure PanelPlacement ↔ react-grid-layout mappers`.

---

### Task 2: variantStore layout methods

**Files:** Modify `lib/variants/store.ts`; Test `tests/unit/variants-store-layout.test.ts`.

**Interfaces:**
- Consumes: existing `state.layoutOverrides: Record<string, PanelPlacement[]>`, `resolveVariant(id)`, `persist()`, `emit()`.
- Produces on `variantStore`: `layoutForVariant(id: string): PanelPlacement[]` = `state.layoutOverrides[id] ?? resolveVariant(id).panels`; `commitLayout(id: string, placements: PanelPlacement[]): void`; `resetLayout(id: string): void`. Plus `useLayout(id: string): PanelPlacement[]`.

- [ ] **Step 1: Failing test** (`tests/unit/variants-store-layout.test.ts`):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { variantStore } from "@/lib/variants/store";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";

describe("variantStore layout overrides", () => {
  beforeEach(() => { variantStore.resetLayout("markets"); });
  it("falls back to the variant's own panels when no override", () => {
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });
  it("commitLayout stores + layoutForVariant returns it; resetLayout clears", () => {
    const custom = BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 1 } }));
    variantStore.commitLayout("markets", custom);
    expect(variantStore.layoutForVariant("markets")).toEqual(custom);
    variantStore.resetLayout("markets");
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });
});
```
- [ ] **Step 2:** vitest → FAIL.
- [ ] **Step 3: Implement** — add to the `variantStore` object in `lib/variants/store.ts` (and export `useLayout` + import `useSyncExternalStore` already present):
```ts
  layoutForVariant(id: string): PanelPlacement[] {
    return state.layoutOverrides[id] ?? resolveVariant(id).panels;
  },
  commitLayout(id: string, placements: PanelPlacement[]) {
    state = { ...state, layoutOverrides: { ...state.layoutOverrides, [id]: placements } };
    persist();
    emit();
  },
  resetLayout(id: string) {
    if (!state.layoutOverrides[id]) return;
    const next = { ...state.layoutOverrides };
    delete next[id];
    state = { ...state, layoutOverrides: next };
    persist();
    emit();
  },
```
and below `useVariant`:
```ts
export function useLayout(id: string): PanelPlacement[] {
  const snap = useSyncExternalStore(variantStore.subscribe, variantStore.get, variantStore.get);
  return snap.layoutOverrides[id] ?? resolveVariant(id).panels;
}
```
- [ ] **Step 4:** vitest → PASS. **Step 5:** commit `feat(variants): layoutForVariant/commitLayout/resetLayout + useLayout`.

---

### Task 3: workspaceStore (mode + draft state machine)

**Files:** Create `lib/shell/workspace.ts`; Test `tests/unit/workspace-store.test.ts`.

**Interfaces:**
- Consumes: `variantStore.commitLayout`, `variantStore.layoutForVariant`.
- Produces `workspaceStore`: state `{ open: boolean; editing: boolean; draft: PanelPlacement[] | null }`; `openWorkspace()` / `closeWorkspace()` (also cancels edit) / `beginEdit(activeId)` (draft = snapshot of `layoutForVariant`) / `updateDraft(placements)` / `saveEdit(activeId)` (commit draft → variantStore, exit edit) / `cancelEdit()`. `useWorkspace()` hook → the state. NOT persisted (always starts closed). Mirrors the `lib/shell/ui.ts` external-store shape.

- [ ] **Step 1: Failing test** (`tests/unit/workspace-store.test.ts`):
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { workspaceStore } from "@/lib/shell/workspace";
import { variantStore } from "@/lib/variants/store";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";

describe("workspaceStore", () => {
  beforeEach(() => { workspaceStore.closeWorkspace(); variantStore.resetLayout("markets"); });
  it("open/close + edit lifecycle", () => {
    workspaceStore.openWorkspace();
    expect(workspaceStore.get().open).toBe(true);
    workspaceStore.beginEdit("markets");
    expect(workspaceStore.get().editing).toBe(true);
    expect(workspaceStore.get().draft).toEqual(BUILTIN_BY_ID["markets"].panels);
  });
  it("saveEdit commits the draft to variantStore", () => {
    workspaceStore.openWorkspace();
    workspaceStore.beginEdit("markets");
    const moved = BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 2 } }));
    workspaceStore.updateDraft(moved);
    workspaceStore.saveEdit("markets");
    expect(workspaceStore.get().editing).toBe(false);
    expect(workspaceStore.get().draft).toBeNull();
    expect(variantStore.layoutForVariant("markets")).toEqual(moved);
  });
  it("cancelEdit discards the draft (no commit)", () => {
    workspaceStore.openWorkspace();
    workspaceStore.beginEdit("markets");
    workspaceStore.updateDraft(BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 9 } })));
    workspaceStore.cancelEdit();
    expect(workspaceStore.get().draft).toBeNull();
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });
});
```
- [ ] **Step 2:** vitest → FAIL.
- [ ] **Step 3: Implement** `lib/shell/workspace.ts` (pattern of `lib/shell/ui.ts`):
```ts
"use client";
import { useSyncExternalStore } from "react";
import type { PanelPlacement } from "@/lib/variants/types";
import { variantStore } from "@/lib/variants/store";

interface WorkspaceState { open: boolean; editing: boolean; draft: PanelPlacement[] | null; }
let state: WorkspaceState = { open: false, editing: false, draft: null };
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const workspaceStore = {
  openWorkspace() { if (state.open) return; state = { ...state, open: true }; emit(); },
  closeWorkspace() { state = { open: false, editing: false, draft: null }; emit(); },
  beginEdit(activeId: string) { state = { ...state, editing: true, draft: variantStore.layoutForVariant(activeId) }; emit(); },
  updateDraft(placements: PanelPlacement[]) { if (!state.editing) return; state = { ...state, draft: placements }; emit(); },
  saveEdit(activeId: string) {
    if (state.draft) variantStore.commitLayout(activeId, state.draft);
    state = { ...state, editing: false, draft: null }; emit();
  },
  cancelEdit() { state = { ...state, editing: false, draft: null }; emit(); },
  get(): WorkspaceState { return state; },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.get, workspaceStore.get);
}
```
- [ ] **Step 4:** vitest → PASS. **Step 5:** commit `feat(shell): workspaceStore — dock mode + draft-commit state machine`.

---

### Task 4: Dockable panels (`docked` prop) + `PanelTile`

**Files:** Modify `components/shell/{MarketsPanel,WatchlistPanel,CoveragePanel,DailyBrief}.tsx`; Create `components/shell/PanelTile.tsx`. Verify: `npx tsc --noEmit` + `npm run build` (no jsdom test).

**Pattern per open-gated panel** (Markets/Watchlist/Coverage): accept `{ docked = false }`, compute `const active = open || docked`, change every `if (!open) return`/effect-guard to use `active`, change `if (!open) return null` to `if (!active) return null`, render the existing root with an extra class when docked + drop the close button + `role="region"` when docked:
```tsx
export default function MarketsPanel({ docked = false }: { docked?: boolean } = {}) {
  const open = useMarketsOpen();
  const active = open || docked;
  // ...effects: replace `if (!open) return;` → `if (!active) return;`, deps [open] → [active]
  if (!active) return null;
  return (
    <aside className={`tn-markets${docked ? " tn-docked" : ""}`} role={docked ? "region" : "dialog"} aria-label="Crypto markets">
      <header className="tn-markets-head">
        <div>{/* title/sub unchanged */}</div>
        {!docked && (<button type="button" className="tn-markets-close" onClick={() => marketsStore.close()} aria-label="Close markets">×</button>)}
      </header>
      {/* body unchanged */}
    </aside>
  );
}
```
`DailyBrief` has no open-gate — add `{ docked = false }` only to tag the root: `<div className={\`tn-brief${docked ? " tn-docked" : ""}\`}>`.

`PanelTile.tsx`:
```tsx
"use client";
import type { ReactNode } from "react";
export default function PanelTile({ title, editing, children }: { title: string; editing: boolean; children: ReactNode }) {
  return (
    <div className="tn-tile">
      <div className={`tn-tile-head${editing ? " tn-tile-drag" : ""}`}>
        <span className="tn-tile-title">{title}</span>
      </div>
      <div className="tn-tile-body">{children}</div>
    </div>
  );
}
```
(The `tn-tile-drag` head is RGL's drag handle — wired via `dragConfig.handle: ".tn-tile-drag"` in Task 5, so tiles only drag by their header in edit mode.)

- [ ] tsc clean + build green; commit `feat(shell): docked rendering mode for intelligence panels + PanelTile`.

---

### Task 5: `DockableWorkspace` (RGL 2.x dock)

**Files:** Create `components/shell/DockableWorkspace.tsx`; modify `app/globals.css` (tile/workspace tokens + RGL css imports). Verify: build + Playwright smoke (Task 7).

**Interfaces:** Consumes `useVariant`, `useLayout`/`variantStore.layoutForVariant`, `useWorkspace`, `workspaceStore`, `placementsToRglItems`, `rglItemsToPlacements`, `PANEL_REGISTRY`, `PanelTile`. Renders nothing when `!open`. Dockable set = panels whose `PANEL_REGISTRY[key].category !== "core"` OR explicitly the intelligence/markets set — use: `const DOCKABLE: PanelKey[] = ["markets","brief","watchlist","coverage","news"]`.

```tsx
"use client";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useVariant } from "@/lib/variants/store";
import { useWorkspace, workspaceStore } from "@/lib/shell/workspace";
import { variantStore } from "@/lib/variants/store";
import { placementsToRglItems, rglItemsToPlacements, type RglItem } from "@/lib/variants/layout";
import { PANEL_REGISTRY } from "@/lib/shell/panelRegistry";
import PanelTile from "@/components/shell/PanelTile";
import type { PanelKey, PanelPlacement } from "@/lib/variants/types";

const DOCKABLE = new Set<PanelKey>(["markets", "brief", "watchlist", "coverage", "news"]);

export default function DockableWorkspace() {
  const { activeId } = useVariant();
  const ws = useWorkspace();
  const { width, containerRef, mounted } = useContainerWidth();
  if (!ws.open) return null;

  const placements: PanelPlacement[] = (ws.editing && ws.draft ? ws.draft : variantStore.layoutForVariant(activeId))
    .filter((p) => p.visible && DOCKABLE.has(p.panel));
  const items: RglItem[] = placementsToRglItems(placements);

  return (
    <div className="tn-workspace" ref={containerRef}>
      {mounted && items.length > 0 && (
        <ResponsiveGridLayout
          width={width}
          layouts={{ lg: items }}
          breakpoints={{ lg: 0 }}
          cols={{ lg: 12 }}
          rowHeight={44}
          margin={[10, 10]}
          dragConfig={{ enabled: ws.editing, handle: ".tn-tile-drag" }}
          resizeConfig={{ enabled: ws.editing }}
          onLayoutChange={(layout) => {
            if (!ws.editing) return;
            workspaceStore.updateDraft(rglItemsToPlacements(layout as RglItem[], ws.draft ?? placements));
          }}
        >
          {placements.map((p) => {
            const Cmp = PANEL_REGISTRY[p.panel].component as React.ComponentType<{ docked?: boolean }>;
            return (
              <div key={p.panel}>
                <PanelTile title={PANEL_REGISTRY[p.panel].title} editing={ws.editing}>
                  <Cmp docked />
                </PanelTile>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
```
CSS (`app/globals.css`): `.tn-workspace` = a right-docked surface (`position:fixed; right:0; top:48px; bottom:0; width:min(460px,42vw); overflow:auto; z-index:30; pointer-events:auto`); `.tn-tile` = bordered card using existing `--tn-*` tokens; `.tn-tile-drag { cursor: move; }`; `.tn-docked` = `position:static; width:auto; height:100%; max-height:none; box-shadow:none;` overriding the slide-in tokens.

- [ ] tsc clean + build green; commit `feat(shell): DockableWorkspace — react-grid-layout dock for variant panels`.

---

### Task 6: `WorkspaceBar` + ConsoleShell wiring + palette

**Files:** Create `components/shell/WorkspaceBar.tsx`; modify `components/shell/ConsoleShell.tsx`, `components/shell/CommandPalette.tsx`, `app/globals.css`.

`WorkspaceBar.tsx` — a small toolbar under the variant switcher:
```tsx
"use client";
import { useVariant } from "@/lib/variants/store";
import { useWorkspace, workspaceStore } from "@/lib/shell/workspace";
import { variantStore } from "@/lib/variants/store";
export default function WorkspaceBar() {
  const { activeId } = useVariant();
  const ws = useWorkspace();
  if (!ws.open) return (
    <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.openWorkspace()}>⊞ Workspace</button>
  );
  return (
    <div className="tn-ws-bar">
      {ws.editing ? (
        <>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.saveEdit(activeId)}>Save</button>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.cancelEdit()}>Cancel</button>
        </>
      ) : (
        <>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.beginEdit(activeId)}>Edit layout</button>
          <button type="button" className="tn-ws-btn" onClick={() => variantStore.resetLayout(activeId)}>Reset</button>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.closeWorkspace()}>✕</button>
        </>
      )}
    </div>
  );
}
```
ConsoleShell: import `DockableWorkspace`, `WorkspaceBar`, `useWorkspace`. Render `<WorkspaceBar/>` (next to VariantSwitcher) and `<DockableWorkspace/>`. Suppress the dockable slide-ins while the dock is open so panels don't double-render:
```tsx
const ws = useWorkspace();
// ...
{!ws.open && <MarketsPanel />}
{!ws.open && <WatchlistPanel />}
{!ws.open && <CoveragePanel />}
<DockableWorkspace />
```
(`PanelHost`/`CoveragePanel` etc. stay otherwise; layerRail/tickers are non-dockable chrome and keep rendering.) CommandPalette: add a command `{ id: "toggle-workspace", label: "Toggle workspace dock", run: () => workspaceStore.get().open ? workspaceStore.closeWorkspace() : workspaceStore.openWorkspace() }` following the file's existing command shape.

- [ ] tsc clean + build green; commit `feat(shell): WorkspaceBar + ConsoleShell/palette wiring for the dock`.

---

### Task 7: Runtime smoke + persistence verification

**Files:** none (verification). Confirms the draft-commit + persistence end-to-end and that RGL renders under React 19 in the real app.

- [ ] **Build** `npm run build` green; start `next start -p 3940`.
- [ ] **Playwright:** load `/`, run `workspaceStore.openWorkspace()` via the ⌘K command (or evaluate), assert `.tn-workspace .react-grid-layout` present with the variant's dockable tiles; enter edit, assert `.react-resizable-handle` appears; `localStorage["tn.variant.v1"]` after a `commitLayout` contains `layoutOverrides`. Console must be **0 errors / 0 hydration warnings**.
- [ ] **Full gate:** `npx tsc --noEmit` (0, ignoring worktrees) + `npx vitest run` (≥ 369: 366 baseline + 3 new files) + `npm run build` green.
- [ ] Update `.superpowers/sdd/progress.md` + commit `test(sp1b): runtime smoke + final gate`.

---

## Self-Review

- **Spec coverage:** dockable workspace (Tasks 5–6) ✓, draft-then-commit editor (Task 3 store + Task 6 bar) ✓, per-variant persistence (Task 2 `layoutOverrides`) ✓, RGL 2.x SSR-safe (Task 5 `useContainerWidth`+`mounted`) ✓, calm-default/opt-in (Task 6 `!ws.open` gating) ✓.
- **Deferred (YAGNI, documented):** add/remove panels in edit mode (panel picker), per-breakpoint responsive layouts, docking layerRail/tickers, `userVariants` editor — all out of SP1b.
- **Type consistency:** `RglItem` (Task 1) used in Tasks 3/5; `layoutForVariant`/`commitLayout`/`resetLayout` (Task 2) used in Tasks 3/6; `workspaceStore`/`useWorkspace` (Task 3) used in Tasks 5/6; `docked?: boolean` prop (Task 4) consumed in Task 5. Consistent.
