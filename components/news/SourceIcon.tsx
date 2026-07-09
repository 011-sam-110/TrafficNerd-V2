"use client";
// components/news/SourceIcon.tsx
// A source's brand favicon with a graceful text fallback. Uses the keyless Google
// s2 favicon service; on any load error (or an unattributed source) it renders a
// monogram chip instead — never a broken image.

import { useState } from "react";
import { faviconUrl, sourceInitial } from "@/lib/news/sources";

export function SourceIcon({
  name,
  domain,
  size = 16,
  title,
}: {
  name: string;
  domain: string | null;
  size?: number;
  title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = faviconUrl(domain, 32);
  const tip = title ?? name;
  if (!url || failed) {
    return (
      <span className="tn-hd-fav tn-hd-fav-fb" style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }} title={tip} aria-label={name}>
        {sourceInitial(name)}
      </span>
    );
  }
  return (
    <img
      className="tn-hd-fav"
      src={url}
      width={size}
      height={size}
      alt=""
      title={tip}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
