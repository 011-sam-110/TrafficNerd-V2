// A curated set of major world cities, spread across every inhabited continent.
// Open-Meteo's forecast + air-quality APIs are per-coordinate, so the weather and
// air-quality signal layers fetch this whole list in ONE multi-coordinate request
// each (Open-Meteo accepts comma-separated lat/lon lists and returns an array in
// the same order). Keeping the list here — shared, immutable, index-stable — means
// both adapters place their markers at the city's real coordinates (not Open-Meteo's
// snapped grid point) by matching the response array index back to this list.

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

/** ~50 major cities, every continent. Order is the request/response index order. */
export const WORLD_CITIES: City[] = [
  // Europe
  { name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038 },
  { name: "Berlin", country: "Germany", lat: 52.52, lon: 13.405 },
  { name: "Rome", country: "Italy", lat: 41.9028, lon: 12.4964 },
  { name: "Moscow", country: "Russia", lat: 55.7558, lon: 37.6173 },
  { name: "Istanbul", country: "Türkiye", lat: 41.0082, lon: 28.9784 },
  { name: "Kyiv", country: "Ukraine", lat: 50.4501, lon: 30.5234 },
  { name: "Stockholm", country: "Sweden", lat: 59.3293, lon: 18.0686 },
  { name: "Athens", country: "Greece", lat: 37.9838, lon: 23.7275 },
  // Africa
  { name: "Cairo", country: "Egypt", lat: 30.0444, lon: 31.2357 },
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lon: 3.3792 },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lon: 28.0473 },
  { name: "Casablanca", country: "Morocco", lat: 33.5731, lon: -7.5898 },
  { name: "Addis Ababa", country: "Ethiopia", lat: 9.03, lon: 38.74 },
  // Middle East / West Asia
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2048, lon: 55.2708 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.7136, lon: 46.6753 },
  { name: "Tehran", country: "Iran", lat: 35.6892, lon: 51.389 },
  { name: "Tel Aviv", country: "Israel", lat: 32.0853, lon: 34.7818 },
  // South / Central Asia
  { name: "Delhi", country: "India", lat: 28.6139, lon: 77.209 },
  { name: "Mumbai", country: "India", lat: 19.076, lon: 72.8777 },
  { name: "Karachi", country: "Pakistan", lat: 24.8607, lon: 67.0011 },
  { name: "Dhaka", country: "Bangladesh", lat: 23.8103, lon: 90.4125 },
  // East / Southeast Asia
  { name: "Beijing", country: "China", lat: 39.9042, lon: 116.4074 },
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.978 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lon: 100.5018 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Jakarta", country: "Indonesia", lat: -6.2088, lon: 106.8456 },
  { name: "Manila", country: "Philippines", lat: 14.5995, lon: 120.9842 },
  { name: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694 },
  { name: "Ho Chi Minh City", country: "Vietnam", lat: 10.8231, lon: 106.6297 },
  // Oceania
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631 },
  { name: "Auckland", country: "New Zealand", lat: -36.8485, lon: 174.7633 },
  // North America
  { name: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  { name: "Los Angeles", country: "United States", lat: 34.0522, lon: -118.2437 },
  { name: "Chicago", country: "United States", lat: 41.8781, lon: -87.6298 },
  { name: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832 },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332 },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lon: -123.1207 },
  // South America
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6037, lon: -58.3816 },
  { name: "Lima", country: "Peru", lat: -12.0464, lon: -77.0428 },
  { name: "Bogotá", country: "Colombia", lat: 4.711, lon: -74.0721 },
  { name: "Santiago", country: "Chile", lat: -33.4489, lon: -70.6693 },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lon: -43.1729 },
];

/** Comma-joined latitudes / longitudes for a single multi-coordinate Open-Meteo call. */
export function cityCoordParams(cities: City[] = WORLD_CITIES): { latitude: string; longitude: string } {
  return {
    latitude: cities.map((c) => c.lat).join(","),
    longitude: cities.map((c) => c.lon).join(","),
  };
}
