# TrafficNerd v2 — P0 Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployed Next.js web app whose homepage is a 3D Globe.GL Earth showing live TfL (London) traffic cameras, where clicking a camera opens a live detail view served through a closed image proxy — proving the full v2 pipeline end-to-end with one source.

**Architecture:** A single Next.js 15 (App Router, TypeScript) app. A pure `normalizeTfl` function turns the TfL JamCam feed into the canonical `Camera` shape (validated with zod); an in-memory TTL registry serves it; pure selector functions (`findById`/`nearest`) back the API routes; a closed `/api/proxy` route fetches camera images through a host+path allowlist; a `react-globe.gl` client renders the points and a server-rendered detail page shows the live image with mandatory attribution.

**Tech Stack:** Next.js 15, React 19, TypeScript, `react-globe.gl` (three.js), zod, Vitest (unit, node env), Playwright (e2e). No database in P0 (PostGIS arrives in P1). No API key required (TfL is keyless).

## Global Constraints

_Every task's requirements implicitly include these (copied from `PRD.md`):_

- **Runtime:** Next.js 15 App Router + TypeScript. React 19. Import alias `@/*` → repo root.
- **The image proxy is closed:** `/api/proxy` takes a **camera id, never a raw URL**, and only fetches hosts on the allowlist (host **and** path-prefix). Anything else → HTTP 403. No open relay / SSRF.
- **Attribution is structural:** any component that renders a camera image MUST also render its `attribution` + `license`. TfL's required credit string is exactly **`Powered by TfL Open Data`**.
- **Never poll faster than the source's `refreshSeconds`** (TfL = 300s). Proxy responses set `Cache-Control` accordingly.
- **No face/plate recognition. Ever.** Not in P0, not later.
- **Hard-excluded sources** (never added): France, Netherlands, Japan, National Highways England, and all Insecam-class/unsecured-camera sources.
- **Commit after every passing step.** DRY, YAGNI, TDD.
- Canonical `Camera`/`Source` shapes are defined in `PRD.md` §6 and crystallized in Task 2.

## Scope of THIS plan

P0 only: **TfL-only, in-memory registry, deployed.** Out of scope here (later phases): PostGIS, Vercel Cron, other sources, the `ibi511`/`arcgisHub` families, congestion sampling, Situation Room, watch/compare, hls.js streams. Do not build them in P0.

---

## File Structure

