// components/console/Segment.tsx
"use client";
import type { SegmentId } from "@/lib/console/types";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import { widgetsInSegment } from "@/lib/console/reducers";
import { dropIndex } from "@/lib/console/resize";
import WidgetFrame from "@/components/console/WidgetFrame";

export default function Segment({ id }: { id: SegmentId }) {
  const layout = useShellLayout();
  const widgets = widgetsInSegment(layout, id);
  const onDrop = (e: React.DragEvent) => {
    const wid = e.dataTransfer.getData("text/tn-widget");
    if (!wid) return;
    e.preventDefault();
    const cards = ([...e.currentTarget.querySelectorAll("[data-widget-id]")] as HTMLElement[])
      .filter((c) => c.dataset.widgetId !== wid);
    const rects = cards.map((c) => c.getBoundingClientRect());
    const idx = dropIndex({ x: e.clientX, y: e.clientY }, rects);
    shellLayoutStore.move(wid, id, idx);
  };
  return (
    <div className="tn-seg" data-segment={id}
         onDragOver={(e) => { if (e.dataTransfer.types.includes("text/tn-widget")) e.preventDefault(); }}
         onDrop={onDrop}>
      {widgets.length === 0 && <p className="tn-seg-empty">Drop a widget here, or add one with ⌘K</p>}
      {widgets.map((w) => (
        <div key={w.id} data-widget-id={w.id} className="tn-seg-slot" style={{ gridColumn: `span ${w.width}` }}>
          <WidgetFrame instance={w} />
        </div>
      ))}
    </div>
  );
}
