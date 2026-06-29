// components/shell/ConsoleTopBar.tsx
"use client";
// The console's floating control cluster, under the status bar (the established
// "floating chrome over a full-bleed map" idiom — cf. PlaceSearch). Holds the
// global Scope control, the shared time-window, and the Console⇄Explore toggle.

import ScopeControl from "@/components/shell/ScopeControl";
import TimeWindowControl from "@/components/shell/TimeWindowControl";
import { viewModeStore } from "@/lib/shell/viewMode";

export default function ConsoleTopBar() {
  return (
    <div className="tn-console-topbar">
      <ScopeControl />
      <TimeWindowControl />
      <button
        type="button"
        className="tn-console-explore"
        onClick={() => viewModeStore.set("explore")}
        title="Switch to the 3D globe"
      >
        <span aria-hidden>🌐</span> Explore
      </button>
    </div>
  );
}
