// Pure helpers for the clickable-countries layer.
//
// Two jobs, both DOM-free and testable:
//   • toCountryLabelFC() — a point FeatureCollection of country NAME labels,
//     anchored at the representative centroids we already ship. Drawn only on the
//     raster basemaps (Satellite/Topo), which carry no labels of their own.
//   • buildCountryObject() — turn a clicked country polygon's properties into the
//     shared WorldObject the overlay dossier renders (kind: "country").
//
// The borders + click hit-areas come from a bundled Natural Earth 110m polygon
// file (public/geo/countries-110m.geojson); this module never touches it.

import { COUNTRY_CENTROIDS } from "@/lib/signals/country-centroids.data";
import { flagEmoji } from "@/lib/geo/flag";
import type { WorldObject } from "@/lib/world";

/** Country NAME labels as points, anchored at the shipped centroids. */
export function toCountryLabelFC(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: COUNTRY_CENTROIDS.map((c) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      properties: { name: c.name, iso2: c.iso2, iso3: c.iso3 },
    })),
  };
}

/** The relevant properties a Natural Earth country polygon carries (others ignored). */
export interface CountryProps {
  NAME?: string;
  NAME_LONG?: string;
  ADMIN?: string;
  ISO_A2?: string;
  ISO_A3?: string;
  CONTINENT?: string;
  REGION_UN?: string;
  SUBREGION?: string;
  POP_EST?: number;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() && v !== "-99" ? v.trim() : undefined;

/**
 * A clicked country polygon → the WorldObject the dossier opens. `lat`/`lon` are
 * the click anchor. `meta` carries placeholder-ready facts (ISO, region, flag,
 * rough population) so CountryDetail can render today and be enriched later.
 */
export function buildCountryObject(
  props: CountryProps,
  lat: number,
  lon: number,
): WorldObject {
  const name = str(props.NAME) ?? str(props.ADMIN) ?? str(props.NAME_LONG) ?? "Unknown country";
  const iso2 = str(props.ISO_A2);
  const iso3 = str(props.ISO_A3);
  const region = str(props.SUBREGION) ?? str(props.REGION_UN) ?? str(props.CONTINENT);
  const pop = typeof props.POP_EST === "number" && props.POP_EST > 0 ? props.POP_EST : undefined;
  return {
    kind: "country",
    id: `country:${iso3 ?? iso2 ?? name}`,
    lat,
    lon,
    label: name,
    meta: {
      iso2,
      iso3,
      region,
      continent: str(props.CONTINENT),
      population: pop,
      flag: flagEmoji(iso2),
      placeholder: true,
    },
  };
}
