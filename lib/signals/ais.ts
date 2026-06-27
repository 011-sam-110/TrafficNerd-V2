import type { SignalFeature, SignalSource } from "@/lib/signals/types";

// Real-time ship tracking — AISStream.io (free WebSocket). AISStream streams live
// vessel positions; there is no REST snapshot, so the adapter opens the socket
// IN-REQUEST, subscribes to the strategic chokepoint boxes, accumulates the latest
// PositionReport per vessel for a few seconds, then closes and returns the snapshot.
// The registry caches the result (refreshMs), so the socket only opens occasionally.
// Key-gated: set AISSTREAM_API_KEY (free, no card); dormant (→ []) until then.
// Coverage is terrestrial-station AIS (~200 km offshore), so mid-ocean is patchy.

const WS_URL = "wss://stream.aisstream.io/v0/stream";

/** Strategic maritime chokepoints (the intel-relevant water). [[swLat,swLon],[neLat,neLon]]. */
const CHOKEPOINTS: number[][][] = [
  [[24, 54], [27, 58]],     // Strait of Hormuz
  [[12, 32], [31, 44]],     // Red Sea → Suez (incl. Bab-el-Mandeb)
  [[48, -6], [52, 3]],      // English Channel
  [[1, 98], [6, 105]],      // Strait of Malacca / Singapore
  [[35.7, -6.2], [36.3, -5]], // Strait of Gibraltar
  [[40.9, 28.8], [41.3, 29.2]], // Bosphorus
  [[8, -80.5], [9.6, -79]], // Panama Canal approaches
  [[21.5, 119], [25.5, 122]], // Taiwan Strait
  [[55, 10], [58, 13]],     // Danish Straits (Baltic approaches)
];

/** Cap on vessels returned (keeps a busy snapshot legible). */
export const AIS_CAP = 1200;
/** How long to accumulate position reports per refresh. */
const COLLECT_MS = 4500;

export const AISSTREAM_ATTRIBUTION = "Vessel positions © AISStream.io";

export interface AisVessel {
  MMSI?: number;
  ShipName?: string;
  latitude?: number | null;
  longitude?: number | null;
  Sog?: number | null; // speed over ground (kt)
  Cog?: number | null; // course over ground (deg)
  TrueHeading?: number | null;
  NavigationalStatus?: number | null;
  time_utc?: string;
}

/** AIS navigational-status code → label (the common ones). */
export function navStatusLabel(code: number | null | undefined): string {
  switch (code) {
    case 0: return "under way (engine)";
    case 1: return "at anchor";
    case 2: return "not under command";
    case 3: return "restricted manoeuvrability";
    case 4: return "constrained by draught";
    case 5: return "moored";
    case 6: return "aground";
    case 7: return "fishing";
    case 8: return "under way (sailing)";
    default: return "—";
  }
}

/** "YYYY-MM-DD HH:MM:SS.sss +0000 UTC" (AISStream) → ISO, or undefined. */
function aisTimeToIso(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!m) return undefined;
  const t = Date.parse(`${m[1]}T${m[2]}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

/** Pure: AISStream vessel snapshots → SignalFeature[]. Skips vessels with no position. */
export function normalizeAis(vessels: AisVessel[]): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const v of vessels) {
    const lat = typeof v.latitude === "number" ? v.latitude : Number.NaN;
    const lon = typeof v.longitude === "number" ? v.longitude : Number.NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    if (!v.MMSI) continue;
    const name = (v.ShipName ?? "").trim() || `MMSI ${v.MMSI}`;
    const sog = typeof v.Sog === "number" ? v.Sog : null;
    const moving = sog != null && sog > 0.5;
    out.push({
      id: `ais:${v.MMSI}`,
      lat,
      lon,
      title: name,
      signalId: "ais",
      color: moving ? "#0d9488" : "#64748b", // under way = teal, stationary = slate
      ts: aisTimeToIso(v.time_utc),
      props: {
        vessel: name,
        mmsi: v.MMSI,
        speed: sog != null ? `${sog.toFixed(1)} kt` : "—",
        course: typeof v.Cog === "number" ? `${Math.round(v.Cog)}°` : "—",
        heading: typeof v.TrueHeading === "number" && v.TrueHeading !== 511 ? `${v.TrueHeading}°` : "—",
        status: navStatusLabel(v.NavigationalStatus),
      },
    });
  }
  return out.slice(0, AIS_CAP);
}

/** Open the AISStream socket, accumulate latest PositionReport per vessel, then close. */
async function collectAis(key: string, ms: number): Promise<AisVessel[]> {
  return new Promise((resolve) => {
    const seen = new Map<number, AisVessel>();
    let settled = false;
    const decoder = new TextDecoder();
    let ws: WebSocket;
    const done = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* already closing */ }
      resolve([...seen.values()]);
    };
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      resolve([]);
      return;
    }
    ws.binaryType = "arraybuffer";
    const timer = setTimeout(done, ms);
    ws.onopen = () => {
      ws.send(JSON.stringify({ APIKey: key, BoundingBoxes: CHOKEPOINTS, FilterMessageTypes: ["PositionReport"] }));
    };
    ws.onmessage = (e: MessageEvent) => {
      const txt = typeof e.data === "string" ? e.data : decoder.decode(e.data as ArrayBuffer);
      try {
        const m = JSON.parse(txt) as {
          MessageType?: string;
          MetaData?: { MMSI?: number; ShipName?: string; latitude?: number; longitude?: number; time_utc?: string };
          Message?: { PositionReport?: { Sog?: number; Cog?: number; TrueHeading?: number; NavigationalStatus?: number } };
        };
        const mmsi = m.MetaData?.MMSI;
        if (m.MessageType !== "PositionReport" || !mmsi) return;
        const md = m.MetaData!, pr = m.Message?.PositionReport ?? {};
        seen.set(mmsi, {
          MMSI: mmsi, ShipName: md.ShipName, latitude: md.latitude, longitude: md.longitude,
          Sog: pr.Sog, Cog: pr.Cog, TrueHeading: pr.TrueHeading, NavigationalStatus: pr.NavigationalStatus,
          time_utc: md.time_utc,
        });
        if (seen.size >= AIS_CAP) { clearTimeout(timer); done(); }
      } catch { /* skip malformed frame */ }
    };
    ws.onerror = () => { clearTimeout(timer); done(); };
    ws.onclose = () => { clearTimeout(timer); done(); };
  });
}

export const AIS_SOURCE: SignalSource = {
  id: "ais",
  label: "Ships (AIS chokepoints)",
  group: "Maritime",
  color: "#0d9488",
  refreshMs: 60_000, // re-open the socket at most ~once a minute
  attribution: AISSTREAM_ATTRIBUTION,
  async fetch() {
    const key = (process.env.AISSTREAM_API_KEY ?? "").trim();
    if (!key) return []; // dormant until the free key is set
    try {
      const vessels = await collectAis(key, COLLECT_MS);
      return normalizeAis(vessels);
    } catch {
      return [];
    }
  },
};
