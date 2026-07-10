// components/console/ConsoleWorkspace.tsx
"use client";
import type { CSSProperties } from "react";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { SegmentId } from "@/lib/console/types";
import Segment from "@/components/console/Segment";
import StageHost from "@/components/console/StageHost";
import MapControls from "@/components/console/MapControls";

// Full-bleed console: the map is a 100%×100% base layer and the three widget
// segments FLOAT over it as translucent glass columns (the calm-glass identity the
// old rail/dossier used, restored). The segment widths + bottom height ride out as
// CSS vars (--tn-lw/--tn-rw/--tn-bh) so the absolute grips and the MapLibre controls
// can position themselves off the same numbers the columns use.

function VGrip({ seg, dir, cls }: { seg: SegmentId; dir: 1 | -1; cls: string }) {
  const layout = useShellLayout();
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startSize = layout.segments[seg].size;
    const move = (ev: PointerEvent) => shellLayoutStore.setSegment(seg, startSize + dir * (ev.clientX - startX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return <div className={`tn-grip ${cls}`} onPointerDown={onDown} role="separator" aria-orientation="vertical" />;
}

export default function ConsoleWorkspace() {
  const layout = useShellLayout();
  const w = (s: SegmentId) => (layout.segments[s].collapsed ? 0 : layout.segments[s].size);
  const lw = w("left"), rw = w("right");
  // The bottom dock reserves screen only when it holds widgets — otherwise the map
  // runs to the viewport bottom. When shown, its size is a max-height cap (hug-content).
  const bottomShown = !layout.segments.bottom.collapsed && layout.widgets.some((x) => x.segment === "bottom");
  const bh = bottomShown ? layout.segments.bottom.size : 0;
  const vars = { "--tn-lw": `${lw}px`, "--tn-rw": `${rw}px`, "--tn-bh": `${bh}px` } as CSSProperties;

  // Ambient map overlays (map-view controls, world clock) show only over a live map —
  // never when a widget is fullscreened onto the stage (focused) or on a non-map stage.
  const showMapOverlays = layout.focusedWidgetId == null && (layout.stage === "map3d" || layout.stage === "map2d");

  return (
    <div className="tn-cw-shell" style={vars}>
      <div className="tn-cw-stage">
        <StageHost stage={layout.stage} />
        {showMapOverlays && <MapControls />}
      </div>

      <div className="tn-cw-col tn-cw-col-left" style={{ width: lw }}><Segment id="left" /></div>
      <VGrip seg="left" dir={1} cls="tn-grip-l" />

      <div className="tn-cw-col tn-cw-col-right" style={{ width: rw }}><Segment id="right" /></div>
      <VGrip seg="right" dir={-1} cls="tn-grip-r" />

      {bottomShown && (
        <>
          <div className="tn-cw-bottom" style={{ maxHeight: layout.segments.bottom.size }}><Segment id="bottom" /></div>
          <div className="tn-grip tn-grip-b"
               onPointerDown={(e) => {
                 e.preventDefault();
                 const startY = e.clientY, start = layout.segments.bottom.size;
                 const move = (ev: PointerEvent) => shellLayoutStore.setSegment("bottom", start - (ev.clientY - startY));
                 const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                 window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
               }} role="separator" aria-orientation="horizontal" />
        </>
      )}
    </div>
  );
}
