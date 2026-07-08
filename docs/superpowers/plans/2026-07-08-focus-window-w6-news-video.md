# W6 — News-video detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A live-news-video console focus view — a hero player, a keyless channel wall grouped by category, an optional muted 2×2 mosaic, a live headline rail, and an add-custom-stream directory.

**Architecture:** New default-export `NewsDetail(props: WidgetDetailProps)` registered as `detail:` on `NEWS_WIDGET`. It reuses the existing static provider catalog (`lib/console/news/providers.ts`: `NEWS_PROVIDERS`, `resolveEmbed`, `parseCustomStream`) and the existing embed mechanism (YouTube `<iframe>`, already keyless + CSP-clear; HLS via the existing `CameraVideo`/`/api/hls` path — no NEW hosts). Selection persists through `shellLayoutStore.configure(instanceId, { providerId, customProvider })`. The headline rail reuses `/api/news` (`NewsItem`) via `useJsonPoll` exactly like `headlines.detail.tsx`.

**Tech Stack:** Next 15 / React 19 / TS; YouTube iframe; hls.js (via existing CameraVideo); vitest.

## Global Constraints

- Keyless-first (YouTube embeds + `img.youtube.com` thumbnails, no YouTube Data API). Dormant-safe; honest empty states.
- **Do NOT expand the `/api/hls` SSRF allowlist** (`lib/proxy/hls-allowlist.ts`) to broadcaster CDNs — rotating hosts + a security surface. HLS providers already in the catalog route through the existing allowlisted path; YouTube is the primary reliable channel. (Deliberate deviation from the research's "HLS-first" — YouTube-first here.)
- **No count-sparkline / recordSeries** in this view — the provider catalog is static, so a count trend is meaningless (avoids the W3/W4 sparkline pitfalls entirely).
- Native primitives only; theme tokens only (`--tn-surface`/`--tn-surface-solid`/`--tn-surface-2`/`--tn-text`/`--tn-text-muted`/`--tn-text-faint`/`--tn-border`/`--tn-accent`). NO `--tn-surface-1`/`--tn-text-1`. No geo → no InsetMap.
- Build gate (every task): `npx tsc --noEmit && npm test` → green.
- Commits: solo `011-sam-110 <lesttech.dev.sam@gmail.com>`, **no Co-Authored-By / Claude trailer**, plain `git commit -m "..."`.
- Owned files only; never `git add -A`/`checkout`/`reset`/`stash`; do not touch `.superpowers/sdd/progress.md`.
- **Verify every signature against source** (the interfaces below are from a research pass): `resolveEmbed`, `parseCustomStream`, `NewsProvider`, the YouTube iframe markup in `news.tsx`, `shellLayoutStore.configure`, `useJsonPoll`, `NewsItem`, and how the docked `NEWS_WIDGET` reads `config.providerId`/`customProvider`.

## Reference pattern

`lib/console/widgets/headlines.detail.tsx` (W2) is the closest reference (news domain, `/api/news` rail, `useJsonPoll`, source filter chips, recency grouping, footer + export). `lib/console/widgets/news.tsx` (the docked widget) holds the existing player embed markup + config read — reuse it.

## Data shapes (verify, then consume)

- `NewsProvider = { id; name; category; kind: "youtube"|"hls"; ref; favorite? }` (`ref` = 11-char YouTube id OR m3u8 URL) — `lib/console/news/providers.ts`.
- `NEWS_PROVIDERS: NewsProvider[]` (12), `resolveEmbed(p): { kind: "youtube"|"hls"; src: string }`, `parseCustomStream(url): NewsProvider|null` — same file.
- `NEWS_WIDGET` — plain object in `lib/console/widgets/news.tsx`, `registerWidget(NEWS_WIDGET)`, `defaultConfig: { providerId: "aljazeera" }`. Attach `detail: NewsDetail`.
- `NewsItem = { title; url; source; ts; description? }` — `lib/news.ts`; `/api/news` returns `{ generatedAt, items }`.
- `useJsonPoll<T>(url, pollMs, initial)` — used in `headlines.detail.tsx` (confirm signature there).
- `shellLayoutStore.configure(instanceId, patch)` + `shellLayoutStore.unfocus()` — `@/lib/console/store`. `WidgetDetailProps = { instanceId; config }`.
- Thumbnails: `https://img.youtube.com/vi/<ref>/hqdefault.jpg` (keyless).

## File Structure

- Modify `lib/console/news/providers.ts` — add pure `providerThumb(p)`.
- Create `lib/console/widgets/news.detail.tsx` — `NewsDetail`.
- Modify `lib/console/widgets/news.tsx` — attach `detail:`.
- Modify `tests/unit/console-news-providers.test.ts` — `providerThumb` cases.
- Modify `app/globals.css` — append `.tn-nv*` block.

---

### Task 1: `providerThumb` helper

**Files:** Modify `lib/console/news/providers.ts`; Test `tests/unit/console-news-providers.test.ts`.

- [ ] **Step 1:** Add to `providers.ts`:

```ts
/** Keyless YouTube thumbnail for a provider, or null for HLS (no free thumbnail). */
export function providerThumb(p: NewsProvider): string | null {
  return p.kind === "youtube" ? `https://img.youtube.com/vi/${p.ref}/hqdefault.jpg` : null;
}
```

- [ ] **Step 2:** Add to `tests/unit/console-news-providers.test.ts`:

```ts
import { providerThumb } from "@/lib/console/news/providers";
// …
it("providerThumb returns a keyless YouTube thumb for youtube, null for hls", () => {
  expect(providerThumb({ id: "x", name: "X", category: "World", kind: "youtube", ref: "abc12345678" }))
    .toBe("https://img.youtube.com/vi/abc12345678/hqdefault.jpg");
  expect(providerThumb({ id: "y", name: "Y", category: "World", kind: "hls", ref: "https://h/s.m3u8" })).toBeNull();
});
```

- [ ] **Step 3: Gate + commit** — green.
`git add lib/console/news/providers.ts tests/unit/console-news-providers.test.ts`
`git commit -m "feat(news-video): keyless providerThumb helper"`

---

### Task 2: Detail scaffold — masthead + category filter + hero player + register

**Files:** Create `lib/console/widgets/news.detail.tsx`; Modify `lib/console/widgets/news.tsx`, `app/globals.css`.

- [ ] **Step 1:** `NewsDetail({ instanceId, config }: WidgetDetailProps)`:
  - Active provider: resolve from `config.providerId` (+ `config.customProvider` via `parseCustomStream`) against `NEWS_PROVIDERS`; default the catalog's first / "aljazeera". Local `useState` for the active id, seeded from config, so clicking a channel is instant; also persist via `shellLayoutStore.configure(instanceId, { providerId })`.
  - Masthead: title "Live news" + now-playing (`{active.name} · {active.category}`) + a "← Back to map" is already provided by the WidgetDetail host, so no extra unfocus needed here (the footer add-custom is Task 5).
  - Category filter chips: distinct `NEWS_PROVIDERS` categories + "All"; filters the wall (Task 3).
  - Hero player: reuse the EXACT embed the docked `news.tsx` uses. For `resolveEmbed(active).kind === "youtube"` → the YouTube `<iframe>` (copy news.tsx's markup: `https://www.youtube.com/embed/<ref>?autoplay=1&mute=1&playsinline=1`, `allow="autoplay; encrypted-media; picture-in-picture"`, `allowFullScreen`); for `"hls"` → `<CameraVideo …>` or the existing HLS embed news.tsx uses. Do NOT hand-roll a new HLS path.
  - Declare `const [category, setCategory] = useState<string|null>(null)` and `const [activeId, setActiveId] = useState<string>(<seed>)` (consumed in Task 3).
  - Honest empty state if the catalog is somehow empty.

