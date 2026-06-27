"use client";
// ⌘K / Ctrl-K command palette — search-and-jump plus quick layer control. A calm,
// keyboard-first way to compose the view: toggle a layer, apply a preset, switch
// basemap, or fly to a covered region. Open/close is owned by ConsoleShell.

import { useEffect, useMemo, useRef, useState } from "react";
import { layersStore, LAYER_PRESETS, ACTIVE_LAYERS, type LayerKey } from "@/lib/layers";
import { mapViewStore } from "@/lib/mapView";
import { BASEMAPS, type BasemapKey } from "@/lib/basemaps";
import { coverageStore } from "@/lib/shell/coverage";
import { marketsStore } from "@/lib/shell/markets";
import { workspaceStore } from "@/lib/shell/workspace";
import { CAMERA_REGIONS } from "@/lib/icons/svg";
import { cinematic } from "@/lib/cinematic/store";
import { pickLiveCamera } from "@/lib/cinematic/livePick";
import { loadedCamerasStore } from "@/lib/cameras/loaded";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

const LAYER_NAMES: Record<LayerKey, string> = {
  cameras: "Cameras",
  planes: "Planes",
  satellites: "Satellites",
  ships: "Ships",
  webcams: "Webcams",
  weather: "Weather",
};

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
    id: "coverage",
    label: "Coverage details",
    hint: "info",
    run: () => {
      coverageStore.open();
      close();
    },
  });

  cmds.push({
    id: "markets",
    label: "Markets — crypto prices",
    hint: "panel",
    run: () => {
      marketsStore.open();
      close();
    },
  });

  cmds.push({
    id: "toggle-workspace",
    label: "Toggle workspace dock",
    hint: "layout",
    run: () => {
      const ws = workspaceStore.get();
      if (ws.open) workspaceStore.closeWorkspace();
      else workspaceStore.openWorkspace();
      close();
    },
  });

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

  return cmds;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(() => buildCommands(onClose), [onClose]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint.includes(q));
  }, [commands, query]);

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
          placeholder="Search layers, presets, basemaps, regions…"
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
