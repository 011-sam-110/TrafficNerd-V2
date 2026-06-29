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

// Each preset is a curated profile: a stage + a set of widgets all relevant to
// one field, spread across the left / right / bottom segments. Widget `type`s are
// the registered widget ids — core layers (events, cameras, aviation, satellites,
// markets, headlines, news) and per-signal cards (`signal:<sourceId>`).
export const BUILTIN_PRESETS: ConsolePreset[] = [
  // A balanced cross-domain overview — the default landing profile.
  { id: "world", title: "World", icon: "🌐", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "aviation", segment: "left" },
      { type: "cameras", segment: "right" }, { type: "markets", segment: "right" },
      { type: "headlines", segment: "bottom" },
  ]) },

  // Aviation — live traffic, military movements, and what threatens flight.
  { id: "aviation-ops", title: "Aviation Ops", icon: "✈", build: () => compose("map2d", [
      { type: "aviation", segment: "left" }, { type: "signal:gpsJamming", segment: "left" },
      { type: "signal:military-air", segment: "right" }, { type: "cameras", segment: "right" },
      { type: "events", segment: "bottom" },
  ]) },

  // Natural disasters — earthquakes, fires, storms, multi-hazard GDACS alerts.
  { id: "disaster-response", title: "Disaster Response", icon: "🆘", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "signal:earthquakes", segment: "left" },
      { type: "signal:wildfires", segment: "right" }, { type: "signal:tropical-cyclones", segment: "right" },
      { type: "signal:gdacs", segment: "bottom" },
  ]) },

  // Security & conflict — events, protests, military air, world headlines.
  { id: "security", title: "Security & Conflict", icon: "⚔", build: () => compose("map2d", [
      { type: "signal:conflict", segment: "left" }, { type: "signal:acled", segment: "left" },
      { type: "signal:protests", segment: "right" }, { type: "signal:military-air", segment: "right" },
      { type: "headlines", segment: "bottom" },
  ]) },

  // Cyber & critical infrastructure — botnets, ransomware, outages, grid, cables.
  { id: "cyber-infra", title: "Cyber & Infrastructure", icon: "🛡", build: () => compose("map2d", [
      { type: "signal:cyber-c2", segment: "left" }, { type: "signal:cyber-ransomware", segment: "left" },
      { type: "signal:internet-outages", segment: "right" }, { type: "signal:cables", segment: "right" },
      { type: "signal:grid-load", segment: "bottom" },
  ]) },

  // Climate & environment — weather, fires, air quality, floods, cyclones.
  { id: "climate", title: "Climate & Environment", icon: "🌿", build: () => compose("map2d", [
      { type: "signal:weather", segment: "left" }, { type: "signal:wildfires", segment: "left" },
      { type: "signal:airquality", segment: "right" }, { type: "signal:floods", segment: "right" },
      { type: "signal:tropical-cyclones", segment: "bottom" },
  ]) },

  // Space & orbital — satellites, launches, aurora and space-weather (globe stage).
  { id: "space", title: "Space & Orbital", icon: "🛰", build: () => compose("map3d", [
      { type: "satellites", segment: "left" }, { type: "signal:launches", segment: "left" },
      { type: "signal:aurora", segment: "right" }, { type: "signal:space-weather", segment: "right" },
      { type: "signal:gpsJamming", segment: "bottom" },
  ]) },

  // Markets & newsroom — crypto/FX, world headlines, live video news.
  { id: "markets-news", title: "Markets & Newsroom", icon: "📈", build: () => compose("map2d", [
      { type: "markets", segment: "left" }, { type: "signal:conflict", segment: "left" },
      { type: "headlines", segment: "right" }, { type: "news", segment: "bottom" },
  ]) },

  // Maritime — vessel traffic, ports, undersea cables, cyclones at sea.
  { id: "maritime", title: "Maritime", icon: "🚢", build: () => compose("map2d", [
      { type: "signal:ais", segment: "left" }, { type: "signal:ports", segment: "left" },
      { type: "signal:cables", segment: "right" }, { type: "signal:tropical-cyclones", segment: "right" },
      { type: "cameras", segment: "bottom" },
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
