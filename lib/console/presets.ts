"use client";
import { createDefaultLayout, type ShellLayout, type SegmentId } from "@/lib/console/types";
import { addWidget, setStage } from "@/lib/console/reducers";
import { shellLayoutStore } from "@/lib/console/store";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

// A preset is a persona: a curated workspace aimed at ONE kind of user. `blurb` is the
// short "who it's for" tag surfaced next to the title in the ⌘K Profiles section, so the
// list reads as an audience menu rather than a pile of domains.
export interface ConsolePreset {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  build(): ShellLayout;
}

/** The board a fresh visitor lands on (ConsoleShell first-run seed + "Reset to default"). */
export const DEFAULT_PRESET_ID = "intelligence";

let seed = 0;
const id = () => `p${(seed += 1).toString(36)}`;
function compose(stage: ShellLayout["stage"], specs: { type: string; segment: SegmentId }[]): ShellLayout {
  let l = setStage(createDefaultLayout(), stage);
  for (const s of specs) l = addWidget(l, s.type, id(), { segment: s.segment });
  return l;
}

// Each preset drops a curated set of widgets across the left / right / bottom segments.
// Widget `type`s are the registered widget ids — core layers (events, cameras, aviation,
// satellites, markets, headlines, news) and per-signal cards (`signal:<sourceId>`).
export const BUILTIN_PRESETS: ConsolePreset[] = [
  // ── Generalist ──────────────────────────────────────────────────────────
  // World Overview — a calm bit-of-everything board for a first look.
  { id: "world", title: "World Overview", icon: "🌐", blurb: "generalist", build: () => compose("map2d", [
      { type: "signal:instability", segment: "left" }, { type: "events", segment: "left" },
      { type: "cameras", segment: "right" }, { type: "markets", segment: "right" },
      { type: "headlines", segment: "bottom" },
  ]) },

  // ── Newsroom — journalists / news followers ─────────────────────────────
  // Breaking events, live headlines and streaming video.
  { id: "newsroom", title: "Newsroom", icon: "📰", blurb: "for journalists", build: () => compose("map2d", [
      { type: "events", segment: "left" }, { type: "signal:conflict", segment: "left" },
      { type: "headlines", segment: "right" }, { type: "cameras", segment: "right" },
      { type: "news", segment: "bottom" },
  ]) },

  // ── Intelligence — OSINT / conflict analysts (the default landing board) ─
  // Instability synthesis, geolocated conflict/protests, verified ACLED, military air.
  { id: "intelligence", title: "Intelligence", icon: "🔎", blurb: "for analysts", build: () => compose("map2d", [
      { type: "signal:instability", segment: "left" }, { type: "signal:conflict", segment: "left" },
      { type: "signal:acled", segment: "right" }, { type: "signal:protests", segment: "right" },
      { type: "signal:military-air", segment: "bottom" },
  ]) },

  // ── Emergency Response — disaster & relief teams ────────────────────────
  // Multi-hazard GDACS alerts plus the live earthquake / fire / flood / storm layers.
  { id: "emergency", title: "Emergency Response", icon: "🆘", blurb: "for responders", build: () => compose("map2d", [
      { type: "signal:gdacs", segment: "left" }, { type: "signal:earthquakes", segment: "left" },
      { type: "signal:wildfires", segment: "right" }, { type: "signal:floods", segment: "right" },
      { type: "signal:tropical-cyclones", segment: "bottom" },
  ]) },

  // ── Aviation — spotters & flight ops ────────────────────────────────────
  // Live traffic, military movements, airports, and what threatens navigation.
  { id: "aviation-ops", title: "Aviation", icon: "✈", blurb: "for aviation", build: () => compose("map2d", [
      { type: "aviation", segment: "left" }, { type: "signal:gpsJamming", segment: "left" },
      { type: "signal:military-air", segment: "right" }, { type: "signal:airports", segment: "right" },
      { type: "cameras", segment: "bottom" },
  ]) },

  // ── Markets Desk — traders / economists ─────────────────────────────────
  // Crypto/FX, macro headlines, and the supply-chain / energy risk that moves them.
  { id: "markets-desk", title: "Markets Desk", icon: "📈", blurb: "for traders", build: () => compose("map2d", [
      { type: "markets", segment: "left" }, { type: "headlines", segment: "left" },
      { type: "signal:conflict", segment: "right" }, { type: "signal:grid-load", segment: "right" },
      { type: "signal:ports", segment: "bottom" },
  ]) },

  // ── Space & Orbital — space watchers (globe stage) ──────────────────────
  { id: "space", title: "Space & Orbital", icon: "🛰", blurb: "for space fans", build: () => compose("map3d", [
      { type: "satellites", segment: "left" }, { type: "signal:launches", segment: "left" },
      { type: "signal:aurora", segment: "right" }, { type: "signal:space-weather", segment: "right" },
      { type: "signal:gpsJamming", segment: "bottom" },
  ]) },

  // ── Maritime — shipping & logistics ─────────────────────────────────────
  { id: "maritime", title: "Maritime", icon: "🚢", blurb: "for logistics", build: () => compose("map2d", [
      { type: "signal:ais", segment: "left" }, { type: "signal:ports", segment: "left" },
      { type: "signal:cables", segment: "right" }, { type: "signal:tropical-cyclones", segment: "right" },
      { type: "cameras", segment: "bottom" },
  ]) },

  // ── Climate & Environment — environment watchers ────────────────────────
  { id: "climate", title: "Climate & Environment", icon: "🌿", blurb: "for climate", build: () => compose("map2d", [
      { type: "signal:weather", segment: "left" }, { type: "signal:wildfires", segment: "left" },
      { type: "signal:airquality", segment: "right" }, { type: "signal:floods", segment: "right" },
      { type: "signal:tropical-cyclones", segment: "bottom" },
  ]) },

  // ── Cyber & Infrastructure — security teams ─────────────────────────────
  { id: "cyber-infra", title: "Cyber & Infrastructure", icon: "🛡", blurb: "for security", build: () => compose("map2d", [
      { type: "signal:cyber-c2", segment: "left" }, { type: "signal:cyber-ransomware", segment: "left" },
      { type: "signal:internet-outages", segment: "right" }, { type: "signal:cables", segment: "right" },
      { type: "signal:grid-load", segment: "bottom" },
  ]) },

  // ── Explorer — relaxed, casual browsing ─────────────────────────────────
  { id: "explorer", title: "Explorer", icon: "🧭", blurb: "casual", build: () => compose("map2d", [
      { type: "cameras", segment: "left" }, { type: "events", segment: "left" },
      { type: "news", segment: "right" }, { type: "headlines", segment: "bottom" },
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

export function listPresets(): { id: string; title: string; icon: string; blurb: string }[] {
  return [...BUILTIN_PRESETS.map((p) => ({ id: p.id, title: p.title, icon: p.icon, blurb: p.blurb })),
          ...loadCustom().map((p) => ({ id: p.id, title: p.title, icon: "★", blurb: "saved" }))];
}
