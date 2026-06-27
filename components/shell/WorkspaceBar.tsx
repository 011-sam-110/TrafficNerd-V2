"use client";
// The workspace dock's toolbar, mounted next to the variant switcher. Off by
// default (a single "⊞ Workspace" affordance). Open → Edit layout / Reset / close.
// Editing → Save (commit the draft) / Cancel (discard). Drives workspaceStore +
// variantStore; the dock itself is DockableWorkspace.
import { useVariant, variantStore } from "@/lib/variants/store";
import { useWorkspace, workspaceStore } from "@/lib/shell/workspace";

export default function WorkspaceBar() {
  const { activeId } = useVariant();
  const ws = useWorkspace();

  if (!ws.open) {
    return (
      <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.openWorkspace()}>
        ⊞ Workspace
      </button>
    );
  }

  return (
    <div className="tn-ws-bar">
      {ws.editing ? (
        <>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.saveEdit(activeId)}>
            Save
          </button>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.cancelEdit()}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <button type="button" className="tn-ws-btn" onClick={() => workspaceStore.beginEdit(activeId)}>
            Edit layout
          </button>
          <button type="button" className="tn-ws-btn" onClick={() => variantStore.resetLayout(activeId)}>
            Reset
          </button>
          <button
            type="button"
            className="tn-ws-btn"
            onClick={() => workspaceStore.closeWorkspace()}
            aria-label="Close workspace"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