```
TrafficNerd-V2/
├── package.json                         # Task 1 — deps + scripts
├── tsconfig.json                        # Task 1
├── next.config.ts                       # Task 1
├── vitest.config.ts                     # Task 1
├── playwright.config.ts                 # Task 1
├── .gitignore                           # Task 1
├── app/
│   ├── layout.tsx                       # Task 8 — root layout
│   ├── globals.css                      # Task 8 — minimal dark styles
│   ├── page.tsx                         # Task 8 — globe homepage (client)
│   ├── camera/[id]/page.tsx             # Task 9 — camera detail (server)
│   └── api/
│       ├── cameras/route.ts             # Task 6 — slim point list for the globe
│       ├── camera/[id]/route.ts         # Task 6 — full camera + nearby (JSON)
│       └── proxy/route.ts               # Task 7 — closed image proxy
├── lib/
│   ├── types.ts                         # Task 2 — zod schemas + Camera/Source types
│   ├── geo/haversine.ts                 # Task 3 — distance
│   ├── sources/
│   │   ├── tfl.ts                        # Task 4 — normalizeTfl + fetchRegistry
│   │   ├── select.ts                     # Task 5 — pure findById/nearest/search
│   │   └── registry.ts                   # Task 5 — in-memory TTL cache + wrappers
│   └── proxy/allowlist.ts               # Task 7 — host+path allowlist
├── components/
│   ├── GlobeView.tsx                    # Task 8 — react-globe.gl client
│   ├── CameraImage.tsx                  # Task 9 — auto-refresh img via proxy
│   └── AttributionBadge.tsx             # Task 9 — credit + license
├── tests/
│   ├── fixtures/tfl-place.json          # Task 4 — captured real TfL response (3 places)
│   ├── unit/
│   │   ├── haversine.test.ts            # Task 3
│   │   ├── tfl.test.ts                  # Task 4
│   │   ├── select.test.ts               # Task 5
│   │   └── allowlist.test.ts            # Task 7
│   └── e2e/
│       ├── globe.spec.ts                # Task 8
│       └── camera.spec.ts               # Task 10
├── .env.example                         # Task 11
└── README.md                            # Task 11
```

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`
- Test: `tests/unit/smoke.test.ts` (temporary)

**Interfaces:**
- Consumes: nothing.
- Produces: working `npm run dev`, `npm test` (Vitest), `npm run e2e` (Playwright), `npm run build`. Import alias `@/*`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "trafficnerd-v2",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "15.3.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-globe.gl": "2.33.0",
    "three": "0.169.0",
    "zod": "3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "1.49.1",
    "@types/node": "22.10.5",
    "@types/react": "19.0.4",
    "@types/react-dom": "19.0.2",
    "@types/three": "0.169.0",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests/e2e"]
}
```

- [ ] **Step 3: Create `next.config.ts`, `.gitignore`, and test configs**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`.gitignore`:
```
node_modules/
.next/
out/
.env
.env*.local
playwright-report/
test-results/
*.tsbuildinfo
next-env.d.ts
```

`vitest.config.ts` (unit tests only, node env, alias):
```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
```

`playwright.config.ts` (builds + starts the app for e2e):
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Install deps and add a temporary smoke test**

Run: `npm install`
Expected: completes; `node_modules/` present.

Create `tests/unit/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("toolchain runs", () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 5: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts playwright.config.ts .gitignore tests/unit/smoke.test.ts
git commit -m "chore: scaffold Next.js 15 + Vitest + Playwright toolchain"
```

---

### Task 2: Canonical types & zod schemas

**Files:**
- Create: `lib/types.ts`
- Test: (covered by Task 4's adapter test — `CameraArray.parse` is exercised there)

**Interfaces:**
- Consumes: `zod`.
- Produces:
  - `CameraSchema` (zod object) and `type Camera = z.infer<typeof CameraSchema>`
  - `CameraArray` = `z.array(CameraSchema)`
  - `type Source = { id: string; name: string; license: string; attribution: string; refreshSeconds: number; needsKey: boolean }`

- [ ] **Step 1: Write `lib/types.ts`**

```ts
import { z } from "zod";

export const CameraSchema = z.object({
  id: z.string(),                       // `${source}:${nativeId}`
  source: z.string(),
  country: z.string().length(2),        // ISO-3166 alpha-2
  region: z.string().optional(),
  name: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  road: z.string().optional(),
  direction: z.string().optional(),
  imageUrl: z.string().url().optional(),
  streamUrl: z.string().url().optional(),
  mediaType: z.enum(["jpeg", "video", "both"]),
  refreshSeconds: z.number().positive(),
  license: z.string().min(1),
  attribution: z.string().min(1),
  available: z.boolean(),
  lastSampledAt: z.string().optional(),
});

export type Camera = z.infer<typeof CameraSchema>;
export const CameraArray = z.array(CameraSchema);

export type Source = {
  id: string;
  name: string;
  license: string;
  attribution: string;
  refreshSeconds: number;
  needsKey: boolean;
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: canonical Camera/Source zod schema + types"
```

---

### Task 3: Haversine geo utility

**Files:**
- Create: `lib/geo/haversine.ts`
- Test: `tests/unit/haversine.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number`

- [ ] **Step 1: Write the failing test** — `tests/unit/haversine.test.ts`

```ts
import { expect, test } from "vitest";
import { haversineKm } from "@/lib/geo/haversine";

test("zero distance for identical points", () => {
  expect(haversineKm(51.5, -0.1, 51.5, -0.1)).toBeCloseTo(0, 5);
});

test("one degree of longitude at the equator is ~111.19 km", () => {
  expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
});

test("London Eye to Tower Bridge is ~3.4 km", () => {
  // London Eye (51.5033,-0.1196) → Tower Bridge (51.5055,-0.0754)
  expect(haversineKm(51.5033, -0.1196, 51.5055, -0.0754)).toBeCloseTo(3.07, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/haversine.test.ts`
Expected: FAIL — cannot resolve `@/lib/geo/haversine`.

- [ ] **Step 3: Write `lib/geo/haversine.ts`**

```ts
const R_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/haversine.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/geo/haversine.ts tests/unit/haversine.test.ts
git commit -m "feat: haversine distance util + tests"
```

---

### Task 4: TfL source adapter

**Files:**
- Create: `lib/sources/tfl.ts`, `tests/fixtures/tfl-place.json`
- Test: `tests/unit/tfl.test.ts`

**Interfaces:**
- Consumes: `Camera`, `CameraArray` (Task 2).
- Produces:
  - `normalizeTfl(places: TflPlace[]): Camera[]` — pure
  - `fetchRegistry(): Promise<Camera[]>` — does network IO, validates with `CameraArray`
  - `TFL_SOURCE: Source`
  - exported `type TflPlace`

- [ ] **Step 1: Create the fixture** — `tests/fixtures/tfl-place.json`

> A trimmed but real-shaped TfL `/Place/Type/JamCam` response (3 places; one unavailable; one with a videoUrl). Capture live later for more coverage, but this is sufficient for the normalizer contract.

```json
[
  {
    "id": "JamCams_00001.07450",
    "commonName": "A40 Westway/Woodger Rd",
    "placeType": "JamCam",
    "lat": 51.5174,
    "lon": -0.2126,
    "additionalProperties": [
      { "key": "available", "value": "true" },
      { "key": "imageUrl", "value": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.jpg" },
      { "key": "videoUrl", "value": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.mp4" },
      { "key": "view", "value": "Looking west" }
    ]
  },
  {
    "id": "JamCams_00001.01251",
    "commonName": "Tower Bridge Rd",
    "placeType": "JamCam",
    "lat": 51.5055,
    "lon": -0.0754,
    "additionalProperties": [
      { "key": "available", "value": "true" },
      { "key": "imageUrl", "value": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.jpg" }
    ]
  },
  {
    "id": "JamCams_00002.99999",
    "commonName": "Camera Offline Test",
    "placeType": "JamCam",
    "lat": 51.5033,
    "lon": -0.1196,
    "additionalProperties": [
      { "key": "available", "value": "false" },
      { "key": "imageUrl", "value": "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00002.99999.jpg" }
    ]
  }
]
```

- [ ] **Step 2: Write the failing test** — `tests/unit/tfl.test.ts`

```ts
import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/tfl-place.json";
import { normalizeTfl } from "@/lib/sources/tfl";
import { CameraArray } from "@/lib/types";

test("normalizes TfL places into valid Cameras", () => {
  const cams = normalizeTfl(fixture as any);
  expect(() => CameraArray.parse(cams)).not.toThrow();
  expect(cams).toHaveLength(3);
});

test("maps id, coords, attribution and availability", () => {
  const [first, , offline] = normalizeTfl(fixture as any);
  expect(first.id).toBe("tfl:JamCams_00001.07450");
  expect(first.source).toBe("tfl");
  expect(first.country).toBe("GB");
  expect(first.name).toBe("A40 Westway/Woodger Rd");
  expect(first.imageUrl).toContain("00001.07450.jpg");
  expect(first.mediaType).toBe("both"); // has videoUrl
  expect(first.attribution).toBe("Powered by TfL Open Data");
  expect(first.refreshSeconds).toBe(300);
  expect(offline.available).toBe(false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/tfl.test.ts`
Expected: FAIL — cannot resolve `@/lib/sources/tfl`.

- [ ] **Step 4: Write `lib/sources/tfl.ts`**

```ts
import { Camera, CameraArray, Source } from "@/lib/types";

export const TFL_SOURCE: Source = {
  id: "tfl",
  name: "TfL JamCams",
  license: "OGL",
  attribution: "Powered by TfL Open Data",
  refreshSeconds: 300,
  needsKey: false,
};

interface TflProp { key: string; value: string }
export interface TflPlace {
  id: string;
  commonName: string;
  lat: number;
  lon: number;
  additionalProperties: TflProp[];
}

export function normalizeTfl(places: TflPlace[]): Camera[] {
  return places.map((p): Camera => {
    const props: Record<string, string> = {};
    for (const a of p.additionalProperties) props[a.key] = a.value;
    const hasVideo = Boolean(props.videoUrl);
    return {
      id: `tfl:${p.id}`,
      source: "tfl",
      country: "GB",
      region: "London",
      name: p.commonName,
      lat: p.lat,
      lon: p.lon,
      imageUrl: props.imageUrl,
      streamUrl: props.videoUrl,
      mediaType: hasVideo ? "both" : "jpeg",
      refreshSeconds: TFL_SOURCE.refreshSeconds,
      license: TFL_SOURCE.license,
      attribution: TFL_SOURCE.attribution,
      available: props.available === "true",
    };
  });
}

export async function fetchRegistry(): Promise<Camera[]> {
  const res = await fetch("https://api.tfl.gov.uk/Place/Type/JamCam", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TfL JamCam fetch failed: ${res.status}`);
  const places = (await res.json()) as TflPlace[];
  return CameraArray.parse(normalizeTfl(places));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/tfl.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/sources/tfl.ts tests/fixtures/tfl-place.json tests/unit/tfl.test.ts
git commit -m "feat: TfL adapter (normalizeTfl + fetchRegistry) with fixture test"
```

---

### Task 5: Registry — pure selectors + in-memory cache

**Files:**
- Create: `lib/sources/select.ts`, `lib/sources/registry.ts`
- Test: `tests/unit/select.test.ts`

**Interfaces:**
- Consumes: `Camera` (Task 2), `haversineKm` (Task 3), `fetchRegistry` (Task 4).
- Produces:
  - `findById(cams: Camera[], id: string): Camera | null`
  - `nearest(cams: Camera[], lat: number, lon: number, limit: number): { camera: Camera; km: number }[]`
  - `search(cams: Camera[], q: string): Camera[]`
  - `getRegistry(): Promise<Camera[]>` (5-min TTL cache)
  - `getCameraById(id: string): Promise<Camera | null>`
  - `nearestTo(lat: number, lon: number, limit?: number): Promise<{ camera: Camera; km: number }[]>`

- [ ] **Step 1: Write the failing test** — `tests/unit/select.test.ts`

```ts
import { expect, test } from "vitest";
import { findById, nearest, search } from "@/lib/sources/select";
import type { Camera } from "@/lib/types";

const base = {
  source: "tfl", country: "GB", mediaType: "jpeg" as const,
  refreshSeconds: 300, license: "OGL", attribution: "Powered by TfL Open Data",
  available: true,
};
const cams: Camera[] = [
  { ...base, id: "tfl:a", name: "Westway", lat: 51.5174, lon: -0.2126 },
  { ...base, id: "tfl:b", name: "Tower Bridge Rd", lat: 51.5055, lon: -0.0754 },
  { ...base, id: "tfl:c", name: "London Eye", lat: 51.5033, lon: -0.1196 },
];

test("findById returns the match or null", () => {
  expect(findById(cams, "tfl:b")?.name).toBe("Tower Bridge Rd");
  expect(findById(cams, "tfl:zzz")).toBeNull();
});

test("nearest sorts by distance and respects limit", () => {
  const out = nearest(cams, 51.5033, -0.1196, 2); // at London Eye
  expect(out).toHaveLength(2);
  expect(out[0].camera.id).toBe("tfl:c"); // itself, 0 km
  expect(out[0].km).toBeCloseTo(0, 3);
  expect(out[1].km).toBeLessThanOrEqual(nearest(cams, 51.5033, -0.1196, 3)[2].km);
});

test("search is case-insensitive substring on name", () => {
  expect(search(cams, "bridge").map((c) => c.id)).toEqual(["tfl:b"]);
  expect(search(cams, "")).toHaveLength(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/select.test.ts`
Expected: FAIL — cannot resolve `@/lib/sources/select`.

- [ ] **Step 3: Write `lib/sources/select.ts`**

```ts
import type { Camera } from "@/lib/types";
import { haversineKm } from "@/lib/geo/haversine";

export function findById(cams: Camera[], id: string): Camera | null {
  return cams.find((c) => c.id === id) ?? null;
}

export function nearest(
  cams: Camera[], lat: number, lon: number, limit: number,
): { camera: Camera; km: number }[] {
  return cams
    .map((camera) => ({ camera, km: haversineKm(lat, lon, camera.lat, camera.lon) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export function search(cams: Camera[], q: string): Camera[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return cams;
  return cams.filter((c) => c.name.toLowerCase().includes(needle));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/select.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `lib/sources/registry.ts`** (cache wrapper — no separate unit test; exercised by API e2e)

```ts
import type { Camera } from "@/lib/types";
import { fetchRegistry } from "@/lib/sources/tfl";
import { findById, nearest } from "@/lib/sources/select";

const TTL_MS = 5 * 60 * 1000;
let cache: { cameras: Camera[]; at: number } | null = null;

export async function getRegistry(): Promise<Camera[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cameras;
  const cameras = await fetchRegistry();
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

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add lib/sources/select.ts lib/sources/registry.ts tests/unit/select.test.ts
git commit -m "feat: registry selectors (findById/nearest/search) + TTL cache"
```

---

### Task 6: Camera API routes

**Files:**
- Create: `app/api/cameras/route.ts`, `app/api/camera/[id]/route.ts`
- Test: covered by Task 8 (globe) and Task 10 (camera) e2e specs

**Interfaces:**
- Consumes: `getRegistry`, `getCameraById`, `nearestTo` (Task 5).
- Produces (HTTP contracts later tasks depend on):
  - `GET /api/cameras` → `{ count: number, cameras: { id, name, lat, lon, available }[] }`
  - `GET /api/camera/:id` → `{ camera: Camera, nearby: { id, name, km }[] }` or 404

- [ ] **Step 1: Write `app/api/cameras/route.ts`**

```ts
import { getRegistry } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const cams = await getRegistry();
  const cameras = cams.map((c) => ({
    id: c.id, name: c.name, lat: c.lat, lon: c.lon, available: c.available,
  }));
  return Response.json({ count: cameras.length, cameras });
}
```

- [ ] **Step 2: Write `app/api/camera/[id]/route.ts`**

```ts
import { getCameraById, nearestTo } from "@/lib/sources/registry";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const camera = await getCameraById(decodeURIComponent(id));
  if (!camera) return new Response("camera not found", { status: 404 });
  const nearby = (await nearestTo(camera.lat, camera.lon, 8))
    .filter((n) => n.camera.id !== camera.id)
    .slice(0, 6)
    .map((n) => ({ id: n.camera.id, name: n.camera.name, km: Number(n.km.toFixed(2)) }));
  return Response.json({ camera, nearby });
}
```

- [ ] **Step 3: Manually verify against live TfL**

Run: `npm run dev` then in a second shell `curl -s localhost:3000/api/cameras | head -c 300`
Expected: JSON with `"count"` > 800 and a `cameras` array. Stop dev server after.

- [ ] **Step 4: Commit**

```bash
git add app/api/cameras/route.ts app/api/camera/[id]/route.ts
git commit -m "feat: /api/cameras (slim list) + /api/camera/[id] (detail+nearby)"
```

---

### Task 7: Closed image proxy

**Files:**
- Create: `lib/proxy/allowlist.ts`, `app/api/proxy/route.ts`
- Test: `tests/unit/allowlist.test.ts`

**Interfaces:**
- Consumes: `getCameraById` (Task 5).
- Produces:
  - `isAllowed(url: URL): boolean` — host + path-prefix allowlist
  - `GET /api/proxy?id=<cameraId>` → image bytes (200) | 400 (no id) | 403 (forbidden host) | 404 (unknown camera / no image) | 502 (upstream)

- [ ] **Step 1: Write the failing test** — `tests/unit/allowlist.test.ts`

```ts
import { expect, test } from "vitest";
import { isAllowed } from "@/lib/proxy/allowlist";

test("allows the TfL JamCam S3 bucket path", () => {
  expect(isAllowed(new URL("https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.jpg"))).toBe(true);
});

test("rejects a different S3 bucket on the same host", () => {
  expect(isAllowed(new URL("https://s3-eu-west-1.amazonaws.com/some-other-bucket/secret.jpg"))).toBe(false);
});

test("rejects arbitrary hosts (SSRF guard)", () => {
  expect(isAllowed(new URL("http://169.254.169.254/latest/meta-data/"))).toBe(false);
  expect(isAllowed(new URL("https://evil.example.com/x.jpg"))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/allowlist.test.ts`
Expected: FAIL — cannot resolve `@/lib/proxy/allowlist`.

- [ ] **Step 3: Write `lib/proxy/allowlist.ts`**

```ts
// Each rule is host + required path prefix. Adding a source = adding a rule.
const RULES: { host: string; prefix: string }[] = [
  { host: "s3-eu-west-1.amazonaws.com", prefix: "/jamcams.tfl.gov.uk/" },
];

export function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return RULES.some((r) => url.hostname === r.host && url.pathname.startsWith(r.prefix));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/allowlist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `app/api/proxy/route.ts`**

```ts
import type { NextRequest } from "next/server";
import { getCameraById } from "@/lib/sources/registry";
import { isAllowed } from "@/lib/proxy/allowlist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });

  const cam = await getCameraById(id);
  if (!cam?.imageUrl) return new Response("camera or image not found", { status: 404 });

  let target: URL;
  try { target = new URL(cam.imageUrl); } catch { return new Response("bad image url", { status: 500 }); }
  if (!isAllowed(target)) return new Response("forbidden host", { status: 403 });

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "TrafficNerd/2.0 (+https://github.com/011-sam-110/TrafficNerd-V2)" },
    cache: "no-store",
  });
  if (!upstream.ok) return new Response("upstream error", { status: 502 });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // Never serve a camera faster than the source refresh (TfL = 300s).
      "Cache-Control": `public, max-age=${cam.refreshSeconds}, s-maxage=${cam.refreshSeconds}`,
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/proxy/allowlist.ts app/api/proxy/route.ts tests/unit/allowlist.test.ts
git commit -m "feat: closed image proxy with host+path allowlist (SSRF-safe)"
```

---

### Task 8: Globe homepage

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `components/GlobeView.tsx`
- Test: `tests/e2e/globe.spec.ts`

**Interfaces:**
- Consumes: `GET /api/cameras` (Task 6).
- Produces: homepage at `/` rendering a globe `<canvas>` + a `data-testid="stat-line"` element showing the camera count.

- [ ] **Step 1: Write the e2e test (will fail until the page exists)** — `tests/e2e/globe.spec.ts`

```ts
import { expect, test } from "@playwright/test";

test("homepage renders the globe and a non-zero camera count", async ({ page }) => {
  await page.goto("/");
  // Globe.GL renders into a <canvas>
  await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });
  const stat = page.getByTestId("stat-line");
  await expect(stat).toContainText(/cameras/i, { timeout: 30_000 });
  await expect(stat).not.toContainText("0 cameras");
});
```

- [ ] **Step 2: Write `app/layout.tsx` and `app/globals.css`**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrafficNerd — live traffic cameras of the world",
  description: "A live 3D globe of the world's open traffic cameras.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/globals.css`:
```css
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #05070d; color: #e2e8f0;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
a { color: #22d3ee; }
.stat-line { position: fixed; top: 16px; left: 16px; z-index: 10;
  font-size: 14px; letter-spacing: 0.02em; opacity: 0.9; }
main.globe { width: 100vw; height: 100vh; overflow: hidden; }
.camera-detail { max-width: 760px; margin: 0 auto; padding: 24px; }
.camera-detail img { width: 100%; border-radius: 8px; background: #0b1220; }
.attribution { font-size: 12px; opacity: 0.7; }
```

- [ ] **Step 3: Write `components/GlobeView.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Globe from "react-globe.gl";
import { useRouter } from "next/navigation";

type Pt = { id: string; name: string; lat: number; lon: number; available: boolean };

export default function GlobeView() {
  const [pts, setPts] = useState<Pt[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => r.json())
      .then((d) => setPts(d.cameras as Pt[]))
      .catch(() => setPts([]));
  }, []);

  return (
    <>
      <div className="stat-line" data-testid="stat-line">
        {pts.length.toLocaleString()} cameras · 1 source · London live
      </div>
      <Globe
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="#05070d"
        pointsData={pts}
        pointLat="lat"
        pointLng="lon"
        pointColor={(p) => ((p as Pt).available ? "#22d3ee" : "#475569")}
        pointAltitude={0.005}
        pointRadius={0.12}
        pointLabel={(p) => (p as Pt).name}
        onPointClick={(p) =>
          router.push(`/camera/${encodeURIComponent((p as Pt).id)}`)
        }
      />
    </>
  );
}
```

- [ ] **Step 4: Write `app/page.tsx`** (client wrapper so `react-globe.gl` is loaded SSR-free)

```tsx
"use client";
import dynamic from "next/dynamic";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });

export default function Home() {
  return (
    <main className="globe">
      <GlobeView />
    </main>
  );
}
```

- [ ] **Step 5: Run the e2e test**

Run: `npm run e2e -- tests/e2e/globe.spec.ts`
Expected: PASS — canvas visible and stat line shows a non-zero `N cameras`.

> If Playwright browsers aren't installed yet: `npx playwright install --with-deps chromium` then re-run.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css app/page.tsx components/GlobeView.tsx tests/e2e/globe.spec.ts
git commit -m "feat: Globe.GL homepage rendering TfL camera points"
```

---

### Task 9: Camera detail page + attribution

**Files:**
- Create: `components/AttributionBadge.tsx`, `components/CameraImage.tsx`, `app/camera/[id]/page.tsx`
- Test: covered by Task 10 e2e

**Interfaces:**
- Consumes: `getCameraById`, `nearestTo` (Task 5); `GET /api/proxy?id=` (Task 7).
- Produces: route `/camera/[id]` rendering the live image, metadata, nearby links, and a visible attribution badge.

- [ ] **Step 1: Write `components/AttributionBadge.tsx`**

```tsx
export function AttributionBadge({ attribution, license }: { attribution: string; license: string }) {
  return (
    <span className="attribution" data-testid="attribution">
      {attribution} · {license}
    </span>
  );
}
```

- [ ] **Step 2: Write `components/CameraImage.tsx`** (auto-refresh; attribution is non-optional by type)

```tsx
"use client";
import { useEffect, useState } from "react";
import { AttributionBadge } from "@/components/AttributionBadge";

export function CameraImage(props: {
  id: string; alt: string; attribution: string; license: string; refreshSeconds: number;
}) {
  const { id, alt, attribution, license, refreshSeconds } = props;
  const [bust, setBust] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBust((b) => b + 1), refreshSeconds * 1000);
    return () => clearInterval(t);
  }, [refreshSeconds]);

  return (
    <figure style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/proxy?id=${encodeURIComponent(id)}&_=${bust}`} alt={alt} />
      <figcaption><AttributionBadge attribution={attribution} license={license} /></figcaption>
    </figure>
  );
}
```

- [ ] **Step 3: Write `app/camera/[id]/page.tsx`** (server component reads the registry directly)

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCameraById, nearestTo } from "@/lib/sources/registry";
import { CameraImage } from "@/components/CameraImage";

export const dynamic = "force-dynamic";

export default async function CameraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cam = await getCameraById(decodeURIComponent(id));
  if (!cam) notFound();

  const nearby = (await nearestTo(cam.lat, cam.lon, 8))
    .filter((n) => n.camera.id !== cam.id)
    .slice(0, 6);

  return (
    <main className="camera-detail">
      <p><Link href="/">← Globe</Link></p>
      <h1>{cam.name}</h1>
      <CameraImage
        id={cam.id} alt={cam.name}
        attribution={cam.attribution} license={cam.license}
        refreshSeconds={cam.refreshSeconds}
      />
      <dl>
        <dt>Source</dt><dd>{cam.source}</dd>
        <dt>Location</dt><dd>{cam.region}, {cam.country}</dd>
        <dt>Coordinates</dt><dd>{cam.lat.toFixed(4)}, {cam.lon.toFixed(4)}</dd>
        <dt>Status</dt><dd>{cam.available ? "available" : "unavailable"}</dd>
        <dt>Refresh</dt><dd>every {cam.refreshSeconds}s</dd>
      </dl>
      <section>
        <h2>Nearby cameras</h2>
        <ul>
          {nearby.map((n) => (
            <li key={n.camera.id}>
              <Link href={`/camera/${encodeURIComponent(n.camera.id)}`}>
                {n.camera.name} · {n.km.toFixed(2)} km
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add components/AttributionBadge.tsx components/CameraImage.tsx app/camera/[id]/page.tsx
git commit -m "feat: camera detail page with proxied live image + mandatory attribution"
```

---

### Task 10: End-to-end click-through

**Files:**
- Create: `tests/e2e/camera.spec.ts`

**Interfaces:**
- Consumes: `GET /api/cameras` (to pick a real id), `/camera/[id]`, `/api/proxy`.
- Produces: a passing e2e proving the full pipeline (list → detail → proxied image → attribution).

- [ ] **Step 1: Write the e2e test** — `tests/e2e/camera.spec.ts`

```ts
import { expect, test } from "@playwright/test";

test("a camera detail page shows a proxied image and TfL attribution", async ({ page, request }) => {
  const res = await request.get("/api/cameras");
  expect(res.ok()).toBeTruthy();
  const { cameras } = await res.json();
  expect(cameras.length).toBeGreaterThan(0);
  const id: string = cameras[0].id;

  await page.goto(`/camera/${encodeURIComponent(id)}`);
  await expect(page.getByTestId("attribution")).toContainText("Powered by TfL Open Data");

  const img = page.locator(".camera-detail img");
  await expect(img).toBeVisible();
  // The proxy actually serves image bytes:
  const proxyRes = await request.get(`/api/proxy?id=${encodeURIComponent(id)}`);
  expect(proxyRes.ok()).toBeTruthy();
  expect(proxyRes.headers()["content-type"]).toContain("image");
});

test("the proxy rejects a request with no id", async ({ request }) => {
  const res = await request.get("/api/proxy");
  expect(res.status()).toBe(400);
});
```

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run e2e`
Expected: PASS — both `globe.spec.ts` and `camera.spec.ts` green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/camera.spec.ts
git commit -m "test: e2e click-through globe → camera → proxied image + attribution"
```

---

### Task 11: Docs, env, and final verification

**Files:**
- Create: `.env.example`, `README.md`
- Modify: none

**Interfaces:**
- Consumes: everything above.
- Produces: a runnable, documented repo ready to deploy.

- [ ] **Step 1: Write `.env.example`**

```bash
# TfL JamCams need NO key (keyless). These are OPTIONAL and only raise shared rate limits.
# Register at https://api-portal.tfl.gov.uk/ if you hit throttling.
# TFL_APP_KEY=
```

- [ ] **Step 2: Write `README.md`**

```markdown
# TrafficNerd v2 — P0

A live 3D globe of the world's open traffic cameras. **P0** ships the pipeline end-to-end with one source (TfL / London).

> Successor to [TrafficNerd v1](https://github.com/011-sam-110/TrafficNerd) (a terminal app). See [`PRD.md`](./PRD.md) for the full design.

## Stack
Next.js 15 (App Router, TS) · react-globe.gl (three.js) · zod · Vitest · Playwright. No database in P0.

## Run
```bash
npm install
npm run dev          # http://localhost:3000
```

## Test
```bash
npm test             # unit (Vitest)
npm run e2e          # end-to-end (Playwright; first run: npx playwright install chromium)
```

## How it works
`lib/sources/tfl.ts` normalizes the keyless TfL JamCam feed into a canonical `Camera`; an in-memory TTL registry serves `/api/cameras`; the globe (`components/GlobeView.tsx`) plots them; clicking opens `/camera/[id]`, whose live image is served through the **closed** `/api/proxy` (host+path allowlist, never polled faster than the source refresh). Every image shows its required attribution — *Powered by TfL Open Data*.

## Data & licensing
TfL JamCams via the TfL Open Data API — credited *Powered by TfL Open Data*. Later phases add more open government feeds (see `PRD.md` §7). This project only uses feeds published for public reuse and never runs face/plate recognition.
```

- [ ] **Step 3: Full local verification (all green before deploy)**

Run: `npm test`
Expected: PASS — haversine, tfl, select, allowlist (11 tests total).

Run: `npm run build`
Expected: build succeeds, no type errors.

Run: `npm run e2e`
Expected: PASS — globe + camera specs.

- [ ] **Step 4: Commit and push**

```bash
git add .env.example README.md
git commit -m "docs: README + .env.example for P0"
git push
```

- [ ] **Step 5: Deploy to Vercel** *(interactive — run from the repo root)*

> In this Claude Code session you can run the login/deploy via the `!` prefix, or do it in your own terminal.

```bash
npx vercel link      # link to a new Vercel project (accept defaults; framework auto-detected as Next.js)
npx vercel --prod    # build + deploy
```
Expected: a live `https://<project>.vercel.app` URL. Open it: the globe loads, London lights up, clicking a camera shows a live image with attribution.

- [ ] **Step 6: Record the live URL**

Add the deployed URL to the top of `README.md` (a `> **Live:** https://…` line), commit, and push.

```bash
git add README.md
git commit -m "docs: add live deployment URL"
git push
```

---

## Self-Review (run against `PRD.md`)

**1. Spec coverage (P0 scope only):**
- Globe homepage (PRD §8) → Task 8 ✓
- `SourceAdapter → Camera` normalization (PRD §6) → Tasks 2, 4 ✓ (single-source form; the `SourceAdapter` interface generalizes in P1)
- Closed image proxy + allowlist + cache-at-refresh (PRD §9) → Task 7 ✓
- Camera detail + nearby (PRD §8) → Tasks 5, 9 ✓
- Structural attribution (PRD §10) → Tasks 4, 9 (TS-required prop + visible badge + e2e assert) ✓
- Fixture-based adapter test + deterministic CI (PRD §12) → Task 4 ✓
- Geo tests ported from v1 (PRD §12) → Task 3 ✓
- Deployed (PRD §13) → Task 11 ✓
- _Deferred by design (not P0):_ PostGIS, Vercel Cron, multi-source/families, congestion, Situation Room, watch/compare, hls.js — these are P1–P4 and correctly absent here.

**2. Placeholder scan:** No "TBD/TODO/handle edge cases"; every code step has complete code; every test step has real assertions and an exact run command. ✓

**3. Type consistency:** `Camera` (Task 2) is the return type of `normalizeTfl`/`fetchRegistry` (Task 4), consumed by `findById`/`nearest` (Task 5), `getCameraById`/`nearestTo` (Task 5) used by routes (6), proxy (7), and the detail page (9). `nearest`/`nearestTo` return `{ camera, km }` consistently (Task 5 test, Task 6 route, Task 9 page all use `.camera`). `isAllowed(url: URL)` signature matches between Task 7 test and impl. Proxy contract (`?id=`) matches GlobeView/CameraImage/e2e. ✓

**No gaps found.**
