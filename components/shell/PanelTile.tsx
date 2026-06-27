"use client";
// A workspace dock tile: a titled frame around a docked panel. The header doubles
// as react-grid-layout's drag handle (class .tn-tile-drag) but ONLY in edit mode,
// so tiles are static while you read and draggable-by-header while you arrange.
import type { ReactNode } from "react";

export default function PanelTile({
  title,
  editing,
  children,
}: {
  title: string;
  editing: boolean;
  children: ReactNode;
}) {
  return (
    <div className="tn-tile">
      <div className={`tn-tile-head${editing ? " tn-tile-drag" : ""}`}>
        <span className="tn-tile-title">{title}</span>
        {editing && <span className="tn-tile-grip" aria-hidden>⠿</span>}
      </div>
      <div className="tn-tile-body">{children}</div>
    </div>
  );
}
