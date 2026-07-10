import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/recon-internetdb.json";
import { parseInternetDb, portService, type InternetDbResponse } from "@/lib/recon/ports";

test("parseInternetDb maps an InternetDB response: ok, ip, sorted ports, cpes/hostnames", () => {
  const res = parseInternetDb(fixture as InternetDbResponse);
  expect(res.ok).toBe(true);
  expect(res.ip).toBe("1.1.1.1");
  // Ports are sorted ascending and include the HTTPS port.
  expect(res.ports).toEqual([...res.ports].sort((a, b) => a - b));
  expect(res.ports).toContain(443);
  expect(Array.isArray(res.cpes)).toBe(true);
  expect(res.cpes.length).toBeGreaterThan(0);
  expect(Array.isArray(res.hostnames)).toBe(true);
  expect(res.hostnames).toContain("one.one.one.one");
});

test("portService maps well-known ports and returns '' otherwise", () => {
  expect(portService(443)).toBe("https");
  expect(portService(22)).toBe("ssh");
  expect(portService(99999)).toBe("");
});

test("dormant-safe: null / empty input yields an honest empty result", () => {
  expect(parseInternetDb(null)).toEqual({ ok: false, ip: "", ports: [], cpes: [], hostnames: [], vulns: [] });
  expect(parseInternetDb({})).toEqual({ ok: false, ip: "", ports: [], cpes: [], hostnames: [], vulns: [] });
});
