// ISO-3166 alpha-2 → flag emoji. A flag emoji is just the country's two letters
// expressed as Unicode "regional indicator symbols" (U+1F1E6..U+1F1FF), so this
// is a pure offset map — no asset, no lookup table. Natural Earth marks a few
// disputed/unclaimed features as "-99"; anything that isn't two A–Z letters
// returns "" so the dossier simply shows no flag rather than mojibake.

const A = 0x1f1e6; // regional indicator "A"

export function flagEmoji(iso2: string | undefined | null): string {
  if (!iso2) return "";
  const cc = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}
