# US Cameras + Live Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add California (Caltrans) and South Carolina (SCDOT) traffic cameras to the globe with real live HLS video, served through a closed proxy.

**Architecture:** Two new keyless `Source` adapters normalize into the existing `Camera` schema; the registry merges all sources resiliently; a new `/api/hls` proxy injects the per-host Referer Caltrans requires and rewrites HLS playlists/segments to be same-origin; a `CameraVideo` (hls.js) component plays the live stream and falls back to the refreshing still when a stream is offline.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · zod · hls.js · vitest (unit) · Playwright (e2e)

## Global Constraints

- Next.js 15 App Router, TypeScript, React 19. Path alias `@` → repo root.
- **No API keys** — every source is keyless (Caltrans, SCDOT).
- Canonical type is `Camera` (zod) from `@/lib/types`; ids are namespaced `${source}:${nativeId}`.
- Every camera carries `license` + `attribution`; the UI must **always** render `<AttributionBadge>` (image and video paths alike).
- **SSRF:** every outbound proxy fetch is gated by a host+path allowlist, uses `redirect: "error"`, an `AbortSignal.timeout`, and rejects non-http(s).
- **The client never receives a raw `streamUrl`** — video is always fetched via `/api/hls?id=…`.
- Unit tests: `tests/unit/**/*.test.ts` (vitest, node env). Fixtures: `tests/fixtures/`. E2E: `tests/e2e/` (Playwright; live-source dependent, like the existing TfL e2e).
- **Commits are solo-attributed — do NOT add a `Co-Authored-By: Claude` trailer** (user preference for these public repos). Use plain `git commit -m "…"`.

---

### Task 1: Caltrans adapter

**Files:**
- Create: `lib/sources/caltrans.ts`
- Create: `tests/fixtures/caltrans-d11.json`
- Test: `tests/unit/caltrans.test.ts`

**Interfaces:**
- Consumes: `Camera`, `CameraArray`, `Source` from `@/lib/types`.
- Produces: `CALTRANS_SOURCE: Source`; `normalizeCaltrans(records: CaltransRecord[], district: number): Camera[]`; `fetchRegistry(): Promise<Camera[]>`.

- [ ] **Step 1: Write the fixture** — `tests/fixtures/caltrans-d11.json` (the `data` array; record 1 = video+still/in-service, record 2 = still-only/out-of-service, record 3 = no media → must be skipped):

```json
[
  { "cctv": { "index": "1",
    "location": { "locationName": "SR-163 : Friars NEB", "nearbyPlace": "San Diego", "longitude": "-117.160577", "latitude": "32.772126", "direction": "South", "route": "SR-163" },
    "inService": "true",
    "imageData": { "streamingVideoURL": "https://wzmedia.dot.ca.gov/D11/CAM1.stream/playlist.m3u8",
      "static": { "currentImageURL": "https://cwwp2.dot.ca.gov/data/d11/cctv/image/cam1/cam1.jpg", "currentImageUpdateFrequency": "2" } } } },
  { "cctv": { "index": "2",
    "location": { "locationName": "I-8 at Hotel Circle", "nearbyPlace": "San Diego", "longitude": "-117.18", "latitude": "32.76", "direction": "East", "route": "I-8" },
    "inService": "false",
    "imageData": { "streamingVideoURL": "",
      "static": { "currentImageURL": "https://cwwp2.dot.ca.gov/data/d11/cctv/image/cam2/cam2.jpg", "currentImageUpdateFrequency": "2" } } } },
  { "cctv": { "index": "3",
    "location": { "nearbyPlace": "El Cajon", "longitude": "-116.9", "latitude": "32.79" },
    "inService": "true",
    "imageData": { "static": {} } } }
]
```

- [ ] **Step 2: Write the failing test** — `tests/unit/caltrans.test.ts`:

```ts
import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/caltrans-d11.json";
import { normalizeCaltrans } from "@/lib/sources/caltrans";
import { CameraArray } from "@/lib/types";

test("normalizes Caltrans records into valid Cameras and skips no-media records", () => {
  const cams = normalizeCaltrans(fixture as never, 11);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // record 3 has no image and no stream
});

test("maps id, region, media type, availability and refresh", () => {
  const [a, b] = normalizeCaltrans(fixture as never, 11);
  expect(a.id).toBe("caltrans:d11-1");
  expect(a.country).toBe("US");
  expect(a.region).toBe("California");
  expect(a.mediaType).toBe("both"); // has a stream
  expect(a.available).toBe(true);
  expect(a.road).toBe("SR-163");
  expect(a.refreshSeconds).toBe(120); // 2 minutes * 60
  expect(b.mediaType).toBe("jpeg"); // empty streamingVideoURL
  expect(b.available).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/caltrans.test.ts`
Expected: FAIL — cannot find module `@/lib/sources/caltrans`.

- [ ] **Step 4: Implement** — `lib/sources/caltrans.ts`:

