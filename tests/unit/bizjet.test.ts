import { expect, test } from "vitest";
import { isBizjet, ownerOf, BIZJET_TYPES } from "@/lib/planes/bizjet";

test("recognises business-jet ICAO type designators", () => {
  expect(isBizjet("GLF6")).toBe(true); // Gulfstream G650
  expect(isBizjet("GLEX")).toBe(true); // Bombardier Global Express
  expect(isBizjet("FA7X")).toBe(true); // Dassault Falcon 7X
  expect(isBizjet("C750")).toBe(true); // Cessna Citation X
  expect(isBizjet("LJ60")).toBe(true); // Learjet 60
});

test("is case- and whitespace-insensitive", () => {
  expect(isBizjet(" glf6 ")).toBe(true);
  expect(isBizjet("glex")).toBe(true);
});

test("does not flag airliners, regionals, or unknowns", () => {
  expect(isBizjet("A320")).toBe(false);
  expect(isBizjet("B738")).toBe(false);
  expect(isBizjet("CRJ9")).toBe(false); // regional airliner, not a bizjet
  expect(isBizjet("E170")).toBe(false);
  expect(isBizjet("")).toBe(false);
  expect(isBizjet(undefined)).toBe(false);
  expect(isBizjet(null)).toBe(false);
});

test("owner lookup returns curated owners for known tails, null otherwise", () => {
  expect(ownerOf("82-8000")?.owner).toContain("VC-25");
  expect(ownerOf(" n628ts ")?.tag).toBe("corp"); // case + whitespace normalised
  expect(ownerOf("N00000")).toBeNull();
  expect(ownerOf(undefined)).toBeNull();
  expect(ownerOf("")).toBeNull();
});

test("the curated type set is non-trivial and normalised (upper-case codes)", () => {
  expect(BIZJET_TYPES.size).toBeGreaterThan(30);
  for (const t of BIZJET_TYPES) expect(t).toBe(t.toUpperCase());
});
