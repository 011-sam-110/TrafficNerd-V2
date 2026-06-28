export interface NewsProvider {
  id: string;
  name: string;
  category: string;
  kind: "youtube" | "hls";
  ref: string;
  favorite?: boolean;
}

// YouTube live video ids for free 24/7 news channels. ids are tunable — they
// occasionally rotate; the picker's add-custom-stream covers breakage.
export const NEWS_PROVIDERS: NewsProvider[] = [
  { id: "aljazeera", name: "Al Jazeera English", category: "World", kind: "youtube", ref: "gCNeDWCI0vo", favorite: true },
  { id: "dw", name: "DW News", category: "World", kind: "youtube", ref: "tQwQfNuvb1A", favorite: true },
  { id: "france24", name: "France 24", category: "World", kind: "youtube", ref: "h3MuIUNCCzI", favorite: true },
  { id: "sky", name: "Sky News", category: "World", kind: "youtube", ref: "9Auq9mYxFEE" },
  { id: "euronews", name: "Euronews", category: "World", kind: "youtube", ref: "pykpO5kQJ98" },
  { id: "cna", name: "CNA", category: "World", kind: "youtube", ref: "XWq5kBlakcQ" },
  { id: "trt", name: "TRT World", category: "World", kind: "youtube", ref: "Wp0_Dk0nJOk" },
  { id: "nhk", name: "NHK World", category: "World", kind: "youtube", ref: "f0lYkdg2DZw" },
  { id: "abcau", name: "ABC News (AU)", category: "World", kind: "youtube", ref: "vOTiJkg1voo" },
  { id: "bloomberg", name: "Bloomberg TV", category: "Business", kind: "youtube", ref: "iEpJwprxDdk" },
  { id: "nasa", name: "NASA TV", category: "Space", kind: "youtube", ref: "21X5lGlDOfg" },
  { id: "iss", name: "ISS Live", category: "Space", kind: "youtube", ref: "DIgkvm2nmHc" },
];

const YT_ID = /(?:v=|youtu\.be\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/;

export function parseCustomStream(url: string): NewsProvider | null {
  const u = url.trim();
  // Check HLS first — a .m3u8 URL may contain /live/ in its path which would
  // otherwise trip the YouTube regex below.
  if (/^https?:\/\/\S+\.m3u8(\?\S*)?$/i.test(u)) return { id: `custom-hls`, name: "Custom (HLS)", category: "Custom", kind: "hls", ref: u };
  const yt = u.match(YT_ID);
  if (yt) return { id: `custom-${yt[1]}`, name: "Custom (YouTube)", category: "Custom", kind: "youtube", ref: yt[1] };
  return null;
}

export function resolveEmbed(p: NewsProvider): { kind: "youtube" | "hls"; src: string } {
  if (p.kind === "youtube") return { kind: "youtube", src: `https://www.youtube.com/embed/${p.ref}?autoplay=1&mute=1&playsinline=1` };
  return { kind: "hls", src: p.ref };
}
