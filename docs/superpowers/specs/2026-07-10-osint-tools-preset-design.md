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
    { type: "signal:cyber-ransomware", segment: "right" }, { type: "signal:internet-outages", segment: "right" },
    { type: "signal:cyber-c2", segment: "bottom" },
]) }
```

- Order in `BUILTIN_PRESETS` = order in every surface (list is data-driven), so appending
  after `markets` puts "Tools" directly under "Markets & Cyber".
- Left = the three domain-centric lookups; right = the three IP-centric lookups **plus two
  live cyber-context feeds** (`signal:cyber-ransomware`, `signal:internet-outages`) so the
  right column carries live data alongside the recon forms, not just inputs.
- The three cyber/infra signal widgets light `cyber-c2` + `cyber-ransomware` +
  `internet-outages` map layers → the map behind the tools reads as a live cyber-threat
  backdrop, and the M12 "no blank-map board" guard passes naturally (no exemption needed).

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
| `recon:ports` | Passive port intel (ports/CPEs/CVEs) | Shodan InternetDB `internetdb.shodan.io/<ip>` (keyless); + keyed providers | ip (resolve domain first) |
| `recon:threat` | Threat intel / IP reputation | Shodan InternetDB tags/vulns (keyless baseline); + a registry of keyed providers | domain or ip |

**Keyless baseline is real:** every tool works with zero keys — DoH, RDAP, crt.sh, BGPView,
and Shodan InternetDB are all no-auth. Note: abuse.ch (URLhaus/ThreatFox) moved to requiring a
free auth key in late 2024, so it is a **keyed** provider slot, not part of the keyless
baseline.

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

### Keyed-provider registry (all providers)
Rather than bespoke wiring per provider, keyed upgrades are a **data-driven registry** —
same idea as the signals registry. Each provider is a tiny uniform adapter:

```
interface ReconProvider {
  id: string;              // "virustotal"
  label: string;           // "VirusTotal"
  envKey: string;          // "VIRUSTOTAL_API_KEY"
  tool: "threat" | "ports" | "bgp" | "dns" | "whois" | "certs";
  supports: TargetKind[];  // ["ip","domain"]
  enrich(target, kind, key): Promise<ProviderResult>;   // pure-ish fetch+map
}
```

- `lib/recon/providers/` holds one small module per provider; `providers/registry.ts`
  collects them.
- Each tool's route walks the providers registered for it: if `process.env[envKey]` is set →
  `enrich()` and attach the result; if absent → emit `{ locked: true, label, envKey }`.
- The widget renders each provider as a section: a real verdict when keyed, or a 🔒
  "needs key — set `ENV_NAME`" note when dormant (never hidden, matching the M4/M5 pattern).
  Keyless baseline (InternetDB etc.) always renders. **No fabricated scores** — a dormant or
  failed provider shows the locked/empty note, never invented data.
- Adding a provider = one ~15-line adapter + one registry line + one fixture test. The full
  set the owner wants (13 providers) is enumerated in the "API keys (.env)" section below.

Build order: keyless baseline first (all six tools working with zero keys), then the provider
adapters in registry order. Each provider is independent, so they can land incrementally
without blocking the baseline.

## API keys (.env)

All optional — every tool works keyless. Add any subset to `.env.local` (dev) or Vercel
project env (prod); each unlocks its provider's dormant section. Naming follows the repo
convention (`<PROVIDER>_API_KEY` / `_TOKEN`, like the existing `FINNHUB_API_KEY`).
Free-tier limits are approximate and set by the vendor.

| Provider | Enriches | Where to get the key | .env name | Free tier |
|---|---|---|---|---|
| VirusTotal | threat | https://www.virustotal.com/gui/join-us → profile → API key | `VIRUSTOTAL_API_KEY` | ~500/day, 4/min |
| AbuseIPDB | threat | https://www.abuseipdb.com/register → account → API | `ABUSEIPDB_API_KEY` | 1,000 checks/day |
| GreyNoise | threat | https://www.greynoise.io → sign up → Community API key | `GREYNOISE_API_KEY` | Community lookups |
| AlienVault OTX | threat | https://otx.alienvault.com → sign up → Settings → OTX Key | `OTX_API_KEY` | Free |
| Pulsedive | threat | https://pulsedive.com → register → Account → API Key | `PULSEDIVE_API_KEY` | Free tier |
| IPQualityScore | threat | https://www.ipqualityscore.com/create-account → Settings | `IPQUALITYSCORE_API_KEY` | 5,000/mo |
| abuse.ch (URLhaus/ThreatFox) | threat | https://auth.abuse.ch → sign in → Auth-Key | `ABUSECH_API_KEY` | Free (auth required) |
| Shodan (full API) | ports | https://account.shodan.io/register → Account → API Key | `SHODAN_API_KEY` | Free/one-time membership |
| Censys | ports | https://censys.io → account → API credentials | `CENSYS_API_ID` + `CENSYS_API_SECRET` | Free tier |
| BinaryEdge | ports | https://www.binaryedge.io → sign up → Account → API | `BINARYEDGE_API_KEY` | 250/mo |
| IPinfo | bgp/threat | https://ipinfo.io/signup → dashboard → Token | `IPINFO_TOKEN` | 50,000/mo |
| SecurityTrails | dns | https://securitytrails.com → sign up → API Keys | `SECURITYTRAILS_API_KEY` | 50/mo |
| WhoisXML API | whois | https://whoisxmlapi.com → sign up → My Products → API key | `WHOISXML_API_KEY` | 500/mo |

Notes: Shodan **InternetDB** (the keyless port/threat baseline) needs no key and is separate
from the full **Shodan** API key above. Censys is the one two-part credential (ID + secret).

## Files

**New (zero conflict with the parallel agent):**
- `lib/recon/target.ts`, `lib/recon/targetStore.ts`
- `lib/recon/{dns,whois,certs,bgp,ports,threat}.ts`
- `lib/recon/providers/*` (one adapter per keyed provider) + `lib/recon/providers/registry.ts`
- `app/api/recon/{dns,whois,certs,bgp,ports,threat}/route.ts`
- `lib/console/widgets/recon.tsx`
- `tests/unit/recon-{dns,whois,certs,bgp,ports,threat}.test.ts` (+ `recon-target.test.ts`,
  + one fixture test per keyed provider adapter)

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
- [ ] `preset-layers.test.ts`: Tools board → `cyber-c2` + `cyber-ransomware` +
      `internet-outages` signals ON, no core layers; blank-map guard still green for all 6.
- [ ] Every API route returns HTTP 200 with a labelled empty payload on upstream failure
      (never a 5xx, never fabricated data).
- [ ] Each keyed provider adapter: a fixture test (sample response → mapped result) and a
      "returns `{ locked }` when its env key is absent" assertion. No key set → keyless
      baseline still renders and no provider fabricates a verdict.
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
