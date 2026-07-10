"use client";
// Local, keyless "profile": a display name the visitor can set for themselves. There
// is no backend/auth yet — this is purely local identity that drives the top-right
// avatar (its initial + a deterministic colour) and greets the user in the profile
// menu. The "Sign in" affordance in ProfileMenu is a placeholder seam for real auth
// later; until then everything the user sets lives here, in localStorage.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

const KEY = "tn.profile.v1";
const VERSION = 1;

export interface ProfileState {
  name: string;
}

let state: ProfileState = { name: "" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(KEY, VERSION, state);
}

export const profileStore = {
  get(): ProfileState {
    return state;
  },
  setName(name: string) {
    const next = name.slice(0, 40);
    if (state.name === next) return;
    state = { ...state, name: next };
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  hydrate() {
    const saved = loadPersisted<Partial<ProfileState>>(KEY, VERSION);
    if (saved?.name) state = { ...state, name: saved.name };
    emit();
  },
};

export function useProfile(): ProfileState {
  return useSyncExternalStore(profileStore.subscribe, profileStore.get, profileStore.get);
}

/** First glyph for the avatar (uppercased); "?" when no name is set yet. */
export function avatarInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? [...trimmed][0].toUpperCase() : "?";
}

/** Deterministic pleasant hue from the name so each identity gets a stable colour. */
export function avatarColor(name: string): string {
  const seed = name.trim() || "guest";
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}
