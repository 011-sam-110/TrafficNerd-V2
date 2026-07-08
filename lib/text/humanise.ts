// Humanise a camelCase / snake_case / kebab key into a Title-ish label for a
// definition-list term, e.g. "forecastFor" → "Forecast for", "alert_level" → "Alert level".
export function humaniseKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}
