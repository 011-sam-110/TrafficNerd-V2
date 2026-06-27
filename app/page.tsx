"use client";
import dynamic from "next/dynamic";
import { FeedOverlay } from "@/components/FeedOverlay";

const WorldMap = dynamic(() => import("@/components/WorldMap"), { ssr: false });

export default function Home() {
  return (
    <main className="globe">
      <WorldMap />
      <FeedOverlay />
    </main>
  );
}
