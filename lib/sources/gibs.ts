// NASA GIBS keyless true-color imagery. We show the tile covering a satellite's
// sub-point for a date (default: yesterday UTC, which has full global coverage).
// Web-Mercator (EPSG:3857) slippy tiles — the same z/x/y scheme MapLibre/OSM use.
const LAYER = "MODIS_Terra_CorrectedReflectance_TrueColor";
const MATRIX = "GoogleMapsCompatible_Level9";

// Web-Mercator is only defined up to ~±85.0511°; the log() below returns NaN past
// the poles, so clamp latitude into the valid band before projecting.
const MERCATOR_MAX_LAT = 85.05112878;

/** lon/lat + zoom → slippy tile {x,y} (Web-Mercator). */
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const nTiles = 2 ** z;
  const latC = Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, lat));
  const x = Math.floor(((lon + 180) / 360) * nTiles);
  const latRad = (latC * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * nTiles);
  const clamp = (v: number) => Math.max(0, Math.min(nTiles - 1, Number.isFinite(v) ? v : 0));
  return { x: clamp(x), y: clamp(y) };
}

/** UTC yesterday as YYYY-MM-DD (GIBS lags ~1 day; yesterday is reliably covered). */
export function gibsDate(nowMs: number): string {
  return new Date(nowMs - 24 * 3600_000).toISOString().slice(0, 10);
}

/** A keyless GIBS true-color tile URL covering (lat, lon) at zoom `z` for a date. */
export function gibsTileUrl(lat: number, lon: number, z: number, date: string): string {
  const { x, y } = lonLatToTile(lon, lat, z);
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/${date}/${MATRIX}/${z}/${y}/${x}.jpg`;
}
