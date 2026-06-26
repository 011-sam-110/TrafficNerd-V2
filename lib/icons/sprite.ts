"use client";
// Turn the hand-drawn SVG pictograms into three.js markers for the globe.
//
// • cameras + satellites → THREE.Sprite (camera-facing billboards, always
//   upright and legible no matter how the globe is rotated).
// • planes → a flat textured quad lying in the surface tangent plane, so it can
//   be oriented to the aircraft's heading (objectRotation in GlobeView), exactly
//   like a flight-tracker top-down icon.
//
// Textures and materials are cached per (icon, colour) so rendering thousands of
// markers only ever allocates a handful of GPU resources — the per-datum object
// returned to react-globe.gl is just a lightweight wrapper sharing them.

import * as THREE from "three";
import { ICON_SVG, type IconKey } from "@/lib/icons/svg";

const TEX_PX = 128; // rasterisation size — crisp at marker scale
const texCache = new Map<string, THREE.Texture>();
const spriteMatCache = new Map<string, THREE.SpriteMaterial>();
const meshMatCache = new Map<string, THREE.MeshBasicMaterial>();
const planeGeom = new THREE.PlaneGeometry(1, 1);

function iconTexture(icon: IconKey, color: string): THREE.Texture {
  const colored = ICON_SVG[icon]
    .replace("<svg ", `<svg width="${TEX_PX}" height="${TEX_PX}" `)
    .replaceAll("currentColor", color);
  const hit = texCache.get(colored);
  if (hit) return hit;
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  // SVG → data URL → <img>; the texture fills in once the image decodes.
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(colored);
  texCache.set(colored, tex);
  return tex;
}

function spriteMaterial(icon: IconKey, color: string, opacity: number): THREE.SpriteMaterial {
  const key = `${icon}|${color}|${opacity}`;
  const hit = spriteMatCache.get(key);
  if (hit) return hit;
  const mat = new THREE.SpriteMaterial({
    map: iconTexture(icon, color),
    transparent: true,
    depthWrite: false,
    opacity,
  });
  spriteMatCache.set(key, mat);
  return mat;
}

function meshMaterial(icon: IconKey, color: string): THREE.MeshBasicMaterial {
  const key = `${icon}|${color}`;
  const hit = meshMatCache.get(key);
  if (hit) return hit;
  const mat = new THREE.MeshBasicMaterial({
    map: iconTexture(icon, color),
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  meshMatCache.set(key, mat);
  return mat;
}

// Soft radial glow shared by all satellites (tinted per material) so they read
// as luminous points against the night globe.
let glowTex: THREE.Texture | null = null;
const glowMatCache = new Map<string, THREE.SpriteMaterial>();
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.4, "rgba(255,255,255,0.22)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
function glowMaterial(color: string): THREE.SpriteMaterial {
  const hit = glowMatCache.get(color);
  if (hit) return hit;
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  glowMatCache.set(color, mat);
  return mat;
}

/** Billboard icon for a camera. Unavailable cameras render dimmed. */
export function cameraSprite(icon: IconKey, color: string, available: boolean): THREE.Sprite {
  const sprite = new THREE.Sprite(spriteMaterial(icon, color, available ? 0.96 : 0.4));
  sprite.scale.set(2.6, 2.6, 1);
  return sprite;
}

/** Glowing billboard icon for a satellite (station icons are drawn larger). */
export function satelliteSprite(icon: IconKey, color: string): THREE.Object3D {
  const group = new THREE.Group();
  const big = icon === "sat-station";
  const glow = new THREE.Sprite(glowMaterial(color));
  glow.scale.set(big ? 11 : 8, big ? 11 : 8, 1);
  const sprite = new THREE.Sprite(spriteMaterial(icon, color, 1));
  const s = big ? 6.5 : 5;
  sprite.scale.set(s, s, 1);
  group.add(glow, sprite);
  return group;
}

/** Flat heading-orientable icon for a plane (lies in the tangent plane). */
export function planeIconMesh(icon: IconKey, color: string): THREE.Mesh {
  const mesh = new THREE.Mesh(planeGeom, meshMaterial(icon, color));
  mesh.scale.set(4, 4, 1);
  return mesh;
}
