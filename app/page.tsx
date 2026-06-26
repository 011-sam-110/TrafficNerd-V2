"use client";
import dynamic from "next/dynamic";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });

export default function Home() {
  return (
    <main className="globe">
      <GlobeView />
    </main>
  );
}
