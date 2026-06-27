"use client";
// Persisted UI-language store + the t()/useT() helpers. Framework-light external
// store (the lib/shell/ui.ts idiom). Default is English so SSR markup matches the
// first client paint; the persisted choice is reconciled after mount (no hydration
// mismatch), exactly like uiStore.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";
import { DEFAULT_LANG, LANGS, translate, type Lang, type StringKey } from "@/lib/i18n/catalog";

const PERSIST_KEY = "tn.lang.v1";
const PERSIST_VERSION = 1;
const VALID = new Set<string>(LANGS.map((l) => l.code));

let lang: Lang = DEFAULT_LANG;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(PERSIST_KEY, PERSIST_VERSION, lang);
}

export const langStore = {
  set(next: Lang) {
    if (lang === next) return;
    lang = next;
    emit();
  },
  get(): Lang {
    return lang;
  },
  /** Pull the persisted language back in. Call once, client-side, after mount. */
  hydrate() {
    const saved = loadPersisted<Lang>(PERSIST_KEY, PERSIST_VERSION);
    if (saved && VALID.has(saved)) lang = saved;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useLang(): Lang {
  return useSyncExternalStore(langStore.subscribe, langStore.get, langStore.get);
}

/** Non-reactive translate in the CURRENT language (for non-component call sites). */
export function t(key: StringKey): string {
  return translate(lang, key);
}

/** Reactive translator: re-renders the caller on a language change. */
export function useT(): (key: StringKey) => string {
  const current = useLang();
  return (key: StringKey) => translate(current, key);
}
