"use client";
import { createDefaultLayout, type ShellLayout, type SegmentId } from "@/lib/console/types";
import { addWidget, setStage } from "@/lib/console/reducers";
import { shellLayoutStore } from "@/lib/console/store";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export interface ConsolePreset { id: string; title: string; icon: string; build(): ShellLayout }

let seed = 0;
const id = () => `p${(seed += 1).toString(36)}`;
function compose(stage: ShellLayout["stage"], specs: { type: string; segment: SegmentId }[]): ShellLayout {
  let l = setStage(createDefaultLayout(), stage);
  for (const s of specs) l = addWidget(l, s.type, id(), { segment: s.segment });
  return l;
}

export const BUILTIN_PRESETS: ConsolePreset[] = [
  { id: "world", title: "World", icon: "🌐", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "news", segment: "bottom" },
      { type: "cameras", segment: "right" }, { type: "aviation", segment: "left" },
  ]) },
  { id: "aviation-ops", title: "Aviation Ops", icon: "✈", build: () => compose("map2d", [
      { type: "aviation", segment: "left" }, { type: "events", segment: "left" },
      { type: "cameras", segment: "right" }, { type: "news", segment: "bottom" },
  ]) },
  { id: "disaster-response", title: "Disaster Response", icon: "🆘", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "cameras", segment: "right" },
      { type: "news", segment: "bottom" },
  ]) },
];

const KEY = "tn.console.presets.v1";
const VERSION = 1;
interface CustomPreset { id: string; title: string; layout: ShellLayout }

function loadCustom(): CustomPreset[] { return loadPersisted<CustomPreset[]>(KEY, VERSION) ?? []; }

export function applyPreset(presetId: string): void {
  const built = BUILTIN_PRESETS.find((p) => p.id === presetId);
  if (built) { shellLayoutStore.replace(built.build()); return; }
  const custom = loadCustom().find((p) => p.id === presetId);
  if (custom) shellLayoutStore.replace(custom.layout);
}

export function saveCustomPreset(title: string): void {
  const list = loadCustom();
  list.push({ id: `custom-${Date.now().toString(36)}`, title, layout: shellLayoutStore.get() });
  savePersisted(KEY, VERSION, list);
}

export function listPresets(): { id: string; title: string; icon: string }[] {
  return [...BUILTIN_PRESETS.map((p) => ({ id: p.id, title: p.title, icon: p.icon })),
          ...loadCustom().map((p) => ({ id: p.id, title: p.title, icon: "★" }))];
}
