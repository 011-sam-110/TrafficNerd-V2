"use client";
import { useState, useEffect } from "react";
import { BUILTIN_VARIANTS } from "@/lib/variants/builtins";
import { variantStore, useVariant, resolveVariant } from "@/lib/variants/store";

export default function VariantSwitcher() {
  const { activeId, edited } = useVariant();
  const [open, setOpen] = useState(false);
  const active = resolveVariant(activeId);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <div className="tn-variant">
      <button type="button" className="tn-variant-pill" aria-haspopup="menu" aria-expanded={open}
        aria-label="Variant" onClick={() => setOpen((o) => !o)}>
        <span className="tn-variant-dot" style={{ background: active.accent }} aria-hidden />
        {active.title}{edited ? <span className="tn-variant-edited"> · edited</span> : null}
      </button>
      {open && (
        <ul className="tn-variant-menu" role="menu">
          {edited && (
            <li><button type="button" role="menuitem" className="tn-variant-reset"
              onClick={() => { variantStore.resetToVariant(); setOpen(false); }}>↺ Reset to {active.title}</button></li>
          )}
          {BUILTIN_VARIANTS.map((v) => (
            <li key={v.id}>
              <button type="button" role="menuitem" className={v.id === activeId ? "is-active" : ""} aria-current={v.id === activeId ? "true" : undefined}
                onClick={() => { variantStore.setActive(v.id); setOpen(false); }}>
                <span className="tn-variant-dot" style={{ background: v.accent }} aria-hidden /> {v.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
