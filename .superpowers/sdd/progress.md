# Widget Console Redesign — Progress Ledger

Plan: docs/superpowers/plans/2026-06-28-widget-console-redesign.md
Spec: docs/superpowers/specs/2026-06-28-widget-console-redesign-design.md
Branch: feat/widget-console-redesign (spec 10238b3 · plan 425e9a8)
Execution: subagent-driven-development. BASE for Task 1 = 425e9a8.
(Prior ground-truth-console-phase1 ledger is COMPLETE; superseded by this file. See git history for it.)

## Status
- [x] Task 1: layout types + defaults (lib/console/types.ts)
- [x] Task 2: pure layout reducers
- [x] Task 3: shellLayoutStore
- [x] Task 4: widget registry
- [x] Task 5: alert model
- [x] Task 6: WidgetFrame component
- [x] Task 8: StageHost + StageSwitch + WorldClock  (ran before 7)
- [x] Task 7: Segment + ConsoleWorkspace  ← Phase C (shell) DONE
- [x] Task 9: Aviation widget + rules  ← Phase D start
- [x] Task 10: Disasters & Events widget + rules  (alerts fire on real data)
- [x] Task 11: Cameras widget + rules  (+made loadedCamerasStore reactive)
- [x] Task 12: Live Video News + provider catalogue  ← Phase D done
- [x] Task 13: widget index + ⌘K catalog upgrade  ← Phase E start
- [x] Task 14: presets + URL share
- [x] Task 15: mount console + reconcile chrome + e2e  ← SLICE COMPLETE

