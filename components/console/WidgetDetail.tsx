"use client";
// Renders the focused widget on the center stage: a header (back-to-map + title)
// plus the widget's bespoke `detail` component, or a generic fallback (the normal
// widget body at full size) so no expand button is ever dead.
import type { WidgetInstance } from "@/lib/console/types";
import { getWidgetType, type WidgetType } from "@/lib/console/registry";
import { shellLayoutStore } from "@/lib/console/store";

export default function WidgetDetail({ instance }: { instance: WidgetInstance }) {
  const type = getWidgetType(instance.type);
  if (!type) return null;
  const Detail = type.detail;
  return (
    <div className="tn-detail" role="region" aria-label={`${type.title} — expanded`}>
      <header className="tn-detail-head">
        <button className="tn-detail-back" onClick={() => shellLayoutStore.unfocus()}>← Back to map</button>
        <span className="tn-detail-icon" aria-hidden>{type.icon}</span>
        <span className="tn-detail-title">{type.title}</span>
      </header>
      <div className="tn-detail-body">
        {Detail
          ? <Detail instanceId={instance.id} config={instance.config} />
          : <GenericDetail type={type} instance={instance} />}
      </div>
    </div>
  );
}

function GenericDetail({ type, instance }: { type: WidgetType; instance: WidgetInstance }) {
  const Body = type.component; // report() falls back to the no-op default context — safe here
  return <div className="tn-detail-generic"><Body instanceId={instance.id} config={instance.config} /></div>;
}
