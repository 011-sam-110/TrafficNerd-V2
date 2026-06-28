"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { StageId } from "@/lib/console/types";
import { viewModeStore } from "@/lib/shell/viewMode";
import WorldClock from "@/components/console/WorldClock";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function StageHost({ stage }: { stage: StageId }) {
  // The map reads viewModeStore for its MapLibre projection: 3D=globe(explore), 2D=flat(console).
  useEffect(() => {
    if (stage === "map3d") viewModeStore.set("explore");
    else if (stage === "map2d") viewModeStore.set("console");
  }, [stage]);
  if (stage === "clock") return <WorldClock />;
  return <WorldMap />;
}
