// Derive a submarine cable's "landing region" corridor from the SET of countries
// it lands in. This is analysis over real landing data (TeleGeography), not an
// invented attribute: every input country comes straight from the source feed.
//
// Countries are bucketed into five ocean-facing macro-regions, then the presence
// set is mapped to a human corridor name (Transatlantic / Transpacific / Intra-Asia
// / …). Kept PURE + exhaustively unit-tested. Countries not in the table fall
// through to "Other" and never crash the classifier.

type Bucket = "AM" | "EU" | "AF" | "AS" | "OC" | "Other";

// Americas (North + Central + Caribbean + South) — one Atlantic/Pacific-facing bucket.
const AMERICAS = [
  "Canada", "United States", "Mexico", "Greenland", "Bermuda", "Saint Pierre and Miquelon",
  "Belize", "Costa Rica", "Guatemala", "Honduras", "Nicaragua", "Panama", "El Salvador",
  "Anguilla", "Antigua and Barbuda", "Aruba", "Bahamas", "Barbados",
  "Bonaire, Sint Eustatius and Saba", "British Virgin Islands", "Cayman Islands", "Cuba",
  "Curaçao", "Dominica", "Dominican Republic", "Grenada", "Guadeloupe", "Haiti", "Jamaica",
  "Martinique", "Montserrat", "Puerto Rico", "Saint Barthélemy", "Saint Kitts and Nevis",
  "Saint Lucia", "Saint Martin", "Saint Vincent and the Grenadines", "Sint Maarten",
  "Trinidad and Tobago", "Turks and Caicos Islands", "Virgin Islands (U.K.)",
  "Virgin Islands (U.S.)",
  "Argentina", "Brazil", "Chile", "Colombia", "Ecuador", "French Guiana", "Guyana", "Peru",
  "Suriname", "Uruguay", "Venezuela",
];

const EUROPE = [
  "Albania", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Denmark", "Estonia", "Faroe Islands",
  "Finland", "France", "Germany", "Gibraltar", "Greece", "Guernsey", "Iceland", "Ireland",
  "Isle of Man", "Italy", "Jersey", "Latvia", "Lithuania", "Malta", "Monaco", "Netherlands",
  "Norway", "Poland", "Portugal", "Romania", "Russia", "Spain", "Sweden", "Ukraine",
  "United Kingdom", "Georgia", "Slovenia", "Montenegro",
];

const AFRICA = [
  "Algeria", "Angola", "Benin", "Cameroon", "Cape Verde", "Comoros", "Congo, Dem. Rep.",
  "Congo, Rep.", "Côte d'Ivoire", "Djibouti", "Egypt", "Equatorial Guinea", "Gabon", "Gambia",
  "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Liberia", "Libya", "Madagascar", "Mauritania",
  "Mauritius", "Mayotte", "Morocco", "Mozambique", "Namibia", "Nigeria", "Réunion",
  "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa",
  "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "British Indian Ocean Territory",
  "Saint Helena, Ascension and Tristan da Cunha",
];

const ASIA = [
  "Azerbaijan", "Bahrain", "Bangladesh", "Brunei", "Cambodia", "China", "India", "Indonesia",
  "Iran", "Iraq", "Israel", "Japan", "Jordan", "Kazakhstan", "Kuwait", "Lebanon", "Malaysia",
  "Maldives", "Myanmar", "Oman", "Pakistan", "Philippines", "Qatar", "Saudi Arabia",
  "Singapore", "South Korea", "Sri Lanka", "Syria", "Taiwan", "Thailand", "Timor-Leste",
  "Turkey", "United Arab Emirates", "Vietnam", "Yemen", "Hong Kong",
];

const OCEANIA = [
  "American Samoa", "Australia", "Christmas Island", "Cocos (Keeling) Islands", "Cook Islands",
  "Fiji", "French Polynesia", "Guam", "Kiribati", "Marshall Islands", "Micronesia", "Nauru",
  "New Caledonia", "New Zealand", "Niue", "Northern Mariana Islands", "Palau",
  "Papua New Guinea", "Samoa", "Solomon Islands", "Tokelau", "Tonga", "Tuvalu", "Vanuatu",
  "Wallis and Futuna",
];

const BUCKET = new Map<string, Bucket>();
for (const c of AMERICAS) BUCKET.set(c, "AM");
for (const c of EUROPE) BUCKET.set(c, "EU");
for (const c of AFRICA) BUCKET.set(c, "AF");
for (const c of ASIA) BUCKET.set(c, "AS");
for (const c of OCEANIA) BUCKET.set(c, "OC");

/** Country → ocean-facing macro-region bucket ("Other" when unmapped). */
export function bucketOf(country: string): Bucket {
  return BUCKET.get(country.trim()) ?? "Other";
}

/**
 * Map a cable's landing countries to a corridor name. Handles the headline cases
 * the filter panel needs (Transatlantic / Transpacific / Intra-Asia) and the
 * common secondary corridors; anything spanning ≥3 macro-regions is
 * "Intercontinental". Empty / all-unknown input ⇒ "Unclassified".
 */
export function classifyLandingRegion(countries: string[]): string {
  const present = new Set<Bucket>();
  for (const c of countries) {
    const b = bucketOf(c);
    if (b !== "Other") present.add(b);
  }
  if (present.size === 0) return "Unclassified";

  const has = (b: Bucket) => present.has(b);

  if (present.size === 1) {
    if (has("AM")) return "Americas";
    if (has("EU")) return "Intra-Europe";
    if (has("AF")) return "Intra-Africa";
    if (has("AS")) return "Intra-Asia";
    if (has("OC")) return "Intra-Pacific";
  }

  // Pacific crossing: the Americas linked to Asia or Oceania.
  if (has("AM") && (has("AS") || has("OC"))) return "Transpacific";
  // Atlantic crossing: the Americas linked to Europe or Africa (no Pacific side).
  if (has("AM") && (has("EU") || has("AF"))) return "Transatlantic";

  if (present.size === 2) {
    if (has("EU") && has("AF")) return "Europe–Africa";
    if (has("EU") && has("AS")) return "Europe–Asia";
    if (has("AF") && has("AS")) return "Africa–Asia";
    if (has("AS") && has("OC")) return "Asia–Pacific";
    if (has("EU") && has("OC")) return "Intercontinental";
    if (has("AF") && has("OC")) return "Indian Ocean";
  }

  return "Intercontinental";
}

/** The canonical corridor order for a filter dropdown (stable, human-friendly). */
export const REGION_ORDER = [
  "Transatlantic",
  "Transpacific",
  "Intra-Asia",
  "Asia–Pacific",
  "Europe–Asia",
  "Europe–Africa",
  "Africa–Asia",
  "Indian Ocean",
  "Intra-Europe",
  "Intra-Africa",
  "Intra-Pacific",
  "Americas",
  "Intercontinental",
  "Unclassified",
];
