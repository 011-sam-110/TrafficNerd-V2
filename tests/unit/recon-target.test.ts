import { expect, test } from "vitest";
import { detectKind, normalizeTarget } from "@/lib/recon/target";

test("detectKind classifies domains, IPs, ASNs and empties junk", () => {
  expect(detectKind("example.com")).toBe("domain");
  expect(detectKind("sub.example.co.uk")).toBe("domain");
  expect(detectKind("EXAMPLE.COM.")).toBe("domain"); // trailing dot + case tolerated
  expect(detectKind("1.1.1.1")).toBe("ip");
  expect(detectKind("2606:4700:4700::1111")).toBe("ip"); // IPv6
  expect(detectKind("AS15169")).toBe("asn");
  expect(detectKind("15169")).toBe("asn"); // bare numeric ASN
  expect(detectKind("")).toBe("empty");
  expect(detectKind("   ")).toBe("empty");
  expect(detectKind("!!! not a target")).toBe("empty"); // junk
  expect(detectKind("300.1.2.3")).toBe("empty"); // octet out of range → not an IP, not a domain
});

test("normalizeTarget lower-cases hosts and strips the AS prefix", () => {
  expect(normalizeTarget("EXAMPLE.COM", "domain")).toBe("example.com");
  expect(normalizeTarget("1.1.1.1", "ip")).toBe("1.1.1.1");
  expect(normalizeTarget("AS15169", "asn")).toBe("15169");
  expect(normalizeTarget("as15169", "asn")).toBe("15169");
});