```ts
import { Camera, CameraArray, Source } from "@/lib/types";

export const CALTRANS_SOURCE: Source = {
  id: "caltrans",
  name: "Caltrans CCTV",
  license: "Caltrans Terms of Use",
  attribution: "Live traffic data © Caltrans (California DOT)",
  refreshSeconds: 60,
  needsKey: false,
};

const DISTRICTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface CaltransRecord {
  cctv: {
    index: string;
    location: {
      locationName?: string; nearbyPlace?: string;
      longitude?: string; latitude?: string; direction?: string; route?: string;
    };
    inService: string;
    imageData: {
      streamingVideoURL?: string;
      static?: { currentImageURL?: string; currentImageUpdateFrequency?: string };
    };
  };
}

export function normalizeCaltrans(records: CaltransRecord[], district: number): Camera[] {
  const cams: Camera[] = [];
  for (const r of records) {
    const c = r.cctv;
    const lat = Number(c.location?.latitude);
    const lon = Number(c.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const imageUrl = c.imageData?.static?.currentImageURL?.trim() || undefined;
    const streamUrl = c.imageData?.streamingVideoURL?.trim() || undefined;
    if (!imageUrl && !streamUrl) continue;
    const freqMin = Number(c.imageData?.static?.currentImageUpdateFrequency);
    const refreshSeconds = Number.isFinite(freqMin) && freqMin > 0 ? Math.max(30, freqMin * 60) : 60;
    cams.push({
      id: `caltrans:d${district}-${c.index}`,
      source: "caltrans",
      country: "US",
      region: "California",
      name: c.location?.locationName?.trim() || c.location?.nearbyPlace?.trim() || `Caltrans D${district} #${c.index}`,
      lat, lon,
      road: c.location?.route?.trim() || undefined,
      direction: c.location?.direction?.trim() || undefined,
      imageUrl,
      streamUrl,
      mediaType: streamUrl ? "both" : "jpeg",
      refreshSeconds,
      license: CALTRANS_SOURCE.license,
      attribution: CALTRANS_SOURCE.attribution,
      available: c.inService === "true",
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const results = await Promise.allSettled(
    DISTRICTS.map(async (d) => {
      const res = await fetch(`https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${d}.json`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Caltrans D${d}: ${res.status}`);
      const json = (await res.json()) as { data?: CaltransRecord[] };
      return normalizeCaltrans(json.data ?? [], d);
    }),
  );
  const cams = results
    .filter((r): r is PromiseFulfilledResult<Camera[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  return CameraArray.parse(cams);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/caltrans.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sources/caltrans.ts tests/fixtures/caltrans-d11.json tests/unit/caltrans.test.ts
git commit -m "feat: Caltrans (California) CCTV adapter — HLS video + still, district-resilient"
```

---

### Task 2: SCDOT adapter

**Files:**
- Create: `lib/sources/scdot.ts`
- Create: `tests/fixtures/scdot-cameras.json`
- Test: `tests/unit/scdot.test.ts`

**Interfaces:**
- Consumes: `Camera`, `CameraArray`, `Source` from `@/lib/types`.
- Produces: `SCDOT_SOURCE: Source`; `normalizeScdot(geojson: { features?: ScFeature[] }): Camera[]`; `fetchRegistry(): Promise<Camera[]>`.

- [ ] **Step 1: Write the fixture** — `tests/fixtures/scdot-cameras.json` (GeoJSON; feature 1 = healthy, feature 2 = `problem_stream`, feature 3 = null geometry → skipped):

```json
{ "type": "FeatureCollection", "features": [
  { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-79.062775, 33.845627] },
    "properties": { "id": "uuid-1", "name": "50001", "description": "US 501 N @ 16th Ave", "route": "US 501", "direction": "NB",
      "https_url": "https://s18.us-east-1.skyvdn.com:443/rtplive/50001/playlist.m3u8",
      "ios_url": "https://s18.us-east-1.skyvdn.com:443/rtplive/50001/playlist.m3u8",
      "image_url": "https://scdotsnap.us-east-1.skyvdn.com/thumbs/50001.flv.png", "active": true, "problem_stream": false } },
  { "type": "Feature", "geometry": { "type": "Point", "coordinates": [-80.9, 32.8] },
    "properties": { "id": "uuid-2", "name": "50002", "description": "I-26 @ Mile 5", "route": "I-26", "direction": "EB",
      "https_url": "https://s19.us-east-1.skyvdn.com:443/rtplive/50002/playlist.m3u8",
      "image_url": "https://scdotsnap.us-east-1.skyvdn.com/thumbs/50002.flv.png", "active": true, "problem_stream": true } },
  { "type": "Feature", "geometry": null, "properties": { "name": "50003" } }
] }
```

- [ ] **Step 2: Write the failing test** — `tests/unit/scdot.test.ts`:

```ts
import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/scdot-cameras.json";
import { normalizeScdot } from "@/lib/sources/scdot";
import { CameraArray } from "@/lib/types";

test("normalizes SCDOT GeoJSON into valid Cameras and skips geometry-less features", () => {
  const cams = normalizeScdot(fixture as never);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(2); // feature 3 has null geometry
});

test("uses description as name, lon/lat order, and problem_stream → unavailable", () => {
  const [a, b] = normalizeScdot(fixture as never);
  expect(a.id).toBe("scdot:50001");
  expect(a.region).toBe("South Carolina");
  expect(a.name).toBe("US 501 N @ 16th Ave");
  expect(a.lat).toBeCloseTo(33.845627, 5);
  expect(a.lon).toBeCloseTo(-79.062775, 5);
  expect(a.mediaType).toBe("both");
  expect(a.available).toBe(true);
  expect(b.available).toBe(false); // problem_stream: true
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/scdot.test.ts`
Expected: FAIL — cannot find module `@/lib/sources/scdot`.

- [ ] **Step 4: Implement** — `lib/sources/scdot.ts`:

```ts
import { Camera, CameraArray, Source } from "@/lib/types";

export const SCDOT_SOURCE: Source = {
  id: "scdot",
  name: "SCDOT 511 (South Carolina DOT)",
  license: "SCDOT 511 Terms of Use",
  attribution: "Live traffic data © SCDOT / 511sc.org",
  refreshSeconds: 60,
  needsKey: false,
};

export interface ScFeature {
  geometry?: { coordinates?: [number, number] } | null;
  properties?: {
    id?: string; name?: string; description?: string; route?: string; direction?: string;
    https_url?: string; ios_url?: string; image_url?: string;
    active?: boolean; problem_stream?: boolean;
  };
}

export function normalizeScdot(geojson: { features?: ScFeature[] }): Camera[] {
  const cams: Camera[] = [];
  for (const f of geojson.features ?? []) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!coords) continue;
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const imageUrl = p.image_url?.trim() || undefined;
    const streamUrl = p.https_url?.trim() || p.ios_url?.trim() || undefined;
    if (!imageUrl && !streamUrl) continue;
    const nativeId = (p.name ?? p.id ?? "").toString().trim();
    if (!nativeId) continue;
    cams.push({
      id: `scdot:${nativeId}`,
      source: "scdot",
      country: "US",
      region: "South Carolina",
      name: p.description?.trim() || p.name?.trim() || `SCDOT ${nativeId}`,
      lat, lon,
      road: p.route?.trim() || undefined,
      direction: p.direction?.trim() || undefined,
      imageUrl,
      streamUrl,
      mediaType: streamUrl ? "both" : "jpeg",
      refreshSeconds: SCDOT_SOURCE.refreshSeconds,
      license: SCDOT_SOURCE.license,
      attribution: SCDOT_SOURCE.attribution,
      available: p.active === true && p.problem_stream !== true,
    });
  }
  return cams;
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://sc.cdn.iteris-atis.com/geojson/icons/metadata/icons.cameras.geojson", {
    headers: { Accept: "application/json", Referer: "https://www.511sc.org/" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`SCDOT GeoJSON: ${res.status}`);
  const json = (await res.json()) as { features?: ScFeature[] };
  return CameraArray.parse(normalizeScdot(json));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/scdot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sources/scdot.ts tests/fixtures/scdot-cameras.json tests/unit/scdot.test.ts
git commit -m "feat: SCDOT (South Carolina) 511 adapter — HLS video + still"
```

---

### Task 3: Multi-source registry merge

**Files:**
- Modify: `lib/sources/registry.ts`
- Test: `tests/unit/registry.test.ts`

**Interfaces:**
- Consumes: `fetchRegistry` from tfl, caltrans, scdot; `findById`, `nearest` from `@/lib/sources/select`.
- Produces: `mergeResults(results: PromiseSettledResult<Camera[]>[], staleCache: Camera[] | null): Camera[]` (new, exported, pure); unchanged public API `getRegistry()`, `getCameraById()`, `nearestTo()`.

- [ ] **Step 1: Write the failing test** — `tests/unit/registry.test.ts`:

```ts
import { expect, test } from "vitest";
import { mergeResults } from "@/lib/sources/registry";
import type { Camera } from "@/lib/types";

const cam = (id: string): Camera => ({
  id, source: "x", country: "US", name: id, lat: 0, lon: 0,
  mediaType: "jpeg", refreshSeconds: 60, license: "L", attribution: "A", available: true,
});
const ok = (cams: Camera[]): PromiseSettledResult<Camera[]> => ({ status: "fulfilled", value: cams });
const fail = (): PromiseSettledResult<Camera[]> => ({ status: "rejected", reason: new Error("boom") });

test("unions all fulfilled sources", () => {
  expect(mergeResults([ok([cam("a")]), ok([cam("b"), cam("c")])], null).map((c) => c.id)).toEqual(["a", "b", "c"]);
});
test("ignores a rejected source when others succeed", () => {
  expect(mergeResults([ok([cam("a")]), fail()], null).map((c) => c.id)).toEqual(["a"]);
});
test("falls back to stale cache when everything fails", () => {
  expect(mergeResults([fail(), fail()], [cam("stale")]).map((c) => c.id)).toEqual(["stale"]);
});
test("throws when everything fails and there is no cache", () => {
  expect(() => mergeResults([fail()], null)).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/registry.test.ts`
Expected: FAIL — `mergeResults` is not exported.

- [ ] **Step 3: Implement** — replace the whole of `lib/sources/registry.ts`:

```ts
import type { Camera } from "@/lib/types";
import { fetchRegistry as fetchTfl } from "@/lib/sources/tfl";
import { fetchRegistry as fetchCaltrans } from "@/lib/sources/caltrans";
import { fetchRegistry as fetchScdot } from "@/lib/sources/scdot";
import { findById, nearest } from "@/lib/sources/select";

const TTL_MS = 5 * 60 * 1000;
const SOURCES: Array<() => Promise<Camera[]>> = [fetchTfl, fetchCaltrans, fetchScdot];
let cache: { cameras: Camera[]; at: number } | null = null;

export function mergeResults(
  results: PromiseSettledResult<Camera[]>[],
  staleCache: Camera[] | null,
): Camera[] {
  const cameras = results
    .filter((r): r is PromiseFulfilledResult<Camera[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);
  if (cameras.length === 0) {
    if (staleCache && staleCache.length > 0) return staleCache;
    throw new Error("all camera sources failed and no cache is available");
  }
  return cameras;
}

export async function getRegistry(): Promise<Camera[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cameras;
  const results = await Promise.allSettled(SOURCES.map((f) => f()));
  const cameras = mergeResults(results, cache?.cameras ?? null);
  cache = { cameras, at: Date.now() };
  return cameras;
}

export async function getCameraById(id: string): Promise<Camera | null> {
  return findById(await getRegistry(), id);
}

export async function nearestTo(lat: number, lon: number, limit = 8) {
  return nearest(await getRegistry(), lat, lon, limit);
}
```

- [ ] **Step 4: Run test to verify it passes (and the existing suite still green)**

Run: `npx vitest run tests/unit/registry.test.ts tests/unit/select.test.ts tests/unit/tfl.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/sources/registry.ts tests/unit/registry.test.ts
git commit -m "feat: merge TfL + Caltrans + SCDOT in the registry (resilient, stale-cache fallback)"
```

---

### Task 4: Extend the still-image allowlist

**Files:**
- Modify: `lib/proxy/allowlist.ts:2-4`
- Modify: `tests/unit/allowlist.test.ts`

**Interfaces:**
- Produces: unchanged `isAllowed(url: URL): boolean`, now also allowing the CA + SC image hosts.

- [ ] **Step 1: Add the failing tests** — append to `tests/unit/allowlist.test.ts`:

```ts
test("allows the Caltrans image host under /data/", () => {
  expect(isAllowed(new URL("https://cwwp2.dot.ca.gov/data/d11/cctv/image/cam1/cam1.jpg"))).toBe(true);
});
test("allows the SCDOT snapshot host under /thumbs/", () => {
  expect(isAllowed(new URL("https://scdotsnap.us-east-1.skyvdn.com/thumbs/50001.flv.png"))).toBe(true);
});
test("rejects those hosts outside their allowed prefix", () => {
  expect(isAllowed(new URL("https://cwwp2.dot.ca.gov/etc/secret.jpg"))).toBe(false);
  expect(isAllowed(new URL("https://scdotsnap.us-east-1.skyvdn.com/rtplive/x.ts"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/allowlist.test.ts`
Expected: FAIL — the two new hosts are not yet allowed.

- [ ] **Step 3: Implement** — replace the `RULES` array in `lib/proxy/allowlist.ts`:

```ts
const RULES: { host: string; prefix: string }[] = [
  { host: "s3-eu-west-1.amazonaws.com", prefix: "/jamcams.tfl.gov.uk/" },
  { host: "cwwp2.dot.ca.gov", prefix: "/data/" },
  { host: "scdotsnap.us-east-1.skyvdn.com", prefix: "/thumbs/" },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/allowlist.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/proxy/allowlist.ts tests/unit/allowlist.test.ts
git commit -m "feat: allow Caltrans + SCDOT still-image hosts in the proxy allowlist"
```

---

### Task 5: HLS streaming allowlist (host + per-host Referer)

**Files:**
- Create: `lib/proxy/hls-allowlist.ts`
- Test: `tests/unit/hls-allowlist.test.ts`

**Interfaces:**
- Produces: `isHlsAllowed(url: URL): { ok: boolean; referer?: string }`.

- [ ] **Step 1: Write the failing test** — `tests/unit/hls-allowlist.test.ts`:

```ts
import { expect, test } from "vitest";
import { isHlsAllowed } from "@/lib/proxy/hls-allowlist";

test("allows Caltrans wzmedia with the Caltrans referer", () => {
  const v = isHlsAllowed(new URL("https://wzmedia.dot.ca.gov/D11/CAM.stream/playlist.m3u8"));
  expect(v.ok).toBe(true);
  expect(v.referer).toBe("https://cwwp2.dot.ca.gov/");
});
test("allows SC skyvdn shards under /rtplive/ with the 511sc referer", () => {
  const v = isHlsAllowed(new URL("https://s19.us-east-1.skyvdn.com:443/rtplive/50001/playlist.m3u8"));
  expect(v.ok).toBe(true);
  expect(v.referer).toBe("https://www.511sc.org/");
});
test("rejects a skyvdn path outside /rtplive/", () => {
  expect(isHlsAllowed(new URL("https://s19.us-east-1.skyvdn.com/secret/x.m3u8")).ok).toBe(false);
});
test("rejects unknown hosts, look-alike suffixes, and non-http", () => {
  expect(isHlsAllowed(new URL("https://evil.example.com/x.m3u8")).ok).toBe(false);
  expect(isHlsAllowed(new URL("https://x.us-east-1.skyvdn.com.attacker.com/rtplive/x")).ok).toBe(false);
  expect(isHlsAllowed(new URL("file:///etc/passwd")).ok).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hls-allowlist.test.ts`
Expected: FAIL — cannot find module `@/lib/proxy/hls-allowlist`.

- [ ] **Step 3: Implement** — `lib/proxy/hls-allowlist.ts`:

```ts
// Streaming hosts are separate from the still-image allowlist: each rule also
// carries the Referer to inject (Caltrans' wzmedia is hotlink-protected).
type HlsRule = { match: (host: string) => boolean; prefix: string; referer: string };

const RULES: HlsRule[] = [
  { match: (h) => h === "wzmedia.dot.ca.gov", prefix: "/", referer: "https://cwwp2.dot.ca.gov/" },
  { match: (h) => h.endsWith(".us-east-1.skyvdn.com"), prefix: "/rtplive/", referer: "https://www.511sc.org/" },
];

export function isHlsAllowed(url: URL): { ok: boolean; referer?: string } {
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false };
  for (const r of RULES) {
    if (r.match(url.hostname) && url.pathname.startsWith(r.prefix)) {
      return { ok: true, referer: r.referer };
    }
  }
  return { ok: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hls-allowlist.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/proxy/hls-allowlist.ts tests/unit/hls-allowlist.test.ts
git commit -m "feat: HLS streaming allowlist with per-host Referer injection (SSRF-safe)"
```

---

### Task 6: HLS playlist rewriter (pure)

**Files:**
- Create: `lib/proxy/hls-rewrite.ts`
- Test: `tests/unit/hls-rewrite.test.ts`

**Interfaces:**
- Produces: `rewritePlaylist(body: string, upstreamUrl: string): string` — rewrites every media/playlist URI (and any `URI="…"` tag attribute) to `/api/hls?u=<absolute, encoded>`.

- [ ] **Step 1: Write the failing test** — `tests/unit/hls-rewrite.test.ts`:

```ts
import { expect, test } from "vitest";
import { rewritePlaylist } from "@/lib/proxy/hls-rewrite";

const BASE = "https://wzmedia.dot.ca.gov/D11/CAM.stream/playlist.m3u8";
const enc = (s: string) => encodeURIComponent(s);

test("rewrites a relative chunklist URI and leaves tag lines untouched", () => {
  const out = rewritePlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nchunklist_w1.m3u8\n", BASE);
  expect(out).toContain("#EXT-X-STREAM-INF:BANDWIDTH=1");
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/chunklist_w1.m3u8"));
});
test("rewrites relative .ts segments", () => {
  const out = rewritePlaylist("#EXTINF:2.0,\nmedia_w1_0.ts\n", BASE);
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/media_w1_0.ts"));
});
test("resolves absolute segment URIs", () => {
  const out = rewritePlaylist("#EXT-X-VERSION:3\nhttps://cdn.example.com/x/seg.ts\n", BASE);
  expect(out).toContain("#EXT-X-VERSION:3");
  expect(out).toContain("/api/hls?u=" + enc("https://cdn.example.com/x/seg.ts"));
});
test("rewrites the URI attribute of an EXT-X-KEY tag", () => {
  const out = rewritePlaylist('#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nmedia0.ts\n', BASE);
  expect(out).toContain("/api/hls?u=" + enc("https://wzmedia.dot.ca.gov/D11/CAM.stream/key.bin"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/hls-rewrite.test.ts`
Expected: FAIL — cannot find module `@/lib/proxy/hls-rewrite`.

- [ ] **Step 3: Implement** — `lib/proxy/hls-rewrite.ts`:

```ts
// Rewrite an HLS playlist so every nested URI routes back through /api/hls.
// Relative URIs are resolved against the upstream playlist URL first.
export function rewritePlaylist(body: string, upstreamUrl: string): string {
  const proxy = (abs: string) => `/api/hls?u=${encodeURIComponent(abs)}`;
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;
      if (trimmed.startsWith("#")) {
        // Tags like EXT-X-KEY / EXT-X-MAP can carry URI="...".
        const m = trimmed.match(/URI="([^"]+)"/);
        if (m) {
          const abs = new URL(m[1], upstreamUrl).toString();
          return line.replace(m[1], proxy(abs));
        }
        return line;
      }
      const abs = new URL(trimmed, upstreamUrl).toString();
      return proxy(abs);
    })
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/hls-rewrite.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/proxy/hls-rewrite.ts tests/unit/hls-rewrite.test.ts
git commit -m "feat: HLS playlist rewriter — nested URIs route back through the proxy"
```

---

### Task 7: HLS proxy route

**Files:**
- Create: `app/api/hls/route.ts`
- Test: `tests/e2e/hls.spec.ts`

**Interfaces:**
- Consumes: `getCameraById` (registry), `isHlsAllowed` (Task 5), `rewritePlaylist` (Task 6).
- Produces: `GET /api/hls?id=<cameraId>` (resolves the camera's stream) and `GET /api/hls?u=<absolute url>` (nested links). Returns rewritten `application/vnd.apple.mpegurl` for playlists; streams segments through with `Range` support; `400` (no params), `403` (disallowed), `404` (unknown id / no stream), `502` (upstream failure).

- [ ] **Step 1: Write the failing e2e** — `tests/e2e/hls.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("the HLS proxy rejects missing params and disallowed hosts", async ({ request }) => {
  expect((await request.get("/api/hls")).status()).toBe(400);
  const forbidden = await request.get("/api/hls?u=" + encodeURIComponent("https://evil.example.com/x.m3u8"));
  expect(forbidden.status()).toBe(403);
});

test("a US camera's stream is proxied as an HLS playlist", async ({ request }) => {
  const { cameras } = await (await request.get("/api/cameras")).json();
  const us = cameras.find((c: { id: string }) => c.id.startsWith("caltrans:") || c.id.startsWith("scdot:"));
  test.skip(!us, "no US camera available from live sources right now");
  const res = await request.get(`/api/hls?id=${encodeURIComponent(us.id)}`);
  // Live streams flake; accept a proxied playlist (200 mpegurl) or an upstream-down 502.
  if (res.ok()) {
    expect(res.headers()["content-type"]).toContain("mpegurl");
    expect(await res.text()).toContain("/api/hls?u=");
  } else {
    expect([502, 404]).toContain(res.status());
  }
});
```

- [ ] **Step 2: Run the e2e to verify it fails**

Run: `npx playwright test tests/e2e/hls.spec.ts`
Expected: FAIL — `/api/hls` 404s (route does not exist yet).

- [ ] **Step 3: Implement** — `app/api/hls/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { getCameraById } from "@/lib/sources/registry";
import { isHlsAllowed } from "@/lib/proxy/hls-allowlist";
import { rewritePlaylist } from "@/lib/proxy/hls-rewrite";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const idParam = req.nextUrl.searchParams.get("id");
  const uParam = req.nextUrl.searchParams.get("u");

  let upstream: string | null = null;
  if (uParam) {
    upstream = uParam;
  } else if (idParam) {
    const cam = await getCameraById(idParam);
    if (!cam?.streamUrl) return new Response("camera or stream not found", { status: 404 });
    upstream = cam.streamUrl;
  }
  if (!upstream) return new Response("missing id or u", { status: 400 });

  let target: URL;
  try { target = new URL(upstream); } catch { return new Response("bad url", { status: 400 }); }

  const verdict = isHlsAllowed(target);
  if (!verdict.ok) return new Response("forbidden host", { status: 403 });

  const range = req.headers.get("range");
  let res: Response;
  try {
    res = await fetch(target.toString(), {
      headers: {
        Referer: verdict.referer ?? "",
        "User-Agent": "TrafficNerd/2.0 (+https://github.com/011-sam-110/TrafficNerd-V2)",
        Accept: "*/*",
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }
  if (!res.ok && res.status !== 206) return new Response("upstream error", { status: 502 });

  const ct = res.headers.get("content-type");
  const isPlaylist = (ct?.includes("mpegurl") ?? false) || target.pathname.toLowerCase().endsWith(".m3u8");

  if (isPlaylist) {
    const body = await res.text();
    return new Response(rewritePlaylist(body, target.toString()), {
      status: 200,
      headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-store" },
    });
  }

  // Segment / binary: stream straight through (do not buffer), preserve range semantics.
  const headers = new Headers();
  headers.set("Content-Type", ct ?? "video/mp2t");
  const cr = res.headers.get("content-range"); if (cr) headers.set("Content-Range", cr);
  const cl = res.headers.get("content-length"); if (cl) headers.set("Content-Length", cl);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=5");
  return new Response(res.body, { status: res.status, headers });
}
```

- [ ] **Step 4: Run the e2e to verify it passes**

Run: `npx playwright test tests/e2e/hls.spec.ts`
Expected: PASS (guard test passes; the live test passes or skips).

- [ ] **Step 5: Commit**

```bash
git add app/api/hls/route.ts tests/e2e/hls.spec.ts
git commit -m "feat: /api/hls closed proxy — Referer injection, playlist rewrite, segment streaming"
```

---

### Task 8: Expose `mediaType` (and hide `streamUrl`); add `country` to the list

**Files:**
- Modify: `app/api/camera/[id]/route.ts:10-16`
- Modify: `app/api/cameras/route.ts:6-10`
- Test: `tests/e2e/camera.spec.ts` (append)

**Interfaces:**
- Produces: `/api/camera/[id]` response `camera` includes `mediaType` and **omits** `streamUrl`; `/api/cameras` list items include `country`.

- [ ] **Step 1: Add failing assertions** — append to `tests/e2e/camera.spec.ts`:

```ts
test("camera detail exposes mediaType but never the raw streamUrl", async ({ request }) => {
  const { cameras } = await (await request.get("/api/cameras")).json();
  expect(cameras[0].country).toBeTruthy(); // list now carries country
  const res = await request.get(`/api/camera/${encodeURIComponent(cameras[0].id)}`);
  const { camera } = await res.json();
  expect(camera.mediaType).toBeTruthy();
  expect(camera.streamUrl).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/e2e/camera.spec.ts`
Expected: FAIL — `country` missing from the slim list.

- [ ] **Step 3a: Implement** — in `app/api/cameras/route.ts`, add `country` to the mapped object:

```ts
  const cameras = cams.map((c) => ({
    id: c.id, name: c.name, lat: c.lat, lon: c.lon, available: c.available, country: c.country,
  }));
```

- [ ] **Step 3b: Implement** — in `app/api/camera/[id]/route.ts`, strip `streamUrl` before responding (replace the final `return`):

```ts
  const safe = { ...camera };
  delete (safe as { streamUrl?: string }).streamUrl;
  return Response.json({ camera: safe, nearby });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx playwright test tests/e2e/camera.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/cameras/route.ts "app/api/camera/[id]/route.ts" tests/e2e/camera.spec.ts
git commit -m "feat: API surfaces mediaType + country, hides raw streamUrl from clients"
```

---

### Task 9: hls.js video player + detail wiring

**Files:**
- Modify: `package.json` (add `hls.js`)
- Create: `components/CameraVideo.tsx`
- Modify: `components/CameraDetail.tsx:12-23,59-66` (add `mediaType` to `CamInfo`; choose player)
- Modify: `app/camera/[id]/page.tsx:4,21-25` (import + choose player)
- Test: `tests/e2e/us-video.spec.ts`

**Interfaces:**
- Consumes: `/api/hls?id=` (Task 7), `/api/proxy?id=` (poster, existing), `mediaType` (Task 8), `CameraImage`, `AttributionBadge`.
- Produces: `CameraVideo({ id, alt, attribution, license, refreshSeconds })` — a `<video>` that plays the proxied live HLS and falls back to `<CameraImage>` on fatal error.

- [ ] **Step 1: Install hls.js**

Run: `npm install hls.js`
Expected: `hls.js` added to `dependencies` (ships its own TypeScript types).

- [ ] **Step 2: Create the player** — `components/CameraVideo.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { AttributionBadge } from "@/components/AttributionBadge";
import { CameraImage } from "@/components/CameraImage";

export function CameraVideo(props: {
  id: string; alt: string; attribution: string; license: string; refreshSeconds: number;
}) {
  const { id, alt, attribution, license, refreshSeconds } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const src = `/api/hls?id=${encodeURIComponent(id)}`;
  const poster = `/api/proxy?id=${encodeURIComponent(id)}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // Safari plays HLS natively
      return;
    }
    (async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;
      if (!Hls.isSupported()) { setFailed(true); return; }
      const instance = new Hls({ enableWorker: true });
      hls = instance;
      instance.loadSource(src);
      instance.attachMedia(video);
      instance.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) { setFailed(true); instance.destroy(); hls = null; }
      });
    })();

    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [src]);

  if (failed) {
    return (
      <CameraImage id={id} alt={alt} attribution={attribution} license={license} refreshSeconds={refreshSeconds} />
    );
  }
  return (
    <figure style={{ margin: 0 }}>
      <video ref={videoRef} poster={poster} controls autoPlay muted playsInline aria-label={alt} style={{ width: "100%" }} />
      <figcaption><AttributionBadge attribution={attribution} license={license} /></figcaption>
    </figure>
  );
}
```

- [ ] **Step 3: Wire the overlay** — in `components/CameraDetail.tsx`, (a) add `mediaType` to the `CamInfo` type and (b) import + branch on it. Add the import near the top:

```tsx
import { CameraVideo } from "@/components/CameraVideo";
```

Add to the `CamInfo` type:

```tsx
  mediaType: "jpeg" | "video" | "both";
