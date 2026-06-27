// MapLibre symbol-icon registration for the unified engine.
//
// The camera + plane layers are symbol layers that pick an `icon-image` by name
// per feature. These helpers rasterise the hand-drawn SVG pictograms from
// lib/icons/svg.ts into RGBA images and register them on the map via addImage.
// DOM-dependent (canvas/Image) so this lives apart from the pure FC builders.

import type maplibregl from "maplibre-gl";
import {
  ICON_SVG,
  cameraRegionColor,
  CAMERA_DEFAULT_REGION,
  CAMERA_OFFLINE_COLOR,
  PLANE_META,
  SAT_META,
  WEBCAM_COLOR,
} from "@/lib/icons/svg";

/** Rasterise an SVG pictogram into an image MapLibre can use as a symbol icon. */
export function rasterizeIcon(
  svg: string,
  px = 80,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const sized = svg.replace("<svg ", `<svg width="${px}" height="${px}" `);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no 2d context"));
      ctx.drawImage(image, 0, 0, px, px);
      const d = ctx.getImageData(0, 0, px, px);
      resolve({ width: px, height: px, data: new Uint8Array(d.data.buffer.slice(0)) });
    };
    image.onerror = reject;
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized);
  });
}

// Register one region-tinted icon per (feed shape × region colour) so the symbol
// layer can pick the right one per camera with a data-driven expression.
export async function loadCameraIcons(map: maplibregl.Map): Promise<void> {
  const feeds: [string, keyof typeof ICON_SVG][] = [
    ["still", "cam-still"],
    ["video", "cam-video"],
  ];
  const regions: [string, string][] = [
    ["tfl", cameraRegionColor("tfl")],
    ["caltrans", cameraRegionColor("caltrans")],
    ["scdot", cameraRegionColor("scdot")],
    ["digitraffic", cameraRegionColor("digitraffic")],
    ["castlerock", cameraRegionColor("castlerock")],
    ["tripcheck", cameraRegionColor("tripcheck")],
    ["drivebc", cameraRegionColor("drivebc")],
    ["default", CAMERA_DEFAULT_REGION.color],
  ];
  await Promise.all([
    ...feeds.flatMap(([feed, iconKey]) =>
      regions.map(async ([rk, color]) => {
        const name = `cam-${feed}-${rk}`;
        if (map.hasImage(name)) return;
        const img = await rasterizeIcon(ICON_SVG[iconKey].replaceAll("currentColor", color));
        if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
      }),
    ),
    // One muted-slate "offline" variant per feed shape so unavailable cameras
    // drop their live region colour (the honesty signal). Picked by icon-image
    // when a feature's `available` is false.
    ...feeds.map(async ([feed, iconKey]) => {
      const name = `cam-${feed}-offline`;
      if (map.hasImage(name)) return;
      const img = await rasterizeIcon(ICON_SVG[iconKey].replaceAll("currentColor", CAMERA_OFFLINE_COLOR));
      if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 });
    }),
  ]);
}

/** Register one heading-up plane icon per type (coloured by PLANE_META). */
export async function loadPlaneIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    Object.values(PLANE_META).map(async (meta) => {
      if (map.hasImage(meta.key)) return;
      const img = await rasterizeIcon(ICON_SVG[meta.key].replaceAll("currentColor", meta.color));
      if (!map.hasImage(meta.key)) map.addImage(meta.key, img, { pixelRatio: 2 });
    }),
  );
}

/** Register the single rose-tinted Windy webcam icon. */
export async function loadWebcamIcons(map: maplibregl.Map): Promise<void> {
  if (map.hasImage("webcam")) return;
  const img = await rasterizeIcon(ICON_SVG.webcam.replaceAll("currentColor", WEBCAM_COLOR));
  if (!map.hasImage("webcam")) map.addImage("webcam", img, { pixelRatio: 2 });
}

/** Register one icon per satellite category (coloured by SAT_META). */
export async function loadSatelliteIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    Object.values(SAT_META).map(async (meta) => {
      if (map.hasImage(meta.key)) return;
      const img = await rasterizeIcon(ICON_SVG[meta.key].replaceAll("currentColor", meta.color));
      if (!map.hasImage(meta.key)) map.addImage(meta.key, img, { pixelRatio: 2 });
    }),
  );
}
