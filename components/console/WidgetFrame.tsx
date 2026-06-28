// components/console/WidgetFrame.tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";
import type { WidgetInstance } from "@/lib/console/types";
import { shellLayoutStore } from "@/lib/console/store";
import { getWidgetType } from "@/lib/console/registry";
import { topSeverity, type Alert } from "@/lib/console/alerts";

interface Report { alerts: Alert[]; count?: number; freshLabel?: string }
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
  const alertStyle = (instance.config.alertStyle as string) ?? "top"; // "top" | "feed"

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

  return (
    <div className="tn-cw" data-widget-type={instance.type} style={{ height: instance.collapsed ? undefined : instance.height }}>
      <header className="tn-cw-head" draggable onDragStart={onDragStart}>
        <span className="tn-cw-icon">{type.icon}</span>
        <span className="tn-cw-title">{type.title}</span>
        {report.count != null && <span className="tn-cw-count">{report.count}</span>}
        <span className="tn-cw-sp" />
        {report.alerts.length > 0 && <span className={`tn-cw-badge tn-sev-${sev}`}>{report.alerts.length}</span>}
        {report.freshLabel && <span className="tn-cw-fresh">{report.freshLabel}</span>}
        <button className="tn-cw-menu" aria-label="Widget menu" onClick={() => setMenuOpen((o) => !o)}>⋯</button>
      </header>

      {menuOpen && (
        <div className="tn-cw-menu-pop" role="menu">
          <button onClick={() => { shellLayoutStore.add(instance.type, { config: { ...instance.config } }); setMenuOpen(false); }}>⧉ Duplicate</button>
          <button onClick={() => { shellLayoutStore.configure(instance.id, { alertStyle: alertStyle === "top" ? "feed" : "top" }); setMenuOpen(false); }}>
            ⚡ Alerts: {alertStyle === "top" ? "on top" : "in feed"}
          </button>
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
            <ReportCtx.Provider value={onReport}><Body instanceId={instance.id} config={instance.config} /></ReportCtx.Provider>
          </div>
          <div className="tn-cw-resize" onPointerDown={onResizePointerDown} title="Drag to resize" />
        </>
      )}
    </div>
  );
}
