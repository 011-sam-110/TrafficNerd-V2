"use client";
// Service-worker registration glue. Kept tiny + conservative:
//   • production only — registering in `next dev` fights HMR.
//   • registers AFTER load so it never competes with first paint.
//   • the SW itself (public/sw.js) caches only the static shell, never live data.

export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is a progressive enhancement — never block the app */
    });
  });
}
