// Shared contract for the GENERIC "global signals" layer framework.
//
// A "signal" is any keyless, global, opt-in point dataset (earthquakes, wildfires,
// aurora, …). Unlike the core cameras/planes/satellites layers — which each have
// bespoke rendering — every signal source is rendered by ONE data-driven MapLibre
// circle+label layer in WorldMap. Adding a new layer therefore = one adapter
// (fetch → SignalFeature[]) + one registry entry, with NO new WorldMap code.
//
// Batch A was POINT-only (all the natural-hazard sources need). Batch B added the
// geometry variant below: a signal feature may ALSO carry a line/area `geometry`,
// in which case WorldMap renders it on a second/third aggregated source (a `line`
// layer + a `fill` layer) instead of the circle layer — while lat/lon stays the
// click / label / dossier anchor (a representative centroid). The registry / store
// / route / dossier plumbing is unchanged. See lib/signals/registry.ts.

/**
 * Optional line/area geometry for a signal feature. GeoJSON coordinate order
 * ([lon, lat], rings for polygons). When present, the feature renders as a line
 * or fill rather than a circle; lat/lon remains the anchor point used for the
 * click hit-test, the label, the deep-link and the dossier "lat, lon" line.
 */
export type SignalGeometry =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

/** One renderable signal: a point, or (with `geometry`) a line / area. */
export interface SignalFeature {
  /** Globally-unique, namespaced id, e.g. "usgs:nc75385096", "eonet:EONET_20558". */
  id: string;
  /** Anchor latitude — for area features this is a representative centroid. */
  lat: number;
  /** Anchor longitude — for area features this is a representative centroid. */
  lon: number;
  /** Short human label — the dossier title and (optionally) the on-map label. */
  title: string;
  /** Which registry source produced this feature (rides into the GeoJSON props). */
  signalId: string;
  /**
   * Optional line/area geometry. Absent ⇒ a plain point (the circle layer).
   * Present ⇒ rendered by WorldMap's signal `line` (LineString/MultiLineString)
   * or `fill` (Polygon/MultiPolygon) layer, anchored at lat/lon for interaction.
   */
  geometry?: SignalGeometry;
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

/**
 * Declares the scalar that drives a monitor row's <MetricBar>. Kept separate from
 * the overloaded `props.magnitude` (which is a Richter value for quakes but a rescaled
 * radius proxy for GDACS/cyclones/instability) so a bar never mislabels a source: each
 * source names the REAL field + its [calm, extreme] domain. Sources without a metric
 * render a severity-coloured dot instead of a bar (honest — no invented scale).
 */
export interface SignalMetric {
  /** props key holding the raw scalar, or the literal "magnitude". */
  field: string;
  /** [calm, extreme] — normalises the bar fill to 0..1. */
  domain: [number, number];
  /** Optional unit suffix on the numeric label (e.g. "kt"). */
  unit?: string;
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
  /** Optional: the scalar → magnitude bar in the monitor row. Omit for a plain dot. */
  metric?: SignalMetric;
  /** Fetch + normalise upstream into points. MUST resolve (never reject) to []. */
  fetch(): Promise<SignalFeature[]>;
}
