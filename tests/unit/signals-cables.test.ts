import { expect, test } from "vitest";
import geoFixture from "@/tests/fixtures/cables-geo.json";
import detailFixture from "@/tests/fixtures/cable-detail.json";
import landingFixture from "@/tests/fixtures/cable-landings-geo.json";
import {
  mergeCableSegments,
  normalizeCables,
  parseCableDetail,
  parseLengthKm,
  repairEncoding,
  buildCableFeature,
  indexLandingGeo,
  buildLandingFeatures,
  CABLES_COLOR,
  type RawCableDetail,
} from "@/lib/signals/cables";

// ── Geometry merge (one asset row per CABLE, not per segment) ────────────────

test("merges segments sharing a cable id into one MultiLineString + anchor", () => {
  const bases = mergeCableSegments(geoFixture as never);
  // 4 features in: 2 bernacchi-1 segments + 1 kunoa-north + 1 Point → 2 cables.
  expect(bases.size).toBe(2);
  const b = bases.get("bernacchi-1")!;
  expect(b.geometry.type).toBe("MultiLineString");
  // Both bernacchi-1 segments (1 line each) are merged into the one cable.
  expect((b.geometry.coordinates as unknown[]).length).toBe(2);
  // Anchor comes from the FIRST segment's precomputed representative point.
  expect(b.anchor[0]).toBeCloseTo(146.6387, 3);
  expect(b.anchor[1]).toBeCloseTo(-40.3205, 3);
  expect(bases.has("bogus")).toBe(false); // the Point feature is skipped
});

test("normalizeCables emits one geometry-bearing feature per cable (no metadata)", () => {
  const out = normalizeCables(geoFixture as never);
  expect(out).toHaveLength(2);
  expect(out.every((f) => f.signalId === "cables")).toBe(true);
  const a = out.find((f) => f.id === "cable:bernacchi-1")!;
  expect(a.title).toBe("Bernacchi-1");
  expect(a.color).toBe(CABLES_COLOR);
  expect(a.geometry?.type).toBe("MultiLineString");
  // Dormant fallback: attributes are honestly blank when unenriched.
  expect(a.props?.status).toBe("—");
  expect(a.props?.assetKind).toBe("cable");
});

// ── Length + encoding helpers ────────────────────────────────────────────────

test("parseLengthKm strips commas/units, rejects junk", () => {
  expect(parseLengthKm("6,605 km")).toBe(6605);
  expect(parseLengthKm("~7,191 km")).toBe(7191);
  expect(parseLengthKm("n.a.")).toBeNull();
  expect(parseLengthKm(null)).toBeNull();
  expect(parseLengthKm(undefined)).toBeNull();
});

test("repairEncoding fixes double-encoded UTF-8 but leaves clean text untouched", () => {
  // "Côte" mis-decoded (latin1→utf8) becomes "CÃ´te"; repair restores it.
  expect(repairEncoding("CÃ´te d'Ivoire")).toBe("Côte d'Ivoire");
  expect(repairEncoding("Côte d'Ivoire")).toBe("Côte d'Ivoire"); // no-op on clean data
  expect(repairEncoding("Bilbao, Spain")).toBe("Bilbao, Spain");
});

// ── Per-cable metadata parse (real fixtures) ─────────────────────────────────

test("parseCableDetail maps MAREA to real asset attributes + Transatlantic region", () => {
  const marea = (detailFixture as RawCableDetail[]).find((c) => c.id === "marea")!;
  const meta = parseCableDetail(marea);
  expect(meta.name).toBe("MAREA");
  expect(meta.lengthKm).toBe(6605);
  expect(meta.owners).toBe("Meta, Microsoft, Telxius");
  expect(meta.suppliers).toBe("SubCom");
  expect(meta.rfsYear).toBe(2018);
  expect(meta.status).toBe("Operational");
  expect(meta.landingCountries).toEqual(["Spain", "United States"]);
  expect(meta.region).toBe("Transatlantic"); // Americas + Europe
});

test("parseCableDetail derives Planned from is_planned / future RFS", () => {
  const planned = (detailFixture as RawCableDetail[]).find((c) => c.is_planned === true)!;
  const meta = parseCableDetail(planned);
  expect(meta.status).toBe("Planned");
});

test("parseCableDetail classifies a Europe–Africa cable + keeps clean unicode", () => {
  const twoaf = (detailFixture as RawCableDetail[]).find((c) => c.id === "2africa")!;
  const meta = parseCableDetail(twoaf);
  // Trimmed landings: Angola (AF) + Côte d'Ivoire (AF) + France (EU).
  expect(meta.landingCountries).toContain("Côte d'Ivoire");
  expect(meta.region).toBe("Europe–Africa");
});

test("buildCableFeature never fabricates a design capacity", () => {
  const marea = (detailFixture as RawCableDetail[]).find((c) => c.id === "marea")!;
  const meta = parseCableDetail(marea);
  const base = mergeCableSegments(geoFixture as never).get("bernacchi-1")!;
  const feat = buildCableFeature(base, meta);
  expect(feat.props?.capacity).toBe("—"); // honest: not published, never invented
  expect(feat.props?.owners).toBe("Meta, Microsoft, Telxius");
  expect(feat.props?.region).toBe("Transatlantic");
  expect(feat.geometry?.type).toBe("MultiLineString");
});

// ── Landing-station nodes ────────────────────────────────────────────────────

test("buildLandingFeatures emits only referenced landings with coords, listing cables", () => {
  const geo = indexLandingGeo(landingFixture as never);
  const index = new Map<string, string[]>([
    ["bilbao-spain", ["MAREA", "Grace Hopper"]],
    ["virginia-beach-va-united-states", ["MAREA"]],
    ["missing-no-coords", ["Ghost Cable"]], // no coords → skipped
  ]);
  const feats = buildLandingFeatures(geo, index);
  const ids = feats.map((f) => f.id).sort();
  // orphan-station-nowhere is in the geo but unreferenced → not emitted.
  expect(ids).toEqual(["landing:bilbao-spain", "landing:virginia-beach-va-united-states"]);
  const bilbao = feats.find((f) => f.id === "landing:bilbao-spain")!;
  expect(bilbao.signalId).toBe("cable-landings");
  expect(bilbao.props?.cableCount).toBe(2);
  expect(String(bilbao.props?.cables)).toContain("MAREA");
});
