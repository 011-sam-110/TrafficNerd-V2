import { expect, test } from "vitest";
import { bucketOf, classifyLandingRegion } from "@/lib/signals/cable-regions";

test("buckets known countries, defaults unknowns to Other", () => {
  expect(bucketOf("United States")).toBe("AM");
  expect(bucketOf("Spain")).toBe("EU");
  expect(bucketOf("Nigeria")).toBe("AF");
  expect(bucketOf("Japan")).toBe("AS");
  expect(bucketOf("Fiji")).toBe("OC");
  expect(bucketOf("Atlantis")).toBe("Other");
});

test("classifies the headline corridors the filter panel needs", () => {
  expect(classifyLandingRegion(["Spain", "United States"])).toBe("Transatlantic");
  expect(classifyLandingRegion(["Japan", "United States"])).toBe("Transpacific");
  expect(classifyLandingRegion(["Australia", "United States"])).toBe("Transpacific");
  expect(classifyLandingRegion(["Japan", "Singapore", "Taiwan"])).toBe("Intra-Asia");
  expect(classifyLandingRegion(["France", "Germany", "United Kingdom"])).toBe("Intra-Europe");
});

test("classifies secondary corridors + degrades honestly", () => {
  expect(classifyLandingRegion(["France", "Nigeria"])).toBe("Europe–Africa");
  expect(classifyLandingRegion(["India", "Kenya"])).toBe("Africa–Asia");
  expect(classifyLandingRegion(["Singapore", "Australia"])).toBe("Asia–Pacific");
  expect(classifyLandingRegion(["France", "Egypt", "Bahrain"])).toBe("Intercontinental"); // ≥3 buckets
  expect(classifyLandingRegion([])).toBe("Unclassified");
  expect(classifyLandingRegion(["Atlantis"])).toBe("Unclassified"); // all unknown
});

test("Pacific side wins over Atlantic when both an ocean cross and Europe are present", () => {
  // A cable touching the Americas + Asia is a Pacific crossing regardless of any
  // incidental European landing — Transpacific takes precedence.
  expect(classifyLandingRegion(["United States", "Japan", "France"])).toBe("Transpacific");
});
