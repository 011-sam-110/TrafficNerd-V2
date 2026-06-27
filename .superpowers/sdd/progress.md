# SP1b · Dockable Workspace — Progress Ledger

Plan: docs/superpowers/plans/2026-06-27-variant-spine-sp1b.md
Branch: feat/sp1b-workspace (worktree, off origin/main @ 8f7c180 = merged SP1a)
Execution: inline (executing-plans). Baseline: vitest 366 on origin/main.

## Tasks
- [x] Task 1: pure layout mappers (lib/variants/layout.ts) — 2/2 green
- [x] Task 2: variantStore layout methods (layoutForVariant/commitLayout/resetLayout/useLayout) — 2/2 green
- [x] Task 3: workspaceStore (draft-commit state machine) — 4/4 green
- [x] Task 4: dockable panels (`docked` prop) + PanelTile — tsc 0, backward-compatible
- [x] Task 5: DockableWorkspace (RGL 2.x dock, useContainerWidth+mounted) — tsc 0
- [x] Task 6: WorkspaceBar + ConsoleShell/palette wiring (suppress dockable slide-ins while open) — build green
- [x] Task 7: runtime smoke + final gate

## Final gate (all green)
- tsc --noEmit: 0 errors (excl. .claude/worktrees orphans)
- vitest: 374 passing (366 baseline + 8 new: layout 2 / store-layout 2 / workspace 4)
- npm run build: SUCCESS (/ route 74.8 kB)
- Playwright smoke on `next start`: dock opens with markets variant tiles (Markets+Brief),
  Edit shows 2 resize handles + 2 draggable items, Save persists layoutOverrides.markets
  (3 placements) to localStorage tn.variant.v1 {v:1,d:{...}}, console 0 errors / 0 warnings.

## Deferred (YAGNI, documented in plan)
add/remove panels in edit mode, per-breakpoint responsive layouts, docking
layerRail/tickers, userVariants editor.
