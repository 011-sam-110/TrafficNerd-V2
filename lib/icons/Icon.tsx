"use client";
// Render a type pictogram inline (legend, overlays). The SVG is drawn in
// `currentColor`, so the wrapper's `color` tints it.

import { ICON_SVG, type IconKey } from "@/lib/icons/svg";

export function TypeIcon({
  icon,
  color,
  size = 16,
  title,
}: {
  icon: IconKey;
  color?: string;
  size?: number;
  title?: string;
}) {
  const svg = ICON_SVG[icon].replace("<svg ", `<svg width="${size}" height="${size}" `);
  return (
    <span
      role="img"
      aria-label={title}
      title={title}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        color: color ?? "currentColor",
        flexShrink: 0,
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
