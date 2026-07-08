"use client";
// ⌘K / Ctrl-K command palette — search-and-jump plus quick layer control. A calm,
// keyboard-first way to compose the view: toggle a layer, apply a preset, switch
// basemap, or fly to a covered region. Open/close is owned by ConsoleShell.

import { useEffect, useMemo, useRef, useState } from "react";
import { layersStore, LAYER_PRESETS, ACTIVE_LAYERS, type LayerKey } from "@/lib/layers";
import { mapViewStore } from "@/lib/mapView";
import { BASEMAPS, type BasemapKey } from "@/lib/basemaps";
import { CAMERA_REGIONS } from "@/lib/icons/svg";
import { cinematic } from "@/lib/cinematic/store";
import { pickLiveCamera } from "@/lib/cinematic/livePick";
import { loadedCamerasStore } from "@/lib/cameras/loaded";
import "@/lib/console/widgets";
import { widgetsByCategory } from "@/lib/console/registry";
import { shellLayoutStore } from "@/lib/console/store";
import type { StageId } from "@/lib/console/types";
import { listPresets, applyPreset, saveCustomPreset } from "@/lib/console/presets";
import { encodeLayout } from "@/lib/console/share";
import type { GeocodeResult } from "@/lib/geo/geocode";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

// Pick a fly-to zoom from a geocode result's extent (wider areas frame out).
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

const LAYER_NAMES: Record<LayerKey, string> = {
  cameras: "Cameras",
  planes: "Planes",
  satellites: "Satellites",
  ships: "Ships",
  webcams: "Webcams",
  weather: "Weather",
  countries: "Borders & names",
};

function alertCapacity() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("tn-toast", { detail: "50-widget limit — remove one to add another" }));
}

function buildCommands(close: () => void): Command[] {
  const cmds: Command[] = [];

  for (const k of ACTIVE_LAYERS) {
    cmds.push({
      id: `toggle-${k}`,
      label: `Toggle ${LAYER_NAMES[k]}`,
      hint: "layer",
      run: () => {
        layersStore.toggle(k);
        close();
      },
    });
  }

  for (const p of LAYER_PRESETS) {
    cmds.push({
      id: `preset-${p.id}`,
      label: `Preset: ${p.label}`,
      hint: "preset",
      run: () => {
        layersStore.applyPreset(p.id);
        close();
      },
    });
  }

  for (const k of Object.keys(BASEMAPS) as BasemapKey[]) {
    cmds.push({
      id: `basemap-${k}`,
      label: `Basemap: ${BASEMAPS[k].label}`,
      hint: "view",
      run: () => {
        mapViewStore.setBasemap(k);
        close();
      },
    });
  }

  for (const r of CAMERA_REGIONS) {
    if (!r.view) continue;
    const view = r.view;
    cmds.push({
      id: `jump-${r.source}`,
      label: `Fly to ${r.label}`,
      hint: "jump",
      run: () => {
        mapViewStore.flyTo(view);
        close();
      },
    });
  }

  cmds.push({
    id: "dive-live",
    label: "Dive to a live feed",
    hint: "live",
    run: () => {
      const cam = pickLiveCamera(loadedCamerasStore.get());
      if (cam) {
        cinematic.dive({
          kind: "camera",
          id: cam.id,
          lat: cam.lat,
          lon: cam.lon,
          label: cam.name,
          meta: { available: true },
        });
      }
      close();
    },
  });

  for (const group of widgetsByCategory()) {
    for (const t of group.types) {
      const openCount = shellLayoutStore.get().widgets.filter((w) => w.type === t.id).length;
      cmds.push({
        id: `add-${t.id}`,
        label: `Add ${t.title}${openCount ? ` (${openCount} open)` : ""}`,
        hint: group.category.toLowerCase(),
        run: () => { const r = shellLayoutStore.add(t.id, { config: { ...t.defaultConfig }, height: t.defaultHeight }); if (!r.ok) alertCapacity(); close(); },
      });
    }
  }

  const STAGES: { id: StageId; label: string }[] = [{ id: "map3d", label: "3D map" }, { id: "map2d", label: "2D map" }, { id: "clock", label: "World clock" }];
  for (const s of STAGES) cmds.push({ id: `stage-${s.id}`, label: `Stage → ${s.label}`, hint: "stage", run: () => { shellLayoutStore.stage(s.id); close(); } });

  for (const p of listPresets()) cmds.push({ id: `cpreset-${p.id}`, label: `Preset: ${p.title}`, hint: "preset", run: () => { applyPreset(p.id); close(); } });
  cmds.push({ id: "save-preset", label: "Save layout as preset…", hint: "preset", run: () => { const t = window.prompt("Preset name?"); if (t) saveCustomPreset(t); close(); } });
  cmds.push({ id: "share-layout", label: "Copy shareable link", hint: "share", run: () => { const url = `${location.origin}${location.pathname}?c=${encodeLayout(shellLayoutStore.get())}`; navigator.clipboard?.writeText(url); close(); } });

  return cmds;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => buildCommands(onClose), [onClose]);

  // Live place search: any query ≥2 chars also geocodes (keyless Photon via
  // /api/geocode) so you can fly to ANY place (Kyiv, Gaza…), not just the
  // hardcoded camera regions. Debounced; latest query wins; failures are silent.
  const [geo, setGeo] = useState<GeocodeResult[]>([]);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setGeo([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => { if (alive) setGeo(((d.results as GeocodeResult[]) ?? []).slice(0, 5)); })
        .catch(() => { if (alive) setGeo([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.includes(q)) : commands;
    const geoCmds: Command[] = geo.map((r) => ({
      id: `geo-${r.lat},${r.lon}`,
      label: `Fly to ${r.name}`,
      hint: r.type || "place",
      run: () => { mapViewStore.flyToPoint({ lat: r.lat, lon: r.lon, zoom: zoomForResult(r) }); onClose(); },
    }));
    return [...base, ...geoCmds];
  }, [commands, query, geo, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[active]?.run();
    }
  };

  return (
    <div className="tn-palette-root" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="tn-palette-backdrop" onClick={onClose} />
      <div className="tn-palette" onKeyDown={onKey}>
        <input
          ref={inputRef}
          className="tn-palette-input"
          placeholder="Search layers, presets, basemaps — or fly to any place…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Command search"
        />
        <ul className="tn-palette-list" role="listbox">
          {results.length === 0 ? (
            <li className="tn-palette-empty">No matching commands</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === active}
                className={`tn-palette-item${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => c.run()}
              >
                <span>{c.label}</span>
                <span className="tn-palette-hint">{c.hint}</span>
              </li>
            ))
          )}
        </ul>
        <div className="tn-palette-foot">
          <span><span className="tn-kbd">↑↓</span> navigate</span>
          <span><span className="tn-kbd">↵</span> run</span>
          <span><span className="tn-kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
