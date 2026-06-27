# PRD: Smart marker clustering
> Priority: P1 · Effort: M · Status: Proposed · Category: map-interaction

## 1. Summary
Cluster the ~3,300 camera markers into adaptive count badges that split apart as you zoom and expand into a pickable list on click, so the map stays legible at world scale instead of a solid blob of pins. Clustering is per-type: cameras cluster aggressively, planes stay individually rendered when zoomed in (so flights and breadcrumb trails remain readable), and satellites are never clustered (they live on the globe shell, not the flat map).

## 2. Why it matters for TrafficNerd
At country/continent zoom, 3,300 camera pins overlap into noise — you can't tell London from a single TfL junction. Count badges ("412") communicate density at a glance (where is traffic-camera coverage dense?), and clicking drills into the actual feeds. Keeping aircraft un-clustered preserves the live, moving-dot quality that makes the plane layer feel alive; clustering them would erase trails and headings.

## 3. worldmonitor.app reference
worldmonitor clusters dense markers by an adaptive pixel radius that grows when zoomed out; a cluster shows its item count as a badge, and clicking lists the contained items in a popup. It applies per-type rules to reduce clutter. We adapt this directly: badges + click-to-expand, with type-specific clustering policy.

## 4. How we build it (TrafficNerd-specific)
No new data or network calls — clustering is a pure client-side transform of the existing `WorldObject[]` camera feed. MapLibre's GeoJSON source has native clustering, so we lean on it rather than hand-rolling a quadtree.

**Data source:** existing camera registry output (`lib/sources/*` → normalized `Camera` → `WorldObject`). Zero new endpoints, no proxy involved (clustering touches only lat/lon + id, never `streamUrl`).

**MapLibre layers (in `components/MapView.tsx`):** change the `cameras` GeoJSON source to `{ cluster: true, clusterRadius: 50, clusterMaxZoom: 11 }`. Replace the single `camera-markers` symbol layer with three layers reading the same source:
- `camera-clusters` — `circle` layer, filter `["has","point_count"]`, radius via `step` on `point_count` (e.g. 14 → 18 → 24), colour ramped by density.
- `camera-cluster-count` — `symbol` layer, `text-field: ["get","point_count_abbreviated"]`, monospaced to match the dark ops theme.
- `camera-unclustered` — the existing icon symbol layer, filter `["!",["has","point_count"]]`, keeping the feed/region icon logic (`loadCameraIcons`, `regionKeyOf`).

**New file `lib/cameras/cluster.ts`:** small helpers — `CLUSTER_CONFIG` constants and `expandCluster(map, clusterId)` returning leaves via `source.getClusterLeaves`. Keeps `MapView.tsx` thin and unit-testable.

**Interaction:**
- Click a cluster → `getClusterExpansionZoom` then `easeTo` to zoom-split. Shift/Cmd-click (or click on an already-max-zoom cluster) → call `getClusterLeaves(id, 50, 0)` and push the list into a new `overlay` mode (`overlay.openClusterList(leaves)`), rendered by `lib/overlay-content.tsx` as a scrollable dossier list; clicking a row calls existing `overlay.open(camera)`.
- Hover cluster → cursor pointer + `text-halo`; hover leaf unchanged.
- Keyboard: cluster list panel is focus-trapped, Arrow keys move selection, Enter opens the camera, Esc closes (reuse the dossier panel's existing handlers).

**Per-type policy:** planes (`PLANE_SRC`) and trails keep `cluster: false` — explicitly documented in `cluster.ts`. Satellites are globe-only (`components/GlobeView.tsx`) and untouched. Add a `lib/layers.ts`-driven toggle `clusterCameras` (default on) so power users can disable clustering.

**States:** loading = source not yet set, no clusters (existing skeleton). Empty = filtered-out cameras → no clusters, no error. Error = registry stale-cache fallback already handles upstream; clustering shows whatever cameras exist.

## 5. Dependencies & prerequisites
- `maplibre-gl` (already a dep) — native clustering, no new library.
- Existing camera registry + `WorldObject` contract (`lib/world.ts`), `overlay` store (`lib/overlay.ts`), `layersStore` (`lib/layers.ts`).
- Soft-depends on the camera-filter feature (`lib/cameraFilter.ts`): clustered features must reflect active filters, so re-cluster on filter change.

## 6. Risks & mitigations
- **Re-cluster cost on every feed refresh** (~3,300 pts): MapLibre clusters off-main-thread; only call `setData` when the feature set actually changes (diff by id-set hash) to avoid jank.
- **Filter + cluster sync:** rebuild the FeatureCollection from the filtered list, not the raw list, or counts lie. Covered by a unit test on `toFeatureCollection`.
- **Plane legibility:** enforce `cluster:false` on the plane source in a regression test.
- **No CORS/ToS/rate-limit exposure** — purely client-side geometry; no outbound fetch, SSRF allowlist untouched.

## 7. Acceptance criteria
- [ ] At world zoom, cameras render as <~30 cluster badges, not 3,300 pins.
- [ ] Badge text equals the true contained camera count (abbreviated, e.g. "1.2k").
- [ ] Clicking a cluster zooms to split it; clicking a max-zoom cluster lists its cameras; a list row opens that camera's dossier with a live feed.
- [ ] Planes remain individually rendered with intact trails/headings at all zooms.
- [ ] Satellites unaffected.
- [ ] `clusterCameras` toggle in the layer rail turns clustering off → all pins individual.
- [ ] No new outbound network requests; no raw `streamUrl` reaches the client.
- [ ] Unit tests: `expandCluster`, filter-aware FeatureCollection counts, plane `cluster:false`.

## 8. Out of scope / future
- Spiderfy / fan-out of overlapping un-clustered pins at max zoom.
- Clustering planes or satellites.
- Heatmap density layer (separate PRD).
- Per-source cluster colour legend beyond density ramp.
