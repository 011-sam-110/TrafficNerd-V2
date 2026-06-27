"use client";
import dynamic from "next/dynamic";
import ConsoleShell from "@/components/shell/ConsoleShell";

// The map is a heavy client-only canvas (MapLibre + globe projection); keep it
// out of SSR. The calm shell chrome around it renders server-side fine.
const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Home() {
  return (
    <main className="tn-shell-main">
      <ConsoleShell>
        <WorldMap />
      </ConsoleShell>
    </main>
  );
}
