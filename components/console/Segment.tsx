// components/console/Segment.tsx
"use client";
import type { SegmentId } from "@/lib/console/types";
import { useShellLayout, shellLayoutStore } from "@/lib/console/store";
import { widgetsInSegment } from "@/lib/console/reducers";
import WidgetFrame from "@/components/console/WidgetFrame";

export default function Segment({ id }: { id: SegmentId }) {
  const layout = useShellLayout();
  const widgets = widgetsInSegment(layout, id);
  const onDrop = (e: React.DragEvent) => {
    const wid = e.dataTransfer.getData("text/tn-widget");
    if (!wid) return;
    e.preventDefault();
    // index = position of the card the pointer is over, else append
    const cards = [...e.currentTarget.querySelectorAll("[data-widget-id]")] as HTMLElement[];
    let idx = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { idx = i; break; }
    }
    shellLayoutStore.move(wid, id, idx);
  };
  return (
    <div className="tn-seg" data-segment={id}
         onDragOver={(e) => { if (e.dataTransfer.types.includes("text/tn-widget")) e.preventDefault(); }}
         onDrop={onDrop}>
      {widgets.length === 0 && <p className="tn-seg-empty">Drop a widget here, or add one with ⌘K</p>}
      {widgets.map((w) => (
        <div key={w.id} data-widget-id={w.id} className="tn-seg-slot"><WidgetFrame instance={w} /></div>
      ))}
    </div>
  );
}
