# OSINT Tools — "Tools" preset

Date: 2026-07-10
Status: design approved (brainstorming) → next: implementation plan

## Overview

Add six **passive, keyless OSINT recon tools** to World Monitor, each as its own console
widget, grouped into a new **"Tools" preset** appended directly after "Markets & Cyber".
Type a target (domain / IP / ASN) once and all six tools resolve it: DNS records, WHOIS/RDAP,
SSL certificate transparency, BGP/ASN routing, passive port intelligence, and threat / IP
reputation.

This is a genuinely new interaction shape for the app (query→response lookups keyed by a
target), distinct from the existing live signal layers (streaming geographic features). It
reuses the existing preset + generic-widget-registration patterns so no map/route/rail
rewiring is needed.

## Goals

- One new **preset** (`id: "tools"`, title **"Tools"**, icon 🔎) as the 6th `BUILTIN_PRESETS`
  entry — lands under "Markets & Cyber" in the ⌘K Profiles list, navbar pill, and Settings.
- Six recon **widgets** (`recon:dns`, `recon:whois`, `recon:certs`, `recon:bgp`,
  `recon:ports`, `recon:threat`), all sharing a single target.
- Every upstream is **keyless-first and dormant-safe**: failures resolve to a labelled empty
  result, never a 5xx, never fabricated data (house rule).
- The upstream→domain mapping for each tool is a **pure exported function with a unit test**
  (house rule).
- A live **cyber-C2 backdrop** map behind the tools (reuses the existing `signal:cyber-c2`
  layer), so the board is thematically coherent and passes the "no blank-map board" guard.

## Non-goals (YAGNI)

- **No active scanning.** Port intelligence is passive (Shodan InternetDB), so the public
  deployment never scans third-party infrastructure (abuse vector + Vercel AUP + serverless
  has no raw sockets). This was an explicit design decision.
- **No plotting recon results on the map** in v1 (IP geolocation pins, BGP prefix geometry).
  It would touch `WorldMap.tsx` (which the parallel agent may edit) and is deferred to v2.
- No historical persistence of lookups, no saved-target list, no diffing over time (v2).

## Decisions (confirmed with owner)

1. **Map backdrop stays** — the Tools board includes a `signal:cyber-c2` widget so
   `layersForLayout` lights the cyber-C2 layer as a live backdrop; the "no blank-map board"
   guard passes with **no test exemption**.
2. **Threat-intel keyed upgrades included** — `recon:threat` shows optional VirusTotal /
   AbuseIPDB sections as 🔒 "needs key" dormant slots; keyless sources drive it by default.
3. **Preset title is just "Tools".**

## UI placement

### The preset
Appended as the 6th entry in `BUILTIN_PRESETS` (`lib/console/presets.ts`):

```
{ id: "tools", title: "Tools", icon: "🔎", blurb: "domain & IP intel", build: () => compose("map2d", [
    { type: "recon:dns",    segment: "left"  }, { type: "recon:whois", segment: "left"  }, { type: "recon:certs", segment: "left"  },
    { type: "recon:ports",  segment: "right" }, { type: "recon:threat", segment: "right" }, { type: "recon:bgp",   segment: "right" },
    { type: "signal:cyber-c2", segment: "bottom" },
]) }
```

- Order in `BUILTIN_PRESETS` = order in every surface (list is data-driven), so appending
  after `markets` puts "Tools" directly under "Markets & Cyber".
- `signal:cyber-c2` on the bottom segment → `layersForLayout` lights the cyber-C2 map layer →
  the map behind the tools reads as a live cyber-threat backdrop, and the M12 blank-map guard
  passes naturally.

### Shared target (type once, all six resolve)
- New tiny store `lib/recon/targetStore.ts`: `{ target: string, kind: 'domain'|'ip'|'asn'|'empty' }`.
- Pure `detectKind(input): TargetKind` in `lib/recon/target.ts` (IPv4 regex, `AS####`/numeric
  → asn, else domain), unit-tested.
- Every recon widget renders a compact target input bound to the store. Typing in any widget
  updates the shared target; all six re-fetch (each via its own API route).
- Empty target → honest empty state ("Enter a domain or IP to begin"), not a spinner or fake
  rows (M18 empty-state ethos).
- Tools that need an IP (`recon:ports`) resolve a domain target to an IP first via the DNS
  route (or accept a raw IP directly).

## Architecture

One pattern applied six times: **pure adapter + fixture unit test + dormant-safe API route +
generic widget registration**.

### Sources (all keyless, server-proxied)

| Widget id | Tool | Upstream (keyless) | Input |
|---|---|---|---|
| `recon:dns` | DNS records A/AAAA/MX/NS/TXT/CNAME/SOA/CAA | Cloudflare DoH `cloudflare-dns.com/dns-query` (JSON) | domain |
| `recon:whois` | Registration / ownership | RDAP `rdap.org/domain/<d>`, `rdap.org/ip/<ip>` | domain or ip |
| `recon:certs` | Cert transparency + subdomain enumeration | crt.sh `?q=<d>&output=json` | domain |
| `recon:bgp` | ASN / prefixes / peers | BGPView `api.bgpview.io/{ip,asn}/<t>` | ip or asn |
| `recon:ports` | Passive port intel (ports/CPEs/CVEs) | Shodan InternetDB `internetdb.shodan.io/<ip>` | ip (resolve domain first) |
| `recon:threat` | Threat intel / IP reputation | Shodan InternetDB (tags/vulns) + abuse.ch URLhaus `urlhaus-api.abuse.ch/v1/host/`; +🔒 VirusTotal / AbuseIPDB when keyed | domain or ip |

