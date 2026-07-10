import { expect, test } from "vitest";
import ipFixture from "@/tests/fixtures/recon-bgp-ip.json";
import asnFixture from "@/tests/fixtures/recon-bgp-asn.json";
import { parseBgpIp, parseBgpAsn, type BgpIpResponse, type BgpAsnResponse } from "@/lib/recon/bgp";

test("parseBgpIp maps a BGPView /ip response to prefixes + a lifted origin ASN", () => {
  const res = parseBgpIp(ipFixture as BgpIpResponse);
  expect(res.ok).toBe(true);
  expect(res.kind).toBe("ip");
  expect(res.ip).toBe("1.1.1.1");
  expect(res.ptr).toBe("one.one.one.one");
  // Top-level summary lifts from the first prefix's origin ASN.
  expect(res.asn).toBe(13335);
  expect(res.name).toBe("CLOUDFLARENET");
  expect(res.country).toBe("US");
  expect(res.prefixes).toHaveLength(1);
  expect(res.prefixes[0]).toEqual({ prefix: "1.1.1.0/24", asn: 13335, holder: "CLOUDFLARENET", country: "AU" });
});

test("parseBgpAsn maps a BGPView /asn response to holder identity + RIR", () => {
  const res = parseBgpAsn(asnFixture as BgpAsnResponse);
  expect(res.ok).toBe(true);
  expect(res.kind).toBe("asn");
  expect(res.asn).toBe(13335);
  expect(res.name).toBe("CLOUDFLARENET");
  expect(res.description).toBe("Cloudflare, Inc.");
  expect(res.country).toBe("US");
  expect(res.website).toBe("https://www.cloudflare.com");
  expect(res.rir).toBe("ARIN");
  expect(res.prefixes).toEqual([]);
});

test("dormant-safe: error status / null input yields an honest empty result", () => {
  expect(parseBgpIp({ status: "error" } as BgpIpResponse)).toEqual({ ok: false, kind: "ip", prefixes: [] });
  expect(parseBgpIp(null)).toEqual({ ok: false, kind: "ip", prefixes: [] });
  expect(parseBgpAsn(undefined)).toEqual({ ok: false, kind: "asn", prefixes: [] });
  // Valid data with no announced prefixes is honest (routable IP, just no routes surfaced).
  const noPrefixes = parseBgpIp({ status: "ok", data: { ip: "8.8.8.8", prefixes: [] } } as BgpIpResponse);
  expect(noPrefixes.prefixes).toEqual([]);
  expect(noPrefixes.ip).toBe("8.8.8.8");
});
