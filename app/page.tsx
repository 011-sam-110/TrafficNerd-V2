"use client";
import dynamic from "next/dynamic";
import { FeedOverlay } from "@/components/FeedOverlay";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });

export default function Home() {
  return (
    <main className="globe">
      <GlobeView />
      <FeedOverlay />
    </main>
  );
}