```

Replace the `<CameraImage … />` block (the one rendered when `cam` is truthy) with:

```tsx
        cam.mediaType !== "jpeg" ? (
          <CameraVideo
            id={cam.id} alt={cam.name}
            attribution={cam.attribution} license={cam.license}
            refreshSeconds={cam.refreshSeconds}
          />
        ) : (
          <CameraImage
            id={cam.id} alt={cam.name}
            attribution={cam.attribution} license={cam.license}
            refreshSeconds={cam.refreshSeconds}
          />
        )
```

- [ ] **Step 4: Wire the standalone page** — in `app/camera/[id]/page.tsx`, add the import:

```tsx
import { CameraVideo } from "@/components/CameraVideo";
```

Replace the `<CameraImage … />` element with:

```tsx
      {cam.mediaType !== "jpeg" ? (
        <CameraVideo id={cam.id} alt={cam.name} attribution={cam.attribution} license={cam.license} refreshSeconds={cam.refreshSeconds} />
      ) : (
        <CameraImage id={cam.id} alt={cam.name} attribution={cam.attribution} license={cam.license} refreshSeconds={cam.refreshSeconds} />
      )}
```

- [ ] **Step 5: Write the e2e** — `tests/e2e/us-video.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a US camera detail shows live video (or gracefully falls back to a still)", async ({ page, request }) => {
  const { cameras } = await (await request.get("/api/cameras")).json();
  const us = cameras.find((c: { id: string }) => c.id.startsWith("caltrans:") || c.id.startsWith("scdot:"));
  test.skip(!us, "no US camera available from live sources right now");

  await page.goto(`/camera/${encodeURIComponent(us.id)}`);
  await expect(page.getByTestId("attribution")).toBeVisible();
  // Either a <video> mounts, or (offline stream) the still-image fallback appears.
  const media = page.locator(".camera-detail video, .camera-detail img");
  await expect(media.first()).toBeVisible();
});
```

- [ ] **Step 6: Run the e2e**

Run: `npx playwright test tests/e2e/us-video.spec.ts`
Expected: PASS (video or still visible; or skip if no US camera live).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json components/CameraVideo.tsx components/CameraDetail.tsx "app/camera/[id]/page.tsx" tests/e2e/us-video.spec.ts
git commit -m "feat: live HLS video player (hls.js) with still-image fallback on US camera detail"
```

