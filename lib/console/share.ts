import type { ShellLayout } from "@/lib/console/types";

/** Compact, URL-safe encoding of a layout (base64 of JSON). */
export function encodeLayout(l: ShellLayout): string {
  const json = JSON.stringify(l);
  const b64 = typeof window === "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeLayout(s: string): ShellLayout | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof window === "undefined" ? Buffer.from(b64, "base64").toString("utf8") : decodeURIComponent(escape(atob(b64)));
    const l = JSON.parse(json) as ShellLayout;
    if (!l || typeof l !== "object" || !Array.isArray(l.widgets) || !l.segments || !l.stage) return null;
    return l;
  } catch { return null; }
}
