"use client";
// Workspace dock state — opt-in, session-only (never persisted: every load starts
// on the calm SP1a shell). Holds the dock open/closed + the draft-commit editor:
// `beginEdit` snapshots the active variant's layout into `draft`, `updateDraft`
// captures react-grid-layout moves, `saveEdit` commits the draft to the variant's
// persisted layoutOverrides, `cancelEdit` throws it away. Framework-light external
// store, same shape as lib/shell/ui.ts.
import { useSyncExternalStore } from "react";
import type { PanelPlacement } from "@/lib/variants/types";
import { variantStore } from "@/lib/variants/store";

interface WorkspaceState {
  open: boolean;
  editing: boolean;
  draft: PanelPlacement[] | null;
}

let state: WorkspaceState = { open: false, editing: false, draft: null };
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export const workspaceStore = {
  openWorkspace() {
    if (state.open) return;
    state = { ...state, open: true };
    emit();
  },
  closeWorkspace() {
    state = { open: false, editing: false, draft: null };
    emit();
  },
  beginEdit(activeId: string) {
    state = { ...state, editing: true, draft: variantStore.layoutForVariant(activeId) };
    emit();
  },
  updateDraft(placements: PanelPlacement[]) {
    if (!state.editing) return;
    state = { ...state, draft: placements };
    emit();
  },
  saveEdit(activeId: string) {
    if (state.draft) variantStore.commitLayout(activeId, state.draft);
    state = { ...state, editing: false, draft: null };
    emit();
  },
  cancelEdit() {
    state = { ...state, editing: false, draft: null };
    emit();
  },
  get(): WorkspaceState {
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useWorkspace(): WorkspaceState {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.get, workspaceStore.get);
}
