// Shared contract for the GENERIC "global signals" layer framework.
//
// A "signal" is any keyless, global, opt-in point dataset (earthquakes, wildfires,
// aurora, …). Unlike the core cameras/planes/satellites layers — which each have
// bespoke rendering — every signal source is rendered by ONE data-driven MapLibre
// circle+label layer in WorldMap. Adding a new layer therefore = one adapter
// (fetch → SignalFeature[]) + one registry entry, with NO new WorldMap code.
//
// Batch A is POINT-only (that is all the natural-hazard sources need). Lines and
// polygons can extend this later by adding a `geometry`-discriminated variant to
// SignalFeature and a matching line/fill layer in WorldMap — the registry/store/
// route/dossier plumbing stays unchanged. See lib/signals/registry.ts.

/** One renderable point from a signal source. */
export interface SignalFeature {
  /** Globally-unique, namespaced id, e.g. "usgs:nc75385096", "eonet:EONET_20558". */
  id: string;
  lat: number;
  lon: number;
  /** Short human label — the dossier title and (optionally) the on-map label. */
  title: string;
  /** Which registry source produced this feature (rides into the GeoJSON props). */
  signalId: string;
  /** Per-feature marker colour (CSS hex). Falls back to the source colour. */
  color?: string;
  /**
   * Free-form key→value pairs rendered as the dossier definition list.
   * Convention: a numeric `magnitude` (≈0–10 scale) scales the marker radius —
   * sources whose "magnitude" is on a different scale (e.g. wind in kts) should
   * name it differently so it does not distort the dot size.
   */
  props?: Record<string, unknown>;
  /** Canonical upstream detail page for this event. */
  link?: string;
  /** ISO timestamp of the observation/event, when known. */
  ts?: string;
}

/** A registered signal layer: metadata + a pure-ish fetch that yields points. */
export interface SignalSource {
  /** Stable id; also the dynamic route segment (/api/signals/<id>) + store key. */
  id: string;
  /** Human label shown in the rail. */
  label: string;
  /** Rail grouping, e.g. "Natural hazards" / "Space weather". */
  group: string;
  /** Representative colour for the rail dot + per-feature fallback. */
  color: string;
  /** Suggested client refresh + server cache TTL, in ms. */
  refreshMs: number;
  /** Mandatory upstream credit, shown in the rail and the dossier. */
  attribution: string;
  /** Fetch + normalise upstream into points. MUST resolve (never reject) to []. */
  fetch(): Promise<SignalFeature[]>;
}
