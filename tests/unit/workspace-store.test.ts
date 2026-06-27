import { describe, it, expect, beforeEach } from "vitest";
import { workspaceStore } from "@/lib/shell/workspace";
import { variantStore } from "@/lib/variants/store";
import { BUILTIN_BY_ID } from "@/lib/variants/builtins";

describe("workspaceStore", () => {
  beforeEach(() => {
    workspaceStore.closeWorkspace();
    variantStore.resetLayout("markets");
  });

  it("open/close + begin-edit snapshots the current layout into the draft", () => {
    workspaceStore.openWorkspace();
    expect(workspaceStore.get().open).toBe(true);
    workspaceStore.beginEdit("markets");
    expect(workspaceStore.get().editing).toBe(true);
    expect(workspaceStore.get().draft).toEqual(BUILTIN_BY_ID["markets"].panels);
  });

  it("saveEdit commits the draft to variantStore + exits edit", () => {
    workspaceStore.openWorkspace();
    workspaceStore.beginEdit("markets");
    const moved = BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 2 } }));
    workspaceStore.updateDraft(moved);
    workspaceStore.saveEdit("markets");
    expect(workspaceStore.get().editing).toBe(false);
    expect(workspaceStore.get().draft).toBeNull();
    expect(variantStore.layoutForVariant("markets")).toEqual(moved);
  });

  it("cancelEdit discards the draft (no commit)", () => {
    workspaceStore.openWorkspace();
    workspaceStore.beginEdit("markets");
    workspaceStore.updateDraft(
      BUILTIN_BY_ID["markets"].panels.map((p) => ({ ...p, grid: { ...p.grid, x: 9 } })),
    );
    workspaceStore.cancelEdit();
    expect(workspaceStore.get().draft).toBeNull();
    expect(variantStore.layoutForVariant("markets")).toEqual(BUILTIN_BY_ID["markets"].panels);
  });

  it("updateDraft is a no-op when not editing", () => {
    workspaceStore.openWorkspace();
    workspaceStore.updateDraft(BUILTIN_BY_ID["markets"].panels);
    expect(workspaceStore.get().draft).toBeNull();
  });
});
