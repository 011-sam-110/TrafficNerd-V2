"use client";
// Shared photo-geolocation state machine. Factored out of app/locate/page.tsx so the
// standalone /locate route, the console `locate` widget, and its focus view all drive
// the exact same upload → POST /api/geolocate → ranked-candidates flow from one place.
//
// Deliberately map-agnostic: the hook resolves candidates but never touches a map, so
// each caller decides what to do with a selection (the page pins its own inset map; the
// widget flies the shared globe via mapViewStore.flyToPoint). Dormant-safe — a failed or
// malformed response resolves to an inline error, never a throw.

import { useCallback, useEffect, useState } from "react";
import { parseGeolocateResponse } from "./response";
import type { GeolocateMethod, GeolocateResponse, ResolvedCandidate } from "./types";

export interface UseGeolocate {
  file: File | null;
  imageUrl: string;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
  result: GeolocateResponse | null;
  selected: number | null;
  candidates: ResolvedCandidate[];
  method?: GeolocateMethod;
  note?: string;
  canLocate: boolean;
  pickFile: (f: File | null) => void;
  onUrlChange: (v: string) => void;
  locate: () => Promise<void>;
  select: (i: number | null) => void;
  reset: () => void;
}

export function useGeolocate(): UseGeolocate {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeolocateResponse | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const candidates = result?.candidates ?? [];

  const pickFile = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setImageUrl("");
    setResult(null);
    setError(null);
    setSelected(null);
    setPreviewUrl((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
  }, []);

  const onUrlChange = useCallback((v: string) => {
    setImageUrl(v);
    setFile(null);
    setResult(null);
    setError(null);
    setSelected(null);
    setPreviewUrl((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return v.trim() ? v.trim() : null;
    });
  }, []);

  // Revoke any blob URL on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locate = useCallback(async () => {
    if (!file && !imageUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      const form = new FormData();
      if (file) form.append("image", file);
      else form.append("imageUrl", imageUrl.trim());

      const res = await fetch("/api/geolocate", { method: "POST", body: form });
      const body = parseGeolocateResponse(await res.json());
      setResult(body);
      if (body.candidates.length > 0) setSelected(0);
      else if (body.error) setError(body.error);
      else setError("No location could be estimated from this image.");
    } catch {
      setError("Could not reach the geolocation service. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [file, imageUrl]);

  const reset = useCallback(() => {
    setFile(null);
    setImageUrl("");
    setResult(null);
    setError(null);
    setSelected(null);
    setPreviewUrl((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return null;
    });
  }, []);

  return {
    file,
    imageUrl,
    previewUrl,
    loading,
    error,
    result,
    selected,
    candidates,
    method: result?.method,
    note: result?.note,
    canLocate: Boolean(file || imageUrl.trim()),
    pickFile,
    onUrlChange,
    locate,
    select: setSelected,
    reset,
  };
}
