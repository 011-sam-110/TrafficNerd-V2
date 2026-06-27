"use client";
// Near-me + search (M5). A calm floating control under the status bar:
//   • type a place → keyless Photon geocode (debounced) → list matches → fly there
//   • "Near me" → geolocate (ONLY on click) → fly to you + list the nearest cameras
//     (click → opens that camera's dossier)
// Geolocation is never requested on load; any denial/failure shows a calm inline
// note and never throws. Styling reuses the .tn-* calm-light tokens.

import { useCallback, useEffect, useRef, useState } from "react";
import { mapViewStore } from "@/lib/mapView";
import { overlay } from "@/lib/overlay";
import type { GeocodeResult } from "@/lib/geo/geocode";

type NearCamera = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  available: boolean;
  source: string;
  live: boolean;
  km: number;
};

type View = "none" | "places" | "nearby";

const DEBOUNCE_MS = 350; // also keeps us comfortably under the geocoder's ~1 req/s

// Choose a fly-to zoom from a result's extent: wider areas frame out, points zoom in.
function zoomForResult(r: GeocodeResult): number {
  if (!r.bbox) return 12;
  const [w, s, e, n] = r.bbox;
  const span = Math.max(Math.abs(e - w), Math.abs(n - s));
  if (span > 4) return 5;
  if (span > 1) return 7;
  if (span > 0.2) return 9;
  if (span > 0.04) return 11;
  return 13;
}

export default function PlaceSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [nearby, setNearby] = useState<NearCamera[]>([]);
  const [view, setView] = useState<View>("none");
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Monotonic request id: guards both geocode and near-me against out-of-order /
  // superseded responses (the latest user action always wins).
  const reqRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    reqRef.current++; // invalidate any in-flight response
    setView("none");
    setStatus(null);
  }, []);

  // Debounced place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setView("none");
      setStatus(null);
      return;
    }
    const t = setTimeout(() => {
      const myReq = ++reqRef.current;
      setView("places");
      setStatus("Searching…");
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => {
          if (myReq !== reqRef.current) return; // a newer action superseded this
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

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [close]);

  const selectPlace = (r: GeocodeResult) => {
    mapViewStore.flyToPoint({ lat: r.lat, lon: r.lon, zoom: zoomForResult(r) });
    close();
  };

  const openCamera = (c: NearCamera) => {
    mapViewStore.flyToPoint({ lat: c.lat, lon: c.lon, zoom: 13 });
    overlay.open({
      kind: "camera",
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      label: c.name,
      meta: { available: c.available },
    });
  };

  // Geolocate ONLY here, on explicit click.
  const locate = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setView("nearby");
      setStatus("Location isn't available in this browser.");
      return;
    }
    setLocating(true);
    setView("nearby");
    setNearby([]);
    setStatus("Finding your location…");
    const myReq = ++reqRef.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (myReq !== reqRef.current) return;
        const { latitude, longitude } = pos.coords;
        mapViewStore.flyToPoint({ lat: latitude, lon: longitude, zoom: 11 });
        setStatus("Finding the nearest cameras…");
        fetch(`/api/near?lat=${latitude}&lon=${longitude}&n=8`)
          .then((r) => r.json())
          .then((d) => {
            if (myReq !== reqRef.current) return;
            const cams = (d.cameras as NearCamera[]) ?? [];
            setNearby(cams);
            setLocating(false);
            setStatus(cams.length ? null : "No cameras found near you.");
          })
          .catch(() => {
            if (myReq !== reqRef.current) return;
            setNearby([]);
            setLocating(false);
            setStatus("Couldn't load nearby cameras.");
          });
      },
      (err) => {
        if (myReq !== reqRef.current) return;
        setLocating(false);
        setNearby([]);
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can still search by place above."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your location is unavailable right now."
              : err.code === err.TIMEOUT
                ? "Locating timed out — try again."
                : "Couldn't get your location.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const hasItems =
    (view === "places" && results.length > 0) || (view === "nearby" && nearby.length > 0);
  const showDropdown = hasItems || status != null;

  return (
    <div className="tn-explore" ref={rootRef}>
      <div className="tn-explore-bar">
        <span className="tn-explore-icon" aria-hidden>
          ⌕
        </span>
        <input
          className="tn-explore-input"
          type="search"
          placeholder="Search a place…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
          aria-label="Search for a place"
        />
        <button
          type="button"
          className="tn-explore-locate"
          onClick={locate}
          disabled={locating}
          title="Find cameras near me"
        >
          <span aria-hidden>◎</span>
          <span className="tn-explore-locate-label">{locating ? "Locating…" : "Near me"}</span>
        </button>
      </div>

      {showDropdown && (
        <div className="tn-explore-results" role="listbox" aria-label="Search results">
          {view === "places" &&
            results.map((r) => (
              <button
                key={`${r.name}:${r.lat},${r.lon}`}
                type="button"
                role="option"
                aria-selected={false}
                className="tn-explore-item"
                onClick={() => selectPlace(r)}
              >
                <span className="tn-explore-item-main">
                  <span className="tn-explore-item-name">{r.name}</span>
                </span>
                {r.type && <span className="tn-explore-item-meta">{r.type}</span>}
              </button>
            ))}

          {view === "nearby" &&
            nearby.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={false}
                className="tn-explore-item"
                onClick={() => openCamera(c)}
              >
                <span className="tn-explore-item-main">
                  <span
                    className={`tn-explore-dot${c.available ? " on" : ""}`}
                    aria-hidden
                  />
                  <span className="tn-explore-item-name">{c.name}</span>
                </span>
                <span className="tn-explore-item-meta tn-num">{c.km.toFixed(1)} km</span>
              </button>
            ))}

          {status && <div className="tn-explore-status">{status}</div>}
        </div>
      )}
    </div>
  );
}
