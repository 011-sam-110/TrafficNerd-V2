import { expect, test } from "vitest";
import fixture from "@/tests/fixtures/recon-rdap-domain.json";
import { parseRdap, type RdapResponse } from "@/lib/recon/whois";

test("parseRdap maps a real RDAP domain response", () => {
  const r = parseRdap(fixture as RdapResponse, "domain");
  expect(r.ok).toBe(true);
  expect(r.kind).toBe("domain");
  expect(r.name).toBe("example.com"); // ldhName lower-cased
  expect(r.registrar).toBe("RESERVED-Internet Assigned Numbers Authority");
  // events → created / updated / expires (ISO strings kept verbatim).
  expect(r.created).toBe("1995-08-14T04:00:00Z");
  expect(r.expires).toBe("2026-08-13T04:00:00Z");
  expect(r.updated).toBe("2026-01-16T18:26:50Z");
  // status + nameservers are arrays.
  expect(Array.isArray(r.status)).toBe(true);
  expect(r.status).toContain("client delete prohibited");
  expect(Array.isArray(r.nameservers)).toBe(true);
  expect(r.nameservers).toEqual(["elliott.ns.cloudflare.com", "hera.ns.cloudflare.com"]);
});

test("parseRdap maps an IP-shaped RDAP object to the IP fields", () => {
  const ip: RdapResponse = {
    handle: "NET-8-8-8-0-1",
    name: "GOGL",
    country: "US",
    startAddress: "8.8.8.0",
    endAddress: "8.8.8.255",
    type: "ALLOCATED PORTABLE",
    status: ["active"],
    entities: [
      {
        handle: "GOGL",
        roles: ["registrant"],
        vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Google LLC"]]],
      },
    ],
  };
  const r = parseRdap(ip, "ip");
  expect(r.ok).toBe(true);
  expect(r.kind).toBe("ip");
  expect(r.name).toBe("GOGL");
  expect(r.handle).toBe("NET-8-8-8-0-1");
  expect(r.country).toBe("US");
  expect(r.range).toBe("8.8.8.0 - 8.8.8.255");
  expect(r.type).toBe("ALLOCATED PORTABLE");
  expect(r.registrant).toBe("Google LLC");
  expect(r.nameservers).toEqual([]); // no NS on an IP network
});

test("dormant-safe: null / empty input yields an honest empty result", () => {
  const empty = { ok: false, kind: "domain", status: [], nameservers: [] };
  expect(parseRdap(null, "domain")).toEqual(empty);
  expect(parseRdap({}, "domain")).toEqual(empty);
  // arrays present-but-empty, no invented fields.
  const r = parseRdap({}, "domain");
  expect(r.status).toEqual([]);
  expect(r.nameservers).toEqual([]);
  expect(r.name).toBeUndefined();
});
