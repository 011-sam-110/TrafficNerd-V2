"use client";
import { useVariant, resolveVariant } from "@/lib/variants/store";
import { PANEL_REGISTRY, PERSISTENT_PANELS } from "@/lib/shell/panelRegistry";

export default function PanelHost() {
  const { activeId } = useVariant();
  const variant = resolveVariant(activeId);
  const visible = new Set(variant.panels.filter((p) => p.visible).map((p) => p.panel));
  return (
    <>
      {PERSISTENT_PANELS.filter((k) => visible.has(k)).map((k) => {
        const Cmp = PANEL_REGISTRY[k].component;
        return <Cmp key={k} />;
      })}
    </>
  );
}
