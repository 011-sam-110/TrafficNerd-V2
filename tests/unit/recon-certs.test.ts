import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/recon-crtsh.json";
import { parseCrtSh, type CrtShRow } from "@/lib/recon/certs";

const ROWS = fixture as CrtShRow[];

test("parseCrtSh maps crt.sh rows to subdomains + recency-sorted certs", () => {
  const res = parseCrtSh(ROWS);
  expect(res.ok).toBe(true);
  // Subdomains: non-empty, includes the apex, and counted.
  expect(res.subdomains.length).toBeGreaterThan(0);
  expect(res.subdomains).toContain("example.com");
  expect(res.subdomainCount).toBe(res.subdomains.length);
  expect(res.total).toBe(ROWS.length);
  // Certs: most-recent first (not_before desc), with the surfaced fields present.
  expect(res.certs.length).toBeGreaterThan(0);
  const first = res.certs[0];
  expect(first.issuer).toBeTruthy();
  expect(first.commonName).toBe("example.com");
  expect(first.notBefore).toBe("2026-05-31T21:39:12");
  expect(first.notAfter).toBeTruthy();
});

test("subdomains are unique and alphabetically sorted", () => {
  const { subdomains } = parseCrtSh(ROWS);
  // Unique.
  expect(new Set(subdomains).size).toBe(subdomains.length);
  // Sorted (same lexical order the mapper uses).
  expect(subdomains).toEqual([...subdomains].sort());
  // Wildcards are kept as their literal string, not stripped.
  expect(subdomains).toContain("*.example.com");
});

test("dormant-safe: empty / malformed input yields an honest empty result", () => {
  const empty = { ok: false, subdomains: [], certs: [], total: 0, subdomainCount: 0 };
  expect(parseCrtSh([])).toEqual(empty);
  expect(parseCrtSh(null)).toEqual(empty);
  expect(parseCrtSh(undefined)).toEqual(empty);
  expect(parseCrtSh("nope" as unknown as CrtShRow[])).toEqual(empty);
});