Why server-proxied: these APIs are CORS-blocked in the browser and staying keyless-first means
proxying and short-caching them server-side (same rationale as the existing `app/api/*`
handlers). Passive read-only lookups have a far lower abuse profile than active scanning; each
route caches briefly (Next `revalidate`) to protect the upstreams.

### Modules

- `lib/recon/` (all new):
  - `target.ts` — `detectKind()` + `TargetKind` type.
  - `targetStore.ts` — shared target store (mirrors the small store pattern of
    `lib/signals/store.ts`).
  - `dns.ts`, `whois.ts`, `certs.ts`, `bgp.ts`, `ports.ts`, `threat.ts` — each exports a
    pure `parse*(upstreamJson): <DomainShape>` mapper + its TypeScript result type. No fetch,
    no React → fast unit tests.
- `app/api/recon/<tool>/route.ts` (6 new folders: `dns`, `whois`, `certs`, `bgp`, `ports`,
  `threat`) — each reads its query param(s), fetches the keyless upstream, runs the pure
  mapper, returns typed JSON. Dormant-safe: any fetch/parse failure → `{ ok:false, reason }`
  with an empty result payload and HTTP 200, never a 5xx, never fabricated rows.
- `lib/console/widgets/recon.tsx` (new, ONE file) — registers all six widgets generically,
  exactly as `lib/console/widgets/signals.tsx` registers one widget per signal source. Each
  widget = shared target input + a tool-specific result renderer + honest empty/error/loading
  states. Reuses the existing `useJsonPoll`-style fetch hook where it fits (or a one-shot
  fetch-on-target-change variant).
- `lib/console/widgets/index.ts` — add `import "@/lib/console/widgets/recon";`.

### `recon:threat` keyed upgrades
- Keyless by default: merges Shodan InternetDB `tags`/`vulns` + abuse.ch URLhaus host verdict
  into a simple reputation summary.
- Dormant sections rendered with a 🔒 "needs key" note (never hidden), matching the M4/M5
  dormant-section pattern: **VirusTotal** (`VIRUSTOTAL_API_KEY`) and **AbuseIPDB**
  (`ABUSEIPDB_API_KEY`). When the env key is present the route enriches the verdict; when
  absent the section shows the locked note. No fabricated scores.

## Files

**New (~15, zero conflict with the parallel agent):**
- `lib/recon/target.ts`, `lib/recon/targetStore.ts`
- `lib/recon/{dns,whois,certs,bgp,ports,threat}.ts`
- `app/api/recon/{dns,whois,certs,bgp,ports,threat}/route.ts`
- `lib/console/widgets/recon.tsx`
- `tests/unit/recon-{dns,whois,certs,bgp,ports,threat}.test.ts` (+ `recon-target.test.ts`)

**Modified (small, surgical):**
- `lib/console/presets.ts` — +1 preset entry.
- `lib/console/widgets/index.ts` — +1 import line.
- `tests/unit/console-presets.test.ts` — update `BOARD_IDS` to include `"tools"`; add the six
  `recon:*` ids to the allowed widget-type set; update the "five broad boards" wording/count.
- `tests/unit/preset-layers.test.ts` — the Tools board lights `cyber-c2` via its cyber widget,
  so the "no blank-map board" guard passes unchanged; add a positive assertion that the tools
  board lights `cyber-c2` and no core layers.

**Unchanged (important):** `lib/console/presetLayers.ts` needs no edit — recon widgets don't
match `WIDGET_TO_CORE` or the `signal:` prefix, so they fall through as list-only (no layer),
exactly like `events`/`markets`.

## Test guards & acceptance

Build gate: `npx tsc --noEmit && npm test` green.

- [ ] Each of the 6 pure mappers has a fixture unit test (captured upstream sample → asserted
      domain shape), incl. a malformed/empty fixture asserting the dormant-safe empty result.
- [ ] `detectKind()` unit-tested across domain / IPv4 / `AS####` / numeric-ASN / junk.
- [ ] `console-presets.test.ts` updated and green: 6 boards, `tools` present, `recon:*` widget
      types recognised.
- [ ] `preset-layers.test.ts`: Tools board → `cyber-c2` signal ON, no core layers; blank-map
      guard still green for all 6 presets.
- [ ] Every API route returns HTTP 200 with a labelled empty payload on upstream failure
      (never a 5xx, never fabricated data).
- [ ] UI evidence: Playwright screenshot of the Tools preset with a real lookup
      (e.g. `example.com`) to `persona-shots/`.

## Parallel-agent safety

The other agent is on a navbar/opendata overhaul (`2026-07-10-navbar-opendata-overhaul-design.md`,
`opendata-*.png`). Overlap is limited to `lib/console/presets.ts` and possibly the navbar that
renders the preset pill. Because the preset list is data-driven off `BUILTIN_PRESETS`, appending
one entry is low-risk. Work on a fresh branch off latest `main`; re-check `presets.ts`,
`widgets/index.ts`, and the two test files for their edits immediately before touching them, and
rebase rather than overwrite.

## Commit / PR

- One commit, solo attribution (repo convention — no co-author trailer).
- Fresh branch off latest `main`, new PR (Sampo live-merges + deletes branches fast).
