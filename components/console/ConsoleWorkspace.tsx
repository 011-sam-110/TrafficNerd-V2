// components/console/ConsoleWorkspace.tsx
"use client";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import type { SegmentId } from "@/lib/console/types";
import Segment from "@/components/console/Segment";
import StageHost from "@/components/console/StageHost";

function VGrip({ seg, dir }: { seg: SegmentId; dir: 1 | -1 }) {
  const layout = useShellLayout();
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startSize = layout.segments[seg].size;
    const move = (ev: PointerEvent) => shellLayoutStore.setSegment(seg, startSize + dir * (ev.clientX - startX));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return <div className="tn-grip" onPointerDown={onDown} role="separator" aria-orientation="vertical" />;
}

export default function ConsoleWorkspace() {
  const layout = useShellLayout();
  const w = (s: SegmentId) => (layout.segments[s].collapsed ? 0 : layout.segments[s].size);
  // The bottom dock reserves screen only when it actually holds widgets. An empty
  // bottom segment used to leave a fixed 240px dead band under the map — now the map
  // fills the freed height. When shown, its size is a max-height cap (not a fixed
  // height) so the strip hugs its content instead of ballooning.
  const bottomShown = !layout.segments.bottom.collapsed && layout.widgets.some((x) => x.segment === "bottom");
  return (
    <div className="tn-cw-shell">
      <div className="tn-cw-col" style={{ width: w("left") }}><Segment id="left" /></div>
      <VGrip seg="left" dir={1} />
      <div className="tn-cw-center">
        <div className="tn-cw-stage"><StageHost stage={layout.stage} /></div>
        {bottomShown && (
          <>
            <div className="tn-grip tn-grip-h"
                 onPointerDown={(e) => {
                   e.preventDefault();
                   const startY = e.clientY, start = layout.segments.bottom.size;
                   const move = (ev: PointerEvent) => shellLayoutStore.setSegment("bottom", start - (ev.clientY - startY));
                   const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                   window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
                 }} role="separator" aria-orientation="horizontal" />
            <div className="tn-cw-bottom" style={{ maxHeight: layout.segments.bottom.size }}>
              <Segment id="bottom" />
            </div>
          </>
        )}
      </div>
      <VGrip seg="right" dir={-1} />
      <div className="tn-cw-col" style={{ width: w("right") }}><Segment id="right" /></div>
    </div>
  );
}
