// components/shell/ScopeControl.tsx
"use client";
// The global Scope control. World / Near-me / Region — drives scopeStore (the feed
// + map relevance) and flies the map to the chosen centre. Geolocation is requested
// ONLY on an explicit "Near me" click (never on load); denial falls back to World
// with a calm note. Region reuses the keyless /api/geocode used by PlaceSearch.

import { useCallback, useEffect, useRef, useState } from "react";
import { scopeStore, useScope, WORLD_SCOPE, DEFAULT_RADIUS_KM, radiusFromBbox } from "@/lib/shell/scope";
import { mapViewStore } from "@/lib/mapView";
import type { GeocodeResult } from "@/lib/geo/geocode";

export default function ScopeControl() {
  const scope = useScope();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const reqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setNote(null);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close]);

  // Debounced region search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      const myReq = ++reqRef.current;
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (myReq !== reqRef.current) return;
          setResults((d.results as GeocodeResult[]) ?? []);
        })
        .catch(() => {
          if (myReq === reqRef.current) setResults([]);
        });
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const setWorld = () => {
    scopeStore.set(WORLD_SCOPE);
    close();
  };

  const setRegion = (r: GeocodeResult) => {
    const radiusKm = r.bbox ? radiusFromBbox(r.bbox) : DEFAULT_RADIUS_KM;
    scopeStore.set({ mode: "region", center: { lat: r.lat, lon: r.lon }, radiusKm, label: r.name });
    mapViewStore.flyToPoint({ lat: r.lat, lon: r.lon, zoom: 8 });
    close();
  };

  const setNearMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("Location isn't available in this browser.");
      return;
    }
    setNote("Finding your location…");
    const myReq = ++reqRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (myReq !== reqRef.current) return;
        const { latitude, longitude } = pos.coords;
        scopeStore.set({
          mode: "near-me",
          center: { lat: latitude, lon: longitude },
          radiusKm: DEFAULT_RADIUS_KM,
          label: "Near me",
        });
        mapViewStore.flyToPoint({ lat: latitude, lon: longitude, zoom: 8 });
        close();
      },
      () => {
        if (myReq !== reqRef.current) return;
        setNote("Location denied — still showing World. Search a region instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="tn-scope" ref={rootRef}>
      <button
        type="button"
        className="tn-scope-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden>◎</span> {scope.label}
        <span className="tn-scope-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="tn-scope-menu" role="menu">
          <button type="button" className="tn-scope-item" role="menuitem" onClick={setNearMe}>
            Near me
          </button>
          <button type="button" className="tn-scope-item" role="menuitem" onClick={setWorld}>
            World
          </button>
          <div className="tn-scope-region">
            <input
              className="tn-scope-input"
              type="search"
              placeholder="Region — search a place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Scope to a region"
            />
            {results.length > 0 && (
              <div className="tn-scope-results" role="listbox">
                {results.map((r) => (
                  <button
                    key={`${r.name}:${r.lat},${r.lon}`}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="tn-scope-result"
                    onClick={() => setRegion(r)}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {note && <p className="tn-scope-note">{note}</p>}
        </div>
      )}
    </div>
  );
}
