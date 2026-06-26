"use client";
import { useEffect, useRef, useState } from "react";
import { AttributionBadge } from "@/components/AttributionBadge";
import { CameraImage } from "@/components/CameraImage";

export function CameraVideo(props: {
  id: string; alt: string; attribution: string; license: string; refreshSeconds: number;
}) {
  const { id, alt, attribution, license, refreshSeconds } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const src = `/api/hls?id=${encodeURIComponent(id)}`;
  const poster = `/api/proxy?id=${encodeURIComponent(id)}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src; // Safari plays HLS natively
      return;
    }
    (async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;
      if (!Hls.isSupported()) { setFailed(true); return; }
      const instance = new Hls({ enableWorker: true });
      hls = instance;
      instance.loadSource(src);
      instance.attachMedia(video);
      instance.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) { setFailed(true); instance.destroy(); hls = null; }
      });
    })();

    return () => { cancelled = true; if (hls) hls.destroy(); };
  }, [src]);

  if (failed) {
    return (
      <CameraImage id={id} alt={alt} attribution={attribution} license={license} refreshSeconds={refreshSeconds} />
    );
  }
  return (
    <figure style={{ margin: 0 }}>
      <video ref={videoRef} poster={poster} controls autoPlay muted playsInline aria-label={alt} style={{ width: "100%" }} />
      <figcaption><AttributionBadge attribution={attribution} license={license} /></figcaption>
    </figure>
  );
}
