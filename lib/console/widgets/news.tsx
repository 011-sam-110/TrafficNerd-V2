"use client";
import { useEffect, useRef, useState } from "react";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { NEWS_PROVIDERS, parseCustomStream, resolveEmbed, type NewsProvider } from "@/lib/console/news/providers";

function NewsBody({ instanceId, config }: WidgetBodyProps) {
  const report = useWidgetReport();
  const activeId = (config.providerId as string) ?? NEWS_PROVIDERS[0].id;
  const custom = config.customProvider as NewsProvider | undefined;
  const active = custom?.id === activeId ? custom : NEWS_PROVIDERS.find((p) => p.id === activeId) ?? NEWS_PROVIDERS[0];
  const embed = resolveEmbed(active);
  const favorites = NEWS_PROVIDERS.filter((p) => p.favorite).slice(0, 4);
  const [picker, setPicker] = useState(false);
  useEffect(() => { report({ alerts: [], freshLabel: "live" }); }, [report]);

  const choose = (id: string) => { import("@/lib/console/store").then((m) => m.shellLayoutStore.configure(instanceId, { providerId: id })); };
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (embed.kind !== "hls" || !videoRef.current) return;
    const v = videoRef.current; let hls: { destroy(): void } | null = null; let cancelled = false;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = embed.src; return; }
    (async () => { const Hls = (await import("hls.js")).default; if (cancelled || !Hls.isSupported()) return; const h = new Hls(); hls = h; h.loadSource(embed.src); h.attachMedia(v); })();
    return () => { cancelled = true; hls?.destroy(); };
  }, [embed.kind, embed.src]);

  return (
    <div className="tn-news">
      <div className="tn-news-screen">
        {embed.kind === "youtube"
          ? <iframe className="tn-news-video" src={embed.src} title={active.name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          : <video ref={videoRef} className="tn-news-video" muted autoPlay playsInline controls />}
        <span className="tn-news-ch">{active.name}</span>
      </div>
      <div className="tn-news-tabs">
        {favorites.map((p) => (
          <button key={p.id} className={p.id === activeId ? "is-on" : ""} onClick={() => choose(p.id)}>{p.name.split(" ")[0]}</button>
        ))}
        <button className="tn-news-more" onClick={() => setPicker((o) => !o)}>&#xFF0B; More&hellip;</button>
      </div>
      {picker && (
        <div className="tn-news-picker">
          {NEWS_PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => { choose(p.id); setPicker(false); }}>{p.id === activeId ? "✓ " : ""}{p.name} <span className="tn-news-cat">{p.category}</span></button>
          ))}
          <input className="tn-news-custom" placeholder="Add stream URL (YouTube / .m3u8)…"
                 onKeyDown={(e) => {
                   if (e.key !== "Enter") return;
                   const p = parseCustomStream((e.target as HTMLInputElement).value);
                   if (p) import("@/lib/console/store").then((m) => m.shellLayoutStore.configure(instanceId, { providerId: p.id, customProvider: p }));
                 }} />
        </div>
      )}
    </div>
  );
}

export const NEWS_WIDGET = {
  id: "news", title: "Live News", icon: "📺", category: "News",
  defaultHeight: 240, defaultConfig: { providerId: "aljazeera" }, component: NewsBody,
};
registerWidget(NEWS_WIDGET);
