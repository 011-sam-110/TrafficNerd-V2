// Normalised image input shared by the route and both backends.
//
// The route accepts three upload shapes (multipart File, base64 JSON, or a remote
// image URL) and collapses them to ONE of these. A remote URL is passed through
// by reference (the gateway / sidecar fetches it); uploaded bytes become a data
// URL for the vision gateway and raw base64 for the sidecar.

export type ImageInput =
  | { kind: "url"; url: string }
  | { kind: "data"; dataUrl: string; base64: string; mime: string };

/** Build a data-URL ImageInput from raw bytes (size already checked by caller). */
export function imageFromBytes(bytes: ArrayBuffer | Uint8Array, mime: string): ImageInput {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const base64 = Buffer.from(u8).toString("base64");
  const safeMime = /^image\/[a-z0-9.+-]+$/i.test(mime) ? mime : "image/jpeg";
  return { kind: "data", dataUrl: `data:${safeMime};base64,${base64}`, base64, mime: safeMime };
}

/** Accept a raw base64 string OR a full data URL; return a data ImageInput.
 *  Returns null if the payload isn't decodable base64. */
export function imageFromBase64(input: string, fallbackMime = "image/jpeg"): ImageInput | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(input.trim());
  const mime = m ? m[1] : fallbackMime;
  const b64 = (m ? m[2] : input).replace(/\s/g, "");
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  return imageFromBytes(bytes, mime);
}

/** The image_url value a vision gateway wants (data URL for bytes, URL by ref). */
export function toImageUrlValue(img: ImageInput): string {
  return img.kind === "url" ? img.url : img.dataUrl;
}

/** Approximate byte length of a base64/data-url string (for the size gate). */
export function base64ByteLength(input: string): number {
  const b64 = input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  const clean = b64.replace(/\s/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}
