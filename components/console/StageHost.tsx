"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { StageId } from "@/lib/console/types";
import { viewModeStore } from "@/lib/shell/viewMode";
import { useShellLayout } from "@/lib/console/store";
import { getWidgetType } from "@/lib/console/registry";
import WorldClock from "@/components/console/WorldClock";
import WidgetDetail from "@/components/console/WidgetDetail";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function StageHost({ stage }: { stage: StageId }) {
  const { focusedWidgetId, widgets } = useShellLayout();
  // The map reads viewModeStore for its MapLibre projection: 3D=globe(explore), 2D=flat(console).
  useEffect(() => {
    if (stage === "map3d") viewModeStore.set("explore");
    else if (stage === "map2d") viewModeStore.set("console");
  }, [stage]);

  const focused = focusedWidgetId
    ? widgets.find((w) => w.id === focusedWidgetId && getWidgetType(w.type))
    : undefined;
  if (focused) return <WidgetDetail instance={focused} />;
  if (stage === "clock") return <WorldClock />;
  return <WorldMap />;
}
