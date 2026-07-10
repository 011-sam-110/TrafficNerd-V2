// Widget help — the text behind the "?" affordance on every widget frame. A widget
// declares a concise, honest `help` in the registry ({ what, source }); this module
// is the PURE resolver the frame calls, plus the builder that derives help for the
// ~30 generic signal widgets from their source metadata (so a new signal layer gets
// an honest note for free). No DOM, no React — unit-tested against fixtures.

/** What a widget declares for its ? popover. */
export interface WidgetHelp {
  /** One or two plain sentences: what the panel shows and why it's useful. */
  what: string;
  /** Where the data comes from (upstream provider / feed), when there's one to name. */
  source?: string;
}

/** The resolved, render-ready help for a frame's ? popover. */
export interface ResolvedHelp {
  title: string;
  what: string;
  source?: string;
}

/**
 * Resolve a widget's help for display. Uses the declared `help` when present, else
 * falls back to an honest generic line keyed off the title — every widget therefore
 * has *something* to show, and nothing is invented about a source we don't know.
 */
export function resolveWidgetHelp(type: { title: string; help?: WidgetHelp }): ResolvedHelp {
  const help = type.help;
  return {
    title: type.title,
    what: help?.what ?? `A live monitor panel: ${type.title}.`,
    source: help?.source,
  };
}

/** Short, honest "what this group is" line per signal group (drives generic signal help). */
const GROUP_BLURB: Record<string, string> = {
  Synthesis: "A cross-layer read of the most abnormal signals right now, ranked so you can triage at a glance.",
  "Natural hazards": "Live natural-hazard events worldwide — the kind that move fast and matter on the ground.",
  "Space weather": "Space-weather conditions — solar activity, geomagnetic storms and where aurora is likely.",
  Space: "Objects and activity overhead — satellites and launches you can track in near-real time.",
  Infrastructure: "The physical and network backbone — subsea cables, power grids and connectivity outages.",
  Intel: "Open-source intelligence distilled from the global news stream, mapped to where it's happening.",
  Conflict: "Armed-conflict and security incidents, plotted as they're reported.",
  Environment: "Environmental conditions and stress — air quality, wildfires and climate signals.",
  "Civic safety": "Reported civic-safety and policing incidents (coverage is region-specific).",
  "Cyber threat": "Cyber-threat activity — command-and-control, ransomware and network abuse in the open record.",
  "Human cost": "The human cost of crises — displacement and humanitarian need.",
  Military: "Military movements and activity visible in open, keyless feeds.",
  Maritime: "Maritime traffic and where the world's shipping chokepoints are congesting.",
  Weather: "Current weather and severe-weather watches.",
};

/**
 * Build help for a generic signal widget from its source. The `what` describes the
 * layer's group in plain language; the `source` names the mandatory upstream credit
 * the source already carries — so the ? note is accurate without a hand-written entry
 * per layer.
 */
export function signalHelp(source: { label: string; group: string; attribution: string }): WidgetHelp {
  const blurb = GROUP_BLURB[source.group] ?? `A live global signal layer (${source.group}).`;
  return { what: `${source.label} — ${blurb}`, source: source.attribution };
}