- [ ] **Step 2:** Add `detail: NewsDetail` + `import NewsDetail from "./news.detail";` to `NEWS_WIDGET` in `news.tsx`.

- [ ] **Step 3:** Append `.tn-nv*` CSS (hero 16:9 `aspect-ratio`, channel-wall grid `repeat(auto-fill,minmax(160px,1fr))`, thumb tile with caption + live dot, category chips, rail list, footer/actions). Theme tokens only. If `news.tsx` already ships a `.tn-newsw-*` stylesheet, reuse its classes where sensible rather than duplicating.

- [ ] **Step 4: Gate + commit** — green.
`git commit -m "feat(news-video): focus detail scaffold — hero player + category filter"`

---

### Task 3: Channel wall

**Files:** Modify `lib/console/widgets/news.detail.tsx`.

- Grid over `NEWS_PROVIDERS` filtered by `category`, grouped by category (or a flat grid with a category label). Each tile: `providerThumb(p)` as the `<img>` (lazy, `loading="lazy"`), a fallback coloured block when null (HLS), the channel name, a "▶ LIVE" badge, and a highlighted ring when `p.id === activeId`. Clicking a tile: `setActiveId(p.id)` + `shellLayoutStore.configure(instanceId, { providerId: p.id })` so the hero swaps and the choice persists.

