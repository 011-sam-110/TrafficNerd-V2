"use client";
import ConsoleShell from "@/components/shell/ConsoleShell";

// The map now lives in the console's centre stage (StageHost), so the page just
// mounts the shell; the heavy client-only canvas is dynamically imported there.
export default function Home() {
  return (
    <main className="tn-shell-main">
      <ConsoleShell />
    </main>
  );
}
