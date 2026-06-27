"use client";
// Shell chrome state: theme only.
//
// Calm LIGHT is the default and the whole point of the redesign; dark survives
// only as an optional toggle (the shell drives it via a `data-theme` attribute on
// <html>, consumed by the CSS variables in globals.css). Theme persists to
// localStorage so a composed view survives a reload.
//
// Rail collapse is now local component state in LayerRail.tsx.
// News-ticker visibility is variant-driven via PanelHost (Task 9).

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type Theme = "light" | "dark";

export interface UIState {
  theme: Theme;
}

const PERSIST_KEY = "tn.ui.v1";
const PERSIST_VERSION = 1;

let state: UIState = { theme: "light" };
const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const uiStore = {
  setTheme(theme: Theme) {
    if (state.theme === theme) return;
    state = { ...state, theme };
    applyTheme(theme);
    emit();
  },
  toggleTheme() {
    uiStore.setTheme(state.theme === "light" ? "dark" : "light");
  },
  get(): UIState {
    return state;
  },
  /** Pull persisted UI back in + apply the theme. Call once, client-side. */
  hydrate() {
    const saved = loadPersisted<Partial<UIState>>(PERSIST_KEY, PERSIST_VERSION);
    if (saved?.theme) state = { ...state, theme: saved.theme };
    applyTheme(state.theme);
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useUI(): UIState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.get, uiStore.get);
}
