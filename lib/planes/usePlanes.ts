"use client";

import { useState, useEffect, useRef } from "react";
import type { WorldObject } from "@/lib/world";
import { planeToWorldObject } from "@/lib/sources/opensky";
import type { Plane } from "@/lib/sources/opensky";

const POLL_INTERVAL_MS = 15_000;

interface PlanesResponse {
  count: number;
  planes: Plane[];
}

/**
 * React hook that polls /api/planes every 15 s and returns live aircraft as
 * {@link WorldObject} arrays ready for the globe layer.
 *
 * - Fetches once immediately on mount.
 * - On fetch/parse error it silently keeps the last good dataset.
 * - Clears the polling interval on unmount.
 */
export function usePlanes(): WorldObject[] {
  const [objects, setObjects] = useState<WorldObject[]>([]);
  // Keep a ref so the error-path closure always sees the latest good data
  const lastGoodRef = useRef<WorldObject[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/planes");
        if (!res.ok) return; // keep last good
        const data = (await res.json()) as PlanesResponse;
        const mapped = data.planes.map(planeToWorldObject);
        if (!cancelled) {
          lastGoodRef.current = mapped;
          setObjects(mapped);
        }
      } catch {
        // Network error or JSON parse failure — keep last good data
        if (!cancelled) {
          setObjects(lastGoodRef.current);
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return objects;
}
