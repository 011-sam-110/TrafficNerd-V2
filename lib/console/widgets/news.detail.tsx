"use client";
// News-video focus view — a live-news console. A hero player (YouTube iframe / the
// docked NewsBody's inline HLS <video>, reused verbatim — no new player), a keyless
// channel wall grouped by category (Task 3), a live headline rail + optional muted
// 2×2 mosaic (Task 4), and an add-custom-stream directory + CSV export (Task 5).
// Selection persists via shellLayoutStore.configure(instanceId, { providerId }),
// exactly like the docked NEWS_WIDGET. Keyless throughout (YouTube embeds +
// img.youtube.com thumbnails); HLS routes through the existing inline hls.js path.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import { shellLayoutStore } from "@/lib/console/store";
import { NEWS_PROVIDERS, providerThumb, resolveEmbed, type NewsProvider } from "@/lib/console/news/providers";

export default function NewsDetail({ instanceId, config }: WidgetDetailProps) {
  // Seed the active channel from persisted config (providerId + optional customProvider),
  // mirroring how the docked NewsBody resolves it. Local state makes clicking a channel
  // instant; every change also persists via shellLayoutStore.configure (below / Task 3).
  const seedId = (config.providerId as string) ?? NEWS_PROVIDERS[0]?.id ?? "";
  const seedCustom = config.customProvider as NewsProvider | undefined;
  const [activeId, setActiveId] = useState<string>(seedId);
  const [custom, setCustom] = useState<NewsProvider | undefined>(seedCustom);
  // Category filter for the channel wall (Task 3); null = All.
  const [category, setCategory] = useState<string | null>(null);

  const active = useMemo<NewsProvider | undefined>(
    () => (custom?.id === activeId ? custom : NEWS_PROVIDERS.find((p) => p.id === activeId) ?? NEWS_PROVIDERS[0]),
    [activeId, custom],
  );
  // Distinct catalog categories for the filter chips (+ "All").
  const categories = useMemo(() => Array.from(new Set(NEWS_PROVIDERS.map((p) => p.category))), []);

  // Channel wall: the (category-filtered) catalog, grouped by category with headers.
  const wallGroups = useMemo(() => {
    const shown = category == null ? NEWS_PROVIDERS : NEWS_PROVIDERS.filter((p) => p.category === category);
    const by = new Map<string, NewsProvider[]>();
    for (const p of shown) {
      const g = by.get(p.category) ?? [];
      g.push(p);
      by.set(p.category, g);
    }
    return [...by.entries()];
  }, [category]);

  // Select a catalog channel: instant hero swap (local state) + persist the choice,
  // exactly the { providerId } patch the docked NewsBody writes.
  const selectChannel = (p: NewsProvider) => {
    setActiveId(p.id);
    shellLayoutStore.configure(instanceId, { providerId: p.id });
  };

  const embed = active ? resolveEmbed(active) : null;

  // HLS hero: reuse the docked NewsBody's inline hls.js loader verbatim (no new player,
  // no /api/hls host change). YouTube heroes use the keyless <iframe> below. Since the
  // static catalog is YouTube-only, HLS only arises from a user-added custom .m3u8.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!embed || embed.kind !== "hls" || !videoRef.current) return;
    const v = videoRef.current;
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = embed.src; return; }
    (async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled || !Hls.isSupported()) return;
      const h = new Hls();
      hls = h;
      h.loadSource(embed.src);
      h.attachMedia(v);
    })();
    return () => { cancelled = true; hls?.destroy(); };
  }, [embed?.kind, embed?.src]);

  if (!active || !embed) {
    return (
      <div className="tn-nv">
        <p className="tn-w-empty">No live channels configured.</p>
      </div>
    );
  }

  return (
    <div className="tn-nv">
      <header className="tn-nv-head">
        <div className="tn-nv-title">Live news</div>
        <div className="tn-nv-now">▶ {active.name} · {active.category}</div>
      </header>

      <div className="tn-nv-chips">
        <button className={category == null ? "is-on" : ""} onClick={() => setCategory(null)}>All</button>
        {categories.map((c) => (
          <button key={c} className={category === c ? "is-on" : ""} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="tn-nv-hero">
        {embed.kind === "youtube"
          ? <iframe className="tn-nv-video" src={embed.src} title={active.name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          : <video ref={videoRef} className="tn-nv-video" muted autoPlay playsInline controls />}
        <span className="tn-nv-hero-label">{active.name} · LIVE</span>
      </div>

      <div className="tn-nv-sec-h">Channels</div>
      <div className="tn-nv-wall">
        {wallGroups.map(([cat, ps]) => (
          <Fragment key={cat}>
            <div className="tn-nv-cat-h">{cat}</div>
            {ps.map((p) => {
              const thumb = providerThumb(p);
              const on = p.id === activeId;
              return (
                <button
                  key={p.id}
                  className={`tn-nv-tile${on ? " is-on" : ""}`}
                  onClick={() => selectChannel(p)}
                  aria-pressed={on}
                >
                  <div className="tn-nv-thumb-wrap">
                    {thumb
                      ? <img className="tn-nv-thumb" src={thumb} alt="" loading="lazy" />
                      : <span className="tn-nv-thumb-fallback">{p.name}</span>}
                    <span className="tn-nv-live"><span className="tn-nv-live-dot" />LIVE</span>
                  </div>
                  <span className="tn-nv-tile-cap">
                    <span className="tn-nv-tile-name">{p.name}</span>
                    <span className="tn-nv-tile-cat">{p.category}</span>
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
