// Classify a satellite into a recognisable *type* from its catalogue name.
//
// The anonymous CelesTrak feed gives us a name and TLE — no machine-readable
// purpose field — so we infer the type from the name the way an observer would
// ("STARLINK-1234" is obviously a Starlink). Order matters: the most specific
// rules run first (a name can match several keywords). Pure + unit-tested.

export type SatCategory =
  | "station"
  | "starlink"
  | "oneweb"
  | "navigation"
  | "weather"
  | "earth-observation"
  | "science"
  | "communications"
  | "cubesat"
  | "debris"
  | "other";

const RULES: { cat: SatCategory; test: RegExp }[] = [
  // Spent upper stages & fragments first — they often embed other keywords.
  { cat: "debris", test: /\bDEB\b|DEBRIS|\bR\/B\b|ROCKET BODY|\bAKM\b|\bPKM\b|FAIRING|COOLANT/ },
  // Crewed stations & visiting vehicles.
  { cat: "station", test: /\bISS\b|ZARYA|TIANGONG|TIANHE|MENGTIAN|WENTIAN|SPACE STATION|PROGRESS[ -]|SOYUZ[ -]|CREW DRAGON|DRAGON CRS|CYGNUS|TIANZHOU|MIR\b/ },
  { cat: "starlink", test: /STARLINK/ },
  { cat: "oneweb", test: /ONEWEB/ },
  // Global navigation constellations.
  { cat: "navigation", test: /NAVSTAR|\bGPS\b|GLONASS|GALILEO|BEIDOU|COMPASS|IRNSS|NVS-|\bQZS\b|\bGSAT0/ },
  // Meteorology / operational Earth weather.
  { cat: "weather", test: /\bNOAA\b|METEOR-|METOP|\bGOES\b|HIMAWARI|FENGYUN|\bFY-?\d|DMSP|ELEKTRO|INSAT|\bGOMS\b|\bMSG-?\d|\bMTG\b|METEOSAT/ },
  // Imaging / remote sensing.
  { cat: "earth-observation", test: /LANDSAT|SENTINEL|TERRA|AQUA|WORLDVIEW|GEOEYE|\bSPOT\b|PLEIADES|FLOCK|SKYSAT|\bDOVE\b|ICEYE|RADARSAT|CARTOSAT|RESOURCESAT|KOMPSAT|PLANET|JILIN|GAOFEN|CBERS|SAOCOM|CAPELLA|BLACKSKY|SUPERVIEW/ },
  // Science / astronomy / geodesy.
  { cat: "science", test: /\bHST\b|HUBBLE|KEPLER|\bTESS\b|SWIFT|FERMI|CHANDRA|\bGAIA\b|JWST|WEBB|\bXMM\b|INTEGRAL|NUSTAR|\bIXPE\b|CHEOPS|HXMT|SPEKTR|CALSPHERE|LARES|AJISAI|STARLETTE|TOPEX|JASON|GRACE|SWARM|CLUSTER|THEMIS|\bMMS\b/ },
  // Commercial / government communications.
  { cat: "communications", test: /INTELSAT|IRIDIUM|GLOBALSTAR|INMARSAT|\bSES-?\d|EUTELSAT|TELSTAR|\bO3B\b|ECHOSTAR|THAICOM|ASTRA|VIASAT|ORBCOMM|GONETS|YAMAL|EXPRESS-|HISPASAT|NIMIQ|\bANIK\b|\bBADR\b|TURKSAT|\bNSS-|MEASAT|JCSAT|OPTUS|SKYNET|\bMUOS\b|\bWGS\b|SYRACUSE|GSAT-?\d|KUIPER/ },
  // Small/student satellites.
  { cat: "cubesat", test: /CUBESAT|CUBE|-[136]U\b|UNICORN|SPROUT|LEMUR|PROXIMA|\bPOCKETQUBE\b/ },
];

/** Best-effort satellite type from its catalogue name. Falls back to "other". */
export function classifySatellite(name: string): SatCategory {
  const n = (name || "").toUpperCase();
  for (const r of RULES) if (r.test.test(n)) return r.cat;
  return "other";
}