## Completed
Task 1: complete (commit 6b5f398, review clean — spec ✅, quality Approved)
Task 2: complete (commits 8220237..d550c65, review ✅ Approved after 1 fix: removeWidget dense reindex + upper-clamp tests)
Task 3: complete (commit 8798caf, review ✅ Approved; Important "nextSeq missing" ADJUDICATED → vestigial spec entry, 0 consumers, dropped from plan, no code change)
Task 4: complete (commits eaa2ac7..50f7c5e, review ✅ Approved + 1 test top-up: listWidgetTypes order + getWidgetType miss)
Task 5: complete (commit 4117b28, review ✅ Approved, Minors only)
Task 6: complete (commit 8c5de0c, review ✅ Approved all 12 constraints, Minors only; first UI component, e2e-gated at T15)
NOTE: executing order swapped to 8→7 (Task 7 ConsoleWorkspace imports Task 8 StageHost; Task 8 is standalone, keeps each tsc-clean).
Task 8: complete (commit 8f703dc, review ✅ Approved all 14 constraints, Minors only)
Task 7: complete (commit 0227af4, review ✅ Approved; drop-index/listener-teardown/resize-signs all correct, Minors only) — PHASE C done
Task 9: complete (commit f724d23, review ✅ Approved; rules exact+tested, body adapted to WorldObject shape; squawk/military alerts DORMANT — see Follow-ups)
Task 10: complete (commit 7ac6378, review ✅ Approved; nested r.severity.tier + r.magnitude.value mapped right, projectEventFeed matches EventFeed.tsx; S3+/M5+ alerts LIVE)
Task 11: complete (commits 6d166a4..69f8b1e, review ✅ Approved after 1 fix: loadedCamerasStore made reactive [subscribe], widget uses useSyncExternalStore + empty-state; offline alert LIVE)
Task 12: complete (commits 1362eb3..f542088, review ✅ Approved after 1 fix: YT id regex {6,}→{11} + playsinline test assertion; fix self-verified via the pinning test [4/4 green] + diff inspection, no scope creep) — PHASE D done
Task 13: complete (commit b37dd99, review ✅ Spec ✅ + quality Approved, 1 Minor; barrel registers 4 widgets + ⌘K "Add <widget>" catalog w/ open-counts + 3 stage cmds, matches brief verbatim; the LSP "unused import" diagnostics were STALE mid-edit snapshots — git diff confirms all 3 imports ARE used) — PHASE E start
Task 14: complete (commit 837a975, review ✅ Spec ✅ + quality Approved, 4 Minors all benign/deferred; presets.ts [built-ins World/Aviation-Ops/Disaster-Response + save-your-own + listPresets] + share.ts [URL-safe base64 encode/decode, null-on-garbage] TDD'd 4/4 green, palette wired WITHOUT the duplicate shellLayoutStore import; stale red-phase "cannot find module" + mid-edit "unused import" diagnostics DISPROVEN by fresh filtered tsc [clean] + git diff)
Task 15: complete (commit e49faf3, gates ALL GREEN — tsc clean, vitest 489 pass, `npm run build` SUCCESS [eslint clean → all removed imports verified gone], e2e 4/4 pass [Chromium ran]; ConsoleShell REWRITTEN — mounts ConsoleWorkspace + console hydrate/?c=/world-seed + inline onClose + tn-toast listener & pill, no props; page.tsx→<main><ConsoleShell/></main> [WorldMap gone, now in StageHost]; StageSwitch added to StatusBar; .tn-toast CSS; e2e spec; 1st dispatch was a 0-tool no-op, re-nudged → succeeded; self-verified final ConsoleShell + 5-file stat) — SLICE COMPLETE, next = final whole-branch review (opus)

## Follow-ups (post-slice — SURFACE TO USER)
- [DONE in Task 15, commit e49faf3] TOAST LISTENER: ConsoleShell now hosts a global tn-toast listener +
  calm pill (3.2s auto-dismiss), so the 50-widget-cap feedback surfaces. Wiring point (alertCapacity in the
  palette) + UI both live.
- AVIATION ALERTS DORMANT: usePlanes()→WorldObject has no squawk/military fields, so the flagship "squawk 7700"
  alert never fires on live data. Rules are correct+tested. To activate: extend parseAdsb() to surface squawk
  onto WorldObject + add a military category to classifyPlane(). (Events + Cameras alerts DO fire on real data.)

## Minor findings rollup (for final review)
- T1-m1: newInstanceId exported but untested (lib/console/types.ts) — add later if reducers don't cover it.
- T1-m2: console-reducers.test.ts asserts left/bottom but not segments.right value explicitly.
- T2-m1: removeWidget segSorted .sort() is on a fresh filtered array (safe); a comment would make purity self-evident.
- T2-m2: setWidgetCollapsed/setWidgetConfig/setSegmentCollapsed untested; moveWidget dest-segment order not asserted.
- T3-m1: store.hydrate() emits even when nothing was loaded (spurious save+notify on first boot); guard `if(s){state=s;emit()}`.
- T3-m2: store.set() and replace() are identical (both spec-listed; acceptable).
- T5-m1: alertCount() exported but untested + likely unused (WidgetFrame uses alerts.length directly) — consider dropping later.
- T5-m2: topSeverity tested only for info+critical; warn-only path uncovered.
- T6-m1: WidgetFrame unmount-mid-drag pointer-listener leak (negligible; inherited from brief).
- T6-m2: tn-cw-* CSS hardcodes hex instead of --tn-* tokens (theming drift risk; affects later widget CSS too).
- T8-m1: WorldClock ticks every 1s but only shows HH:MM (60x excess re-renders); use 60s or show seconds.
- T8-m2: .tn-clock-cell class used in WorldClock JSX but unstyled (cells lay out ok but not column-centered); add flex-col rule.
- T7-m1: globals.css Task 7 block sits after Task 8 block (cosmetic ordering).
- T7-m2: VGrip subscribes to full store redundantly (ConsoleWorkspace already does); harmless re-render churn.
- T7-m3: Segment stays mounted+subscribed when its column is collapsed (width:0); harmless at current scale.
- T9-m1: aviation.tsx effect dep `planes.length` redundant (lite already memoized on planes); remove.
- T9-m2: aviation flights table has no <thead> (columns unlabeled) — UX polish.
- T9-note: reviewer worried report() ref stability → CONFIRMED stable (Task 6 onReport is useCallback []), no loop. (Applies to all widget bodies.)
- T10-m1: console-events.test.ts asserts S3→warn but only implicitly S4→critical; add explicit `expect(...severity).toBe("critical")`.
- T10-m2: events.tsx freshLabel hardcoded "5m" (could reflect the active time window).
- T10-note: config in widget effect deps is fine — instance.config ref is stable across unrelated store updates (reducers only clone on change).
- T11-m1: cameras.tsx effect reads cams.length but only lite in deps (covered by lite memo; switch to lite.length for exhaustive-deps lint cleanliness).
- T13-m1 (Task 15 WATCH-ITEM): CommandPalette open-counts come from useMemo(()=>buildCommands(onClose),[onClose]); counts only refresh when onClose identity changes. CURRENTLY CORRECT — ConsoleShell passes inline onClose={()=>setPaletteOpen(false)}, so it re-renders + recomputes on every open. LATENT: if Task 15 wraps onClose in useCallback the counts freeze → then add `open` to the palette useMemo deps (or subscribe the palette to shellLayoutStore). [Task 14's listPresets-staleness Minor is the SAME root cause — fixing this covers both.]
- T14-m1: share.ts uses deprecated escape/unescape (browser path only; node test path uses Buffer). Works; decode is try/catch-safe. Modernize via TextEncoder/TextDecoder if the file is touched.
- T14-m2: decodeLayout calls atob on padding-stripped base64 without re-padding. BENIGN — our encode never yields len%4==1, atob is forgiving of missing padding, and try/catch returns null on any failure. Node path uses lenient Buffer.
- T14-m3: presets.ts module-level `seed` counter is shared across all build() calls (monotonic widget ids). Benign — ids are internal-only, no test asserts on them.
- T15-m1 (FINAL-REVIEW CLEANUP): palette commands coverage / markets / toggle-workspace are now dead no-ops — their panels/dock were removed from ConsoleShell, but CommandPalette was intentionally left untouched. Prune those commands + their now-unused store imports (coverageStore/marketsStore/workspaceStore) in the final fix wave.
- T15-m2: StatusBar still renders VariantSwitcher + WorkspaceBar, now partly orphaned (variant-driven PanelHost + DockableWorkspace were removed). Harmless; consider removing in cleanup.
- T15-note: implementer left a stray `next start` on :3000 — kill it before any local `npm run dev`.
