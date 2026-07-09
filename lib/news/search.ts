// lib/news/search.ts
// A small boolean search grammar for the headlines feed. PURE + node-testable.
//
// Supported:
//   plain words   → all required (implicit AND)
//   "quoted"      → exact phrase (spaces preserved)
//   -term / -"…"  → exclude
//   OR            → separates alternative AND-groups (uppercase, standalone)
//   AND           → optional, ignored (AND is already implicit between terms)
//
// A text matches when ANY OR-group matches; a group matches when every include
// term is present and no exclude term is. An empty query matches everything.

export interface QueryGroup {
  include: string[];
  exclude: string[];
}
export interface Query {
  groups: QueryGroup[];
  raw: string;
}

interface Token {
  type: "or" | "term";
  text?: string;
  negate?: boolean;
}

function tokenize(raw: string): Token[] {
  const tokens: Token[] = [];
  const s = raw ?? "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    let negate = false;
    if (ch === "-") {
      // A leading '-' negates the following word/phrase (but "-" alone is literal).
      const next = s[i + 1];
      if (next && next !== " ") {
        negate = true;
        i++;
      }
    }
    if (s[i] === '"') {
      // Quoted phrase — read until the closing quote (or end of string).
      const end = s.indexOf('"', i + 1);
      const text = end === -1 ? s.slice(i + 1) : s.slice(i + 1, end);
      i = end === -1 ? s.length : end + 1;
      if (text.trim()) tokens.push({ type: "term", text: text.trim(), negate });
      continue;
    }
    // Bare word — read until whitespace.
    let j = i;
    while (j < s.length && s[j] !== " " && s[j] !== "\t" && s[j] !== "\n") j++;
    const word = s.slice(i, j);
    i = j;
    if (!word) continue;
    if (!negate && word === "OR") tokens.push({ type: "or" });
    else if (!negate && word === "AND") continue; // implicit — ignore
    else tokens.push({ type: "term", text: word, negate });
  }
  return tokens;
}

/** Pure: raw query string → a normalised group structure. */
export function parseQuery(raw: string): Query {
  const groups: QueryGroup[] = [];
  let cur: QueryGroup = { include: [], exclude: [] };
  let has = false;
  for (const t of tokenize(raw)) {
    if (t.type === "or") {
      if (has) {
        groups.push(cur);
        cur = { include: [], exclude: [] };
        has = false;
      }
      continue;
    }
    has = true;
    if (t.negate) cur.exclude.push(t.text!);
    else cur.include.push(t.text!);
  }
  if (has) groups.push(cur);
  return { groups, raw: raw ?? "" };
}

/** Pure: does `text` satisfy the query? Empty query → true. */
export function matchQuery(q: Query, text: string): boolean {
  if (q.groups.length === 0) return true;
  const hay = (text ?? "").toLowerCase();
  return q.groups.some((g) => {
    for (const inc of g.include) if (!hay.includes(inc.toLowerCase())) return false;
    for (const exc of g.exclude) if (hay.includes(exc.toLowerCase())) return false;
    return true;
  });
}

/** Convenience: filter items by a raw query over a caller-supplied text projection. */
export function filterByQuery<T>(items: T[], raw: string, text: (t: T) => string): T[] {
  const q = parseQuery(raw);
  if (q.groups.length === 0) return items;
  return items.filter((it) => matchQuery(q, text(it)));
}
