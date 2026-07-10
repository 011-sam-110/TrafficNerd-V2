import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/recon-dns.json";
import { parseDoh, buildDnsResult, DNS_TYPES, type DohResponse, type DnsType } from "@/lib/recon/dns";

test("parseDoh maps DoH answers to typed records, dropping unknown/empty", () => {
  const recs = parseDoh(fixture.A as DohResponse);
  expect(recs).toHaveLength(2);
  expect(recs[0]).toEqual({ type: "A", name: "example.com", ttl: 297, value: "104.20.23.154" });
  // Unknown rr-type + empty data are skipped.
  expect(parseDoh({ Answer: [{ name: "x", type: 99, data: "y" }, { name: "x", type: 1, data: "" }] })).toEqual([]);
});

test("buildDnsResult merges per-type responses in display order and reports status", () => {
  const res = buildDnsResult(fixture as Partial<Record<DnsType, DohResponse>>);
  expect(res.ok).toBe(true);
  expect(res.status).toBe(0);
  const types = res.records.map((r) => r.type);
  // A before MX before NS before TXT (DNS_TYPES order); AAAA had no answers.
  expect(types).toEqual(["A", "A", "MX", "NS", "NS", "TXT"]);
  expect(res.records.find((r) => r.type === "TXT")?.value).toBe('"v=spf1 -all"');
});

test("dormant-safe: empty / malformed input yields an honest empty result", () => {
  expect(buildDnsResult({})).toEqual({ ok: false, records: [], status: null });
  expect(parseDoh(null)).toEqual([]);
  expect(parseDoh({} as DohResponse)).toEqual([]);
  expect(DNS_TYPES).toContain("CAA");
});
