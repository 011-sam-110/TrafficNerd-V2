// components/console/WidgetFrame.tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import type { WidgetInstance } from "@/lib/console/types";
import { shellLayoutStore } from "@/lib/console/store";
import { spanFromPointer } from "@/lib/console/resize";
import { getWidgetType } from "@/lib/console/registry";
import { topSeverity, type Alert } from "@/lib/console/alerts";
import { WidgetErrorBoundary } from "@/components/console/WidgetErrorBoundary";
import { toCsv, toGeoJson, downloadText, exportFilename, type GeoPoint } from "@/lib/export";

interface Report {
  alerts: Alert[];
  count?: number;
  freshLabel?: string;
  /** Optional export payload — a widget hands its visible rows/points here and the
   *  frame menu offers CSV / GeoJSON downloads. */
  export?: { rows?: Record<string, unknown>[]; geo?: GeoPoint[]; name?: string };
}
const ReportCtx = createContext<(r: Report) => void>(() => {});
export function useWidgetReport() { return useContext(ReportCtx); }

export default function WidgetFrame({ instance }: { instance: WidgetInstance }) {
  const type = getWidgetType(instance.type);
  const [report, setReport] = useState<Report>({ alerts: [] });
  const [menuOpen, setMenuOpen] = useState(false);
  const onReport = useCallback((r: Report) => setReport(r), []);
  if (!type) return null;
  const Body = type.component;
  const sev = topSeverity(report.alerts);
  const cfg = instance.config ?? {};
  const alertStyle = (cfg.alertStyle as string) ?? "top"; // "top" | "feed"

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/tn-widget", instance.id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = instance.height;
    const move = (ev: PointerEvent) => shellLayoutStore.resizeWidget(instance.id, startH + (ev.clientY - startY));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const measureSeg = (target: HTMLElement) => {
    const seg = target.closest(".tn-seg") as HTMLElement | null;
    const slot = target.closest(".tn-seg-slot") as HTMLElement | null;
    if (!seg || !slot) return null;
    const cs = getComputedStyle(seg);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    return { slotLeft: slot.getBoundingClientRect().left, segWidth: seg.getBoundingClientRect().width - padL - padR };
  };
  const onResizeWidthPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const m = measureSeg(e.currentTarget as HTMLElement);
    if (!m) return;
    const move = (ev: PointerEvent) =>
      shellLayoutStore.resizeWidth(instance.id, spanFromPointer({ pointerX: ev.clientX, slotLeft: m.slotLeft, segWidth: m.segWidth }));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const onResizeCornerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const m = measureSeg(e.currentTarget as HTMLElement);
    const startY = e.clientY, startH = instance.height;
    const move = (ev: PointerEvent) => {
      shellLayoutStore.resizeWidget(instance.id, startH + (ev.clientY - startY));
      if (m) shellLayoutStore.resizeWidth(instance.id, spanFromPointer({ pointerX: ev.clientX, slotLeft: m.slotLeft, segWidth: m.segWidth }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <div className="tn-cw" data-widget-type={instance.type} style={{ maxHeight: instance.collapsed ? undefined : instance.height }}>
      <header className="tn-cw-head" draggable onDragStart={onDragStart}>
        <span className="tn-cw-icon">{type.icon}</span>
        <span className="tn-cw-title">{type.title}</span>
        {report.count != null && <span className="tn-cw-count">{report.count}</span>}
        <span className="tn-cw-sp" />
        {report.alerts.length > 0 && <span className={`tn-cw-badge tn-sev-${sev}`}>{report.alerts.length}</span>}
        {report.freshLabel && <span className="tn-cw-fresh">{report.freshLabel}</span>}
        <button className="tn-cw-expand" aria-label="Expand widget" title="Expand to main window" onClick={() => shellLayoutStore.focus(instance.id)}>⤢</button>
        <button className="tn-cw-menu" aria-label="Widget menu" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
      </header>

      {menuOpen && (
        <div className="tn-cw-menu-pop" role="menu">
          <button onClick={() => { const r = shellLayoutStore.add(instance.type, { config: { ...cfg } }); if (!r.ok) window.dispatchEvent(new CustomEvent("tn-toast", { detail: "50-widget limit — remove one to add another" })); setMenuOpen(false); }}>⧉ Duplicate</button>
          <button onClick={() => { shellLayoutStore.configure(instance.id, { alertStyle: alertStyle === "top" ? "feed" : "top" }); setMenuOpen(false); }}>
            ⚡ Alerts: {alertStyle === "top" ? "on top" : "in feed"}
          </button>
          {report.export?.rows && report.export.rows.length > 0 && (
            <button onClick={() => { const base = exportFilename(report.export!.name ?? instance.type, Date.now()); downloadText(`${base}.csv`, "text/csv", toCsv(report.export!.rows!)); setMenuOpen(false); }}>⬇ Export CSV</button>
          )}
          {report.export?.geo && report.export.geo.length > 0 && (
            <button onClick={() => { const base = exportFilename(report.export!.name ?? instance.type, Date.now()); downloadText(`${base}.geojson`, "application/geo+json", toGeoJson(report.export!.geo!)); setMenuOpen(false); }}>⬇ Export GeoJSON</button>
          )}
          <button className="tn-cw-danger" onClick={() => shellLayoutStore.remove(instance.id)}>✕ Remove</button>
        </div>
      )}

      {!instance.collapsed && (
        <>
          {alertStyle === "top" && report.alerts.length > 0 && (
            <div className="tn-cw-attn">
              <div className="tn-cw-attn-h">Needs attention · {report.alerts.length}</div>
              {report.alerts.slice(0, 4).map((a) => (
                <div key={a.id} className={`tn-cw-alert tn-sev-${a.severity}`}>{a.text}</div>
              ))}
            </div>
          )}
          <div className="tn-cw-body">
            {alertStyle === "feed" && report.alerts.length > 0 && (
              <div className="tn-cw-attn-feed">
                {report.alerts.slice(0, 4).map((a) => (
                  <div key={a.id} className={`tn-cw-alert tn-sev-${a.severity}`}>{a.text}</div>
                ))}
              </div>
            )}
            <WidgetErrorBoundary>
              <ReportCtx.Provider value={onReport}><Body instanceId={instance.id} config={cfg} /></ReportCtx.Provider>
            </WidgetErrorBoundary>
          </div>
          <div className="tn-cw-resize" onPointerDown={onResizePointerDown} title="Drag to resize height" />
          <div className="tn-cw-resize-x" onPointerDown={onResizeWidthPointerDown} title="Drag to resize width" />
          <div className="tn-cw-resize-xy" onPointerDown={onResizeCornerPointerDown} title="Drag to resize" />
        </>
      )}
    </div>
  );
}
