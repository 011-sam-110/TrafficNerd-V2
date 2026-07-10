"use client";
// The central place-search bar floated over the top-centre of the globe. Type a
// place → keyless Photon geocode (debounced) → pick a match → it drops a PIN there
// and flies the camera to it. Pins accumulate (see lib/map/pins) and are walked with
// the PinNavigator; you can also drop one by right-clicking the map. Calm .tn-* look;
// dormant-safe (a flaky geocoder shows an inline note, never throws).

import { useCallback, useEffect, useRef, useState } from "react";
import { mapViewStore } from "@/lib/mapView";
import { pinsStore } from "@/lib/map/pins";
import type { GeocodeResult } from "@/lib/geo/geocode";

const DEBOUNCE_MS = 350; // keeps us under the community geocoder's ~1 req/s

// Choose a fly-to zoom from a result's extent: wide areas frame out, points zoom in.
function zoomForResult(r: GeocodeResult): number {
  if (!r.bbox) return 11;
  const [w, s, e, n] = r.bbox;
  const span = Math.max(Math.abs(e - w), Math.abs(n - s));
  if (span > 4) return 5;
  if (span > 1) return 7;
  if (span > 0.2) return 9;
  if (span > 0.04) return 11;
  return 13;
}

export default function MapSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const reqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    reqRef.current++;
    setOpen(false);
    setStatus(null);
  }, []);

  // Debounced geocode.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setStatus(null);
      return;
    }
    const t = setTimeout(() => {
      const myReq = ++reqRef.current;
      setOpen(true);
      setStatus("Searching…");
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (myReq !== reqRef.current) return;
          const rs = (d.results as GeocodeResult[]) ?? [];
          setResults(rs);
          setStatus(rs.length ? null : "No matching places.");
        })
        .catch(() => {
          if (myReq !== reqRef.current) return;
          setResults([]);
          setStatus("Search is unavailable right now.");
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close]);

  const pick = (r: GeocodeResult) => {
    pinsStore.add(r.lat, r.lon, r.name); // drop a pin + make it active
    mapViewStore.flyToPoint({ lat: r.lat, lon: r.lon, zoom: zoomForResult(r) });
    setQuery("");
    setResults([]);
    close();
  };

  return (
    <div className="tn-mapsearch" ref={rootRef}>
      <div className="tn-mapsearch-bar">
        <span className="tn-mapsearch-icon" aria-hidden>⌕</span>
        <input
          className="tn-mapsearch-input"
          type="search"
          placeholder="Search a place — drop a pin"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); close(); }
            else if (e.key === "Enter" && results[0]) { e.preventDefault(); pick(results[0]); }
          }}
          aria-label="Search for a place and drop a pin"
        />
      </div>

      {open && (results.length > 0 || status != null) && (
        <div className="tn-mapsearch-results" role="listbox" aria-label="Search results">
          {results.map((r) => (
            <button
              key={`${r.name}:${r.lat},${r.lon}`}
              type="button"
              role="option"
              aria-selected={false}
              className="tn-mapsearch-item"
              onClick={() => pick(r)}
            >
              <span className="tn-mapsearch-item-pin" aria-hidden>📍</span>
              <span className="tn-mapsearch-item-name">{r.name}</span>
              {r.type && <span className="tn-mapsearch-item-meta">{r.type}</span>}
            </button>
          ))}
          {status && <div className="tn-mapsearch-status">{status}</div>}
        </div>
      )}
    </div>
  );
}
