"use client";
// Shell chrome state: whether the left rail is open, and the light/dark theme.
//
// Calm LIGHT is the default and the whole point of the redesign; dark survives
// only as an optional toggle (the shell drives it via a `data-theme` attribute on
// <html>, consumed by the CSS variables in globals.css). Rail-open + theme persist
// to localStorage so a composed view survives a reload.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export type Theme = "light" | "dark";

export interface UIState {
  railOpen: boolean;
  theme: Theme;
  /** Whether the bottom news ticker is shown (dismissible, persisted). */
  newsTicker: boolean;
}

const PERSIST_KEY = "tn.ui.v1";
const PERSIST_VERSION = 1;

let state: UIState = { railOpen: true, theme: "light", newsTicker: true };
const listeners = new Set<() => void>();

function applyTheme(theme: Theme) {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
}

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, state);
}

export const uiStore = {
  setRailOpen(open: boolean) {
    if (state.railOpen === open) return;
    state = { ...state, railOpen: open };
    emit();
  },
  toggleRail() {
    state = { ...state, railOpen: !state.railOpen };
    emit();
  },
  setTheme(theme: Theme) {
    if (state.theme === theme) return;
    state = { ...state, theme };
    applyTheme(theme);
    emit();
  },
  toggleTheme() {
    uiStore.setTheme(state.theme === "light" ? "dark" : "light");
  },
  setNewsTicker(on: boolean) {
    if (state.newsTicker === on) return;
    state = { ...state, newsTicker: on };
    emit();
  },
  toggleNewsTicker() {
    uiStore.setNewsTicker(!state.newsTicker);
  },
  get(): UIState {
    return state;
  },
  /** Pull persisted UI back in + apply the theme. Call once, client-side. */
  hydrate() {
    const saved = loadPersisted<Partial<UIState>>(PERSIST_KEY, PERSIST_VERSION);
    if (saved) state = { ...state, ...saved };
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