---

### Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS — all unit tests (existing + caltrans, scdot, registry, allowlist, hls-allowlist, hls-rewrite).

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build completes (hls.js is dynamically imported, so it never evaluates during SSR/build).

- [ ] **Step 3: Run the e2e suite against a dev server**

Run: `npm run e2e`
Expected: PASS/skip — TfL image test, HLS guard test, US-video test (skips only if live US sources are momentarily unavailable).

- [ ] **Step 4: Manual smoke (one CA + one SC camera)**

Start `npm run dev`, open the globe, click a California and a South Carolina camera; confirm live video plays (or the still shows) with attribution. Note any stream that 502s — expected for offline cameras (the fallback covers it).

- [ ] **Step 5: Finish the branch**

Use the `superpowers:finishing-a-development-branch` skill. Push `feat/us-cameras` and open a PR. Target **`feat/p0-skeleton`** (a stacked PR — keeps the diff to just the US work) while PR #1 is open; retarget to `main` once P0 merges. Commits stay solo-attributed; the PR body gets **no** Claude footer.

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Caltrans adapter → Task 1 · SCDOT adapter → Task 2 · registry merge/resilience → Task 3.
- Still-image allowlist (CA+SC hosts) → Task 4 · HLS allowlist + per-host Referer → Task 5 · playlist rewriter → Task 6 · `/api/hls` proxy (Referer/rewrite/segment/Range/SSRF) → Task 7.
- `mediaType` exposed + raw `streamUrl` hidden + `country` in list → Task 8 · hls.js + `CameraVideo` + still-fallback + detail wiring (overlay & standalone) → Task 9.
- Testing matrix (unit normalizers/allowlists/rewriter/merge; e2e guards/US-video) → spread across Tasks 1–9; full verify → Task 10.
- YAGNI items (RTMP/RTSP, DVR, other states, transcoding, globe-marker video, audio) → none implemented; confirmed absent.

**2. Placeholder scan** — no TBD/TODO; every code step contains complete code; every test step contains real assertions; commands have expected output.

**3. Type consistency** — `normalizeCaltrans(records, district)`, `normalizeScdot(geojson)`, `mergeResults(results, staleCache)`, `isHlsAllowed(url) → { ok, referer? }`, `rewritePlaylist(body, upstreamUrl)`, and `CameraVideo({ id, alt, attribution, license, refreshSeconds })` are referenced identically across the tasks that produce and consume them. `mediaType` union (`"jpeg" | "video" | "both"`) matches the `Camera` schema enum. The client uses `/api/hls?id=` (never `streamUrl`), consistent with Task 8 hiding it.
