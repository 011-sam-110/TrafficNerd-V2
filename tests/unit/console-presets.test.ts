import { expect, test } from "vitest";
import { BUILTIN_PRESETS, DEFAULT_PRESET_ID } from "@/lib/console/presets";
import { SIGNALS, signalsByGroup } from "@/lib/signals/registry";

const CORE_WIDGETS = new Set(["events", "news", "cameras", "aviation", "satellites", "markets", "headlines", "locate"]);
const SIGNAL_WIDGETS = new Set(SIGNALS.map((s) => `signal:${s.id}`));

// Deliberately FEW: five broad boards, one per navbar-pill slot. Ids are stable (used by
// the first-run seed, the ⌘K Profiles section, the central preset pill, and shared URLs).
const BOARD_IDS = ["overview", "situation", "earth", "mobility", "markets"];

// The seven core monitoring cards the union of boards must all surface (the "use all our
// widgets" intent). `locate` is a utility card, not a monitoring board card, so it's exempt.
const CORE_MONITORS = ["events", "news", "cameras", "aviation", "satellites", "markets", "headlines"];

test("the board lineup is exactly the five broad boards, each non-empty and within the cap", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  expect(ids).toEqual(BOARD_IDS);
  for (const p of BUILTIN_PRESETS) {
    const l = p.build();
    expect(l.widgets.length).toBeGreaterThan(0);
    expect(l.widgets.length).toBeLessThanOrEqual(50);
  }
});

test("the default landing preset exists and seeds a real board", () => {
  const def = BUILTIN_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID);
  expect(def, `DEFAULT_PRESET_ID "${DEFAULT_PRESET_ID}" must be a built-in`).toBeDefined();
  expect(def!.build().widgets.length).toBeGreaterThan(0);
});

test("every preset carries a persona blurb (who it's for)", () => {
  for (const p of BUILTIN_PRESETS) {
    expect(p.blurb.length, `preset "${p.id}" needs a blurb`).toBeGreaterThan(0);
  }
});

test("the mobility board puts an aviation widget on the canvas with a stage", () => {
  const l = BUILTIN_PRESETS.find((p) => p.id === "mobility")!.build();
  expect(l.widgets.some((w) => w.type === "aviation")).toBe(true);
  expect(["map2d", "map3d", "clock"]).toContain(l.stage);
});

test("every preset references only real core widgets or registered signal widgets", () => {
  for (const p of BUILTIN_PRESETS) {
    for (const w of p.build().widgets) {
      const known = CORE_WIDGETS.has(w.type) || SIGNAL_WIDGETS.has(w.type);
      expect(known, `preset "${p.id}" references unknown widget type "${w.type}"`).toBe(true);
    }
  }
});

// "Civic safety" is a single UK-police-only crime feed — it renders empty everywhere
// outside the UK, so the broad *global* boards intentionally don't feature it. Every other
// signal group must be surfaced by at least one board.
const EXEMPT_GROUPS = new Set(["Civic safety"]);

test("the five boards together exercise the whole catalogue (all core cards + every global signal group)", () => {
  const used = new Set(BUILTIN_PRESETS.flatMap((p) => p.build().widgets.map((w) => w.type)));

  // All seven core monitoring cards appear across the lineup.
  for (const core of CORE_MONITORS) {
    expect(used.has(core), `no board uses the core "${core}" widget`).toBe(true);
  }

  // At least one signal from every non-exempt registered signal group is surfaced somewhere.
  for (const { group, sources } of signalsByGroup()) {
    if (EXEMPT_GROUPS.has(group)) continue;
    const covered = sources.some((s) => used.has(`signal:${s.id}`));
    expect(covered, `no board surfaces any signal from the "${group}" group`).toBe(true);
  }
});
