// Generate the calm-light PWA icons (a white globe on the brand teal) as real
// PNGs, with no image dependency: rasterise to an RGBA buffer and hand-encode the
// PNG via node:zlib. Run once with `node scripts/gen-icons.mjs`; the committed
// outputs under public/icons/ are the actual app assets (this script is provenance).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

// Brand palette (calm light identity — accent teal, no neon).
const TEAL_TOP = [14, 125, 151]; // #0e7d97
const TEAL_BOT = [11, 97, 117]; // #0b6175
const WHITE = [255, 255, 255];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
// Smooth 1px-ish antialiased coverage from a signed distance (inside = positive).
const aa = (d) => clamp01(d + 0.5);

function draw({ size, maskable }) {
  const buf = Buffer.alloc(size * size * 4); // RGBA
  const cx = size / 2;
  const cy = size / 2;
  // Maskable icons need their content inside the ~80% safe zone → smaller globe,
  // full-bleed background. Normal icons get rounded corners + a roomier globe.
  const pad = maskable ? size * 0.06 : 0;
  const corner = maskable ? 0 : size * 0.22;
  const R = (maskable ? 0.30 : 0.34) * size; // globe radius
  const stroke = Math.max(2, size * 0.018); // line thickness
  const meridianRx = R * 0.55; // side-meridian ellipse half-width

  const px = (x, y, rgb, a) => {
    if (a <= 0) return;
    const i = (y * size + x) * 4;
    const ea = a + buf[i + 3] / 255 * (1 - a);
    if (ea <= 0) return;
    for (let c = 0; c < 3; c++) {
      buf[i + c] = Math.round((rgb[c] * a + buf[i + c] * (buf[i + 3] / 255) * (1 - a)) / ea);
    }
    buf[i + 3] = Math.round(ea * 255);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x + 0.5;
      const fy = y + 0.5;

      // --- Background (rounded rect, or full square for maskable) ---
      let bgCov;
      if (maskable) {
        bgCov = 1;
      } else {
        // rounded-rect signed distance
        const qx = Math.abs(fx - cx) - (size / 2 - pad - corner);
        const qy = Math.abs(fy - cy) - (size / 2 - pad - corner);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - corner;
        const inside = Math.min(Math.max(qx, qy), 0);
        bgCov = aa(-(outside + inside));
      }
      if (bgCov > 0) {
        const t = clamp01((fy - pad) / (size - 2 * pad));
        const bg = [lerp(TEAL_TOP[0], TEAL_BOT[0], t), lerp(TEAL_TOP[1], TEAL_BOT[1], t), lerp(TEAL_TOP[2], TEAL_BOT[2], t)];
        px(x, y, bg, bgCov);
      }

      // --- Globe ---
      const dx = fx - cx;
      const dy = fy - cy;
      const r = Math.hypot(dx, dy);
      const inGlobe = aa(R - r); // 1 inside disc
      if (inGlobe <= 0) continue;

      // White ocean disc (slightly translucent so the teal reads through faintly).
      px(x, y, WHITE, inGlobe * 0.96);

      // Teal graticule, clipped to the disc. line(d) = thin band where |d|<stroke/2.
      const line = (d) => inGlobe * aa(stroke / 2 - Math.abs(d));
      let g = 0;
      g = Math.max(g, line(dy)); // equator
      g = Math.max(g, line(dy - R * 0.5)); // lower latitude
      g = Math.max(g, line(dy + R * 0.5)); // upper latitude
      g = Math.max(g, line(dx)); // central meridian
      // Side meridians: a vertical ellipse (|hypot(dx/rx, dy/R)| = 1).
      const e = Math.hypot(dx / meridianRx, dy / R) - 1;
      g = Math.max(g, inGlobe * aa(stroke / 2 / meridianRx - Math.abs(e)) );
      // Rim ring.
      g = Math.max(g, aa(stroke / 2 - Math.abs(R - r)));
      if (g > 0) px(x, y, TEAL_BOT, g * 0.92);
    }
  }
  return buf;
}

// --- Minimal PNG encoder (truecolor + alpha, 8-bit, no interlace) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const targets = [
  { name: "icon-192.png", size: 192, maskable: false },
  { name: "icon-512.png", size: 512, maskable: false },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180, maskable: true },
];
for (const t of targets) {
  const buf = draw(t);
  writeFileSync(resolve(OUT, t.name), encodePng(buf, t.size));
  console.log("wrote", t.name);
}