- [ ] **Step 1:** Insert the wall.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(news-video): focus detail — category channel wall (keyless thumbnails)"`

---

### Task 4: Live headline rail + optional muted mosaic

**Files:** Modify `lib/console/widgets/news.detail.tsx`.

- Headline rail: `useJsonPoll<{ items: NewsItem[] }>("/api/news", 120000, { items: [] })` (mirror `headlines.detail.tsx`); render a compact scrollable list (source · relative time · title → link), honest "No headlines." empty state.
- Optional mosaic toggle: a "▦ Mosaic" button that renders a 2×2 grid of the first 4 filtered channels as muted YouTube iframes (`mute=1`, `autoplay=1`), with the active channel unmuted; toggling back returns to the single hero. Keep it behind a toggle so the default is one player (bandwidth-honest).

- [ ] **Step 1:** Insert the rail + mosaic toggle.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(news-video): focus detail — live headline rail + optional 2×2 mosaic"`

---

### Task 5: Directory footer — add-custom-stream + export

**Files:** Modify `lib/console/widgets/news.detail.tsx`.

- Footer: an add-custom-stream input → `parseCustomStream(url)`; on a non-null result, `shellLayoutStore.configure(instanceId, { customProvider: <result or url>, providerId: <result.id> })` and set it active; show an inline error when parse returns null. Attribution note ("Channels are the broadcasters' official keyless live streams (YouTube/HLS)").
- Export: CSV of the channel directory (`id, name, category, kind`) via `toCsv`/`downloadText`/`exportFilename("news-channels", Date.now())`.

- [ ] **Step 1:** Insert footer + custom-add + export.
- [ ] **Step 2: Gate + commit** — green.
`git commit -m "feat(news-video): focus detail — add-custom-stream + channel directory export"`

---

### Task 6: Verification

- [ ] Full gate `npx tsc --noEmit && npm test` green; `git status` clean apart from `.superpowers/sdd/progress.md`.
- [ ] Confirm no new host reaches `/api/hls` and no raw m3u8 is fetched client-side outside the existing allowlisted path.
- [ ] If the integrator has a browser: expand the News widget, confirm hero plays, channel wall thumbnails + swap-on-click + persistence, headline rail, mosaic toggle, add-custom. Otherwise note live visual verification pending.

## Self-Review

- **Spec §7.6 coverage:** (1) hero player (YouTube-first; HLS via existing path) → Task 2 ✓; (2) channel wall, keyless YouTube thumbnails, category-grouped → Task 3 ✓; (3) optional 2×2 muted mosaic → Task 4 ✓; (4) live headline rail (`/api/news`) → Task 4 ✓; (5) directory / add-custom + now-playing → Tasks 2+5 ✓. Deliberate scope: HLS-first hero + broadcaster-CDN allowlist expansion DEFERRED (security/reliability) — YouTube-first instead, documented.
- **Type consistency:** `providerThumb`/`resolveEmbed`/`parseCustomStream`/`NewsProvider`/`NewsItem`/`useJsonPoll`/`shellLayoutStore.configure` names verified against source before use.
- **Safety/honesty:** keyless throughout; no SSRF allowlist change; mosaic behind a toggle (bandwidth-honest); persistence via the same `configure` the docked widget uses; empty states honest.
