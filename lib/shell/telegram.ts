"use client";
// Optional Telegram alert channel. The user pastes their own bot token + chat id in
// Settings; when enabled, armed alerts (and the "Send test" button) relay through the
// keyless /api/telegram route (browser → our route → Telegram, to dodge CORS and keep
// the token out of client network logs). Everything is DORMANT-SAFE: not configured /
// disabled / a failed send all degrade to a silent no-op, never an error. The token
// lives only in the user's own localStorage — there is no server-side storage.

import { useSyncExternalStore } from "react";
import { loadPersisted, savePersisted } from "@/lib/shell/persist";

export interface TelegramState {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

const KEY = "tn.telegram.v1";
const VERSION = 1;

let state: TelegramState = { botToken: "", chatId: "", enabled: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  savePersisted(KEY, VERSION, state);
}

export const telegramStore = {
  get(): TelegramState { return state; },
  setToken(botToken: string) { state = { ...state, botToken: botToken.trim() }; emit(); },
  setChatId(chatId: string) { state = { ...state, chatId: chatId.trim() }; emit(); },
  setEnabled(enabled: boolean) { state = { ...state, enabled }; emit(); },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  hydrate() {
    const s = loadPersisted<Partial<TelegramState>>(KEY, VERSION);
    if (s) state = {
      botToken: typeof s.botToken === "string" ? s.botToken : "",
      chatId: typeof s.chatId === "string" ? s.chatId : "",
      enabled: s.enabled === true,
    };
    emit();
  },
};

export function useTelegram(): TelegramState {
  return useSyncExternalStore(telegramStore.subscribe, telegramStore.get, telegramStore.get);
}

/** Configured = both creds present (regardless of the enable toggle). */
export function isTelegramConfigured(s: TelegramState = state): boolean {
  return s.botToken.length > 0 && s.chatId.length > 0;
}

/** Relay one message through /api/telegram using the stored creds. Never throws. */
export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const { botToken, chatId } = state;
  if (!botToken || !chatId) return { ok: false, error: "Add your bot token and chat id first." };
  try {
    const r = await fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken, chatId, text }),
    });
    const j = (await r.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
    return { ok: j?.ok === true, error: j?.error };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

/** Fire-and-forget send for the alert dispatch — only when enabled + configured. */
export function sendTelegramIfEnabled(text: string): void {
  if (!state.enabled || !isTelegramConfigured()) return;
  void sendTelegram(text);
}
