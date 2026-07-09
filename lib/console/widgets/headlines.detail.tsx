// lib/console/widgets/headlines.detail.tsx
"use client";
// Headlines focus view — a newsroom clustering board. Reuses the SAME /api/news
// poll as the docked widget and turns it into a professional monitor:
//   • story clustering into source-badged mega-cards (lib/news/cluster)
//   • per-cluster coverage velocity + primary-source + "Updated" flags
//   • boolean search (AND / OR / -exclude / "phrase") over the feed
//   • source / region / type facet matrix (lib/news/sources)
//   • an interactive "headlines per hour" timeline that filters by hour
//   • cards ⇄ dense table view (persisted), cross-source AI synthesis, CSV export
// Every pure transform lives in a unit-tested lib/news/* module; this is the shell.
import { useEffect, useMemo, useRef, useState } from "react";
import type { WidgetDetailProps } from "@/lib/console/registry";
import type { NewsItem } from "@/lib/news";
import { useJsonPoll } from "@/lib/console/widgets/useJsonPoll";
import { shellLayoutStore } from "@/lib/console/store";
import { timeBins } from "@/lib/widgets/buckets";
import { clusterNews, type Cluster } from "@/lib/news/cluster";
import { clusterVelocity, velocityLabel } from "@/lib/news/velocity";
import { filterByQuery } from "@/lib/news/search";
import { detectPrimarySource } from "@/lib/news/primary";
import { sourceMeta } from "@/lib/news/sources";
import { loadSnapshot, saveSnapshot, diffSnapshots, type Snapshot } from "@/lib/news/snapshot";
import type { SynthesisPayload } from "@/lib/news/synthesis";
import { SourceIcon } from "@/components/news/SourceIcon";
import { HeadlineBars } from "@/components/news/HeadlineBars";
import { toCsv, downloadText, exportFilename } from "@/lib/export";

interface NewsPayload {
  generatedAt: number;
  items: NewsItem[];
}
const EMPTY: NewsPayload = { generatedAt: 0, items: [] };
const HOUR = 3_600_000;

function rel(ts: number, now: number): string {
  if (!ts) return "";
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
const itemText = (it: NewsItem) => `${it.title} ${it.description ?? ""} ${it.source}`;

type SynthState = { loading?: boolean; text?: string; note?: string };

export default function HeadlinesDetail({ instanceId, config }: WidgetDetailProps) {
  const { data, status } = useJsonPoll<NewsPayload>("/api/news", 120_000, EMPTY);
  const items = useMemo(() => data.items ?? [], [data.items]);
  const now = Date.now();

  // View mode (cards | table) — persisted via the widget config, like markets.
  const view: "cards" | "table" = config.view === "table" ? "table" : "cards";
  const setView = (v: "cards" | "table") => shellLayoutStore.configure(instanceId, { view: v });

  // Search + facet + timeline state (ephemeral).
  const [query, setQuery] = useState("");
  const [srcFilter, setSrcFilter] = useState<Set<string>>(new Set());
  const [regionFilter, setRegionFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [selHour, setSelHour] = useState<number | null>(null);

  // ---- Updated / correction tracking: diff current feed vs a persisted snapshot.
  const prevSnapRef = useRef<Snapshot | null | undefined>(undefined);
  const [updatedUrls, setUpdatedUrls] = useState<Set<string>>(new Set());
  const [changes, setChanges] = useState<Record<string, { from: string; to: string }>>({});
  useEffect(() => {
    if (items.length === 0) return;
    if (prevSnapRef.current === undefined) prevSnapRef.current = loadSnapshot();
    const diffs = diffSnapshots(prevSnapRef.current, items);
    if (diffs.length) {
      setUpdatedUrls((prev) => {
        const n = new Set(prev);
        for (const d of diffs) n.add(d.url);
        return n;
      });
      setChanges((prev) => {
        const n = { ...prev };
        for (const d of diffs) n[d.url] = { from: d.from, to: d.to };
        return n;
      });
    }
    saveSnapshot(items);
  }, [items]);

  // ---- Pipeline: search → facet counts → facet filter → timeline → hour filter → cluster.
  const afterSearch = useMemo(() => filterByQuery(items, query, itemText), [items, query]);

  const facets = useMemo(() => {
    const src = new Map<string, number>();
    const region = new Map<string, number>();
    const type = new Map<string, number>();
    for (const it of afterSearch) {
      const m = sourceMeta(it.source);
      src.set(it.source, (src.get(it.source) ?? 0) + 1);
      region.set(m.region, (region.get(m.region) ?? 0) + 1);
      type.set(m.type, (type.get(m.type) ?? 0) + 1);
    }
    return { src, region, type };
  }, [afterSearch]);

  const afterFacets = useMemo(
    () =>
      afterSearch.filter((it) => {
        const m = sourceMeta(it.source);
        if (srcFilter.size && !srcFilter.has(it.source)) return false;
        if (regionFilter.size && !regionFilter.has(m.region)) return false;
        if (typeFilter.size && !typeFilter.has(m.type)) return false;
        return true;
      }),
    [afterSearch, srcFilter, regionFilter, typeFilter],
  );

  const bins = useMemo(
    () => timeBins(afterFacets.map((it) => it.ts).filter((n) => n > 0), HOUR, now, 24 * HOUR),
    [afterFacets, now],
  );
  const hasVolume = bins.some((b) => b.count > 0);

  const afterHour = useMemo(
    () => (selHour == null ? afterFacets : afterFacets.filter((it) => it.ts >= selHour && it.ts < selHour + HOUR)),
    [afterFacets, selHour],
  );

  const clusters = useMemo(() => clusterNews(afterHour), [afterHour]);

  const totalSources = useMemo(() => new Set(items.map((it) => it.source)).size, [items]);

  // ---- Cross-source AI synthesis (dormant-safe).
  const [synth, setSynth] = useState<Record<string, SynthState>>({});
  const [aiDormant, setAiDormant] = useState(false);
  const synthesize = (c: Cluster) => {
    const cur = synth[c.id];
    if (cur?.loading || cur?.text) return;
    setSynth((s) => ({ ...s, [c.id]: { loading: true } }));
    fetch("/api/news/synthesis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: c.title,
        sources: c.items.map((i) => ({ source: i.source, title: i.title, description: i.description })),
      }),
    })
      .then((r) => r.json())
      .then((d: SynthesisPayload) => {
        if (d.dormant) {
          setAiDormant(true);
          setSynth((s) => ({ ...s, [c.id]: { note: "Cross-source synthesis needs the FREELLMAPI gateway." } }));
        } else if (d.synthesis) {
          setSynth((s) => ({ ...s, [c.id]: { text: d.synthesis! } }));
        } else {
          setSynth((s) => ({ ...s, [c.id]: { note: "Synthesis unavailable for this story right now." } }));
        }
      })
      .catch(() => setSynth((s) => ({ ...s, [c.id]: { note: "Synthesis unavailable." } })));
  };

  // ---- Expand/collapse a cluster's full source list.
  const [openId, setOpenId] = useState<string | null>(null);

  const clearFacets = () => {
    setSrcFilter(new Set());
    setRegionFilter(new Set());
    setTypeFilter(new Set());
  };
  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
  };
  const anyFacet = srcFilter.size + regionFilter.size + typeFilter.size > 0;

  // ---- Export: one row per member, tagged with its cluster (size + sources).
  const exportRows = useMemo(
    () =>
      clusters.flatMap((c) =>
        c.items.map((it) => ({
          cluster: c.id,
          clusterSize: c.sourceCount,
          clusterSources: c.sources.join(" | "),
          source: it.source,
          title: it.title,
          url: it.url,
          ts: it.ts ? new Date(it.ts).toISOString() : "",
          description: it.description ?? "",
        })),
      ),
    [clusters],
  );

  const regionKeys = [...facets.region.keys()].filter((r) => r !== "Other");
  const typeKeys = [...facets.type.keys()];

  return (
    <div className="tn-hd">
      <header className="tn-hd-head">
        <div>
          <div className="tn-hd-h-title">World Headlines</div>
          <div className="tn-hd-h-sub">
            <b>{clusters.length}</b> {clusters.length === 1 ? "story" : "stories"} · {afterHour.length} headlines from{" "}
            {totalSources} sources · updated {data.generatedAt ? rel(data.generatedAt, now) || "just now" : "—"} ago
          </div>
        </div>
        <div className="tn-hd-viewtoggle" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === "cards"} className={view === "cards" ? "is-on" : ""} onClick={() => setView("cards")}>
            ▤ Cards
          </button>
          <button role="tab" aria-selected={view === "table"} className={view === "table" ? "is-on" : ""} onClick={() => setView("table")}>
            ▦ Table
          </button>
        </div>
      </header>

      <div className="tn-hd-bar">
        <input
          className="tn-hd-search"
          placeholder='Search — AND · OR · -exclude · "phrase"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Boolean headline search"
        />
        <div className="tn-hd-chips">
          {[...facets.src.entries()].map(([s, n]) => {
            const m = sourceMeta(s);
            return (
              <button key={s} className={`tn-hd-chip${srcFilter.has(s) ? " is-on" : ""}`} onClick={() => toggle(srcFilter, setSrcFilter, s)}>
                <SourceIcon name={s} domain={m.domain} size={13} />
                {s} <span className="tn-hd-chip-n">{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(regionKeys.length > 1 || typeKeys.length > 1) && (
        <div className="tn-hd-facets">
          {regionKeys.length > 1 && (
            <div className="tn-hd-facet-row">
              <span className="tn-hd-facet-label">Region</span>
              {regionKeys.map((r) => (
                <button key={r} className={`tn-hd-fchip${regionFilter.has(r) ? " is-on" : ""}`} onClick={() => toggle(regionFilter, setRegionFilter, r)}>
                  {r} <span className="tn-hd-chip-n">{facets.region.get(r)}</span>
                </button>
              ))}
            </div>
          )}
          {typeKeys.length > 1 && (
            <div className="tn-hd-facet-row">
              <span className="tn-hd-facet-label">Type</span>
              {typeKeys.map((t) => (
                <button key={t} className={`tn-hd-fchip${typeFilter.has(t) ? " is-on" : ""}`} onClick={() => toggle(typeFilter, setTypeFilter, t)}>
                  {t} <span className="tn-hd-chip-n">{facets.type.get(t)}</span>
                </button>
              ))}
            </div>
          )}
          {anyFacet && (
            <button className="tn-hd-clear" onClick={clearFacets}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {hasVolume && (
        <div className="tn-hd-vol">
          <div className="tn-hd-vol-head">
            <span className="tn-hd-group-h">Headlines per hour · last 24h</span>
            {selHour != null ? (
              <button className="tn-hd-reset" onClick={() => setSelHour(null)}>
                ✕ Hour {new Date(selHour).getHours().toString().padStart(2, "0")}:00 — reset
              </button>
            ) : (
              <span className="tn-hd-hint">click a bar to filter</span>
            )}
          </div>
          <HeadlineBars bins={bins} selected={selHour} onSelect={setSelHour} />
        </div>
      )}

      {status === "loading" && items.length === 0 && <p className="tn-w-empty">Loading headlines…</p>}
      {items.length > 0 && clusters.length === 0 && <p className="tn-w-empty">No headlines match.</p>}

      {view === "cards" && clusters.length > 0 && (
        <div className="tn-hd-cards">
          {clusters.map((c) => (
            <ClusterCard
              key={c.id}
              c={c}
              now={now}
              open={openId === c.id}
              onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))}
              updated={c.items.some((i) => updatedUrls.has(i.url))}
              change={changes[c.lead.url] ?? c.items.map((i) => changes[i.url]).find(Boolean)}
              synth={synth[c.id]}
              aiDormant={aiDormant}
              onSynthesize={() => synthesize(c)}
            />
          ))}
        </div>
      )}

      {view === "table" && clusters.length > 0 && (
        <table className="tn-hd-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Headline</th>
              <th>Sources</th>
              <th>Velocity</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => {
              const vl = velocityLabel(clusterVelocity(c, now));
              return (
                <tr key={c.id} className="tn-hd-trow">
                  <td className="tn-hd-tcell-time">{rel(c.latestTs, now) || "—"}</td>
                  <td>
                    <a href={c.lead.url} target="_blank" rel="noreferrer" className="tn-hd-tlink">
                      {c.title}
                    </a>
                    {c.items.some((i) => updatedUrls.has(i.url)) && <span className="tn-hd-badge tn-hd-upd">Updated</span>}
                  </td>
                  <td>
                    <span className="tn-hd-tsrc">
                      {c.sources.slice(0, 5).map((s) => (
                        <SourceIcon key={s} name={s} domain={sourceMeta(s).domain} size={14} />
                      ))}
                      {c.sourceCount > 1 && <span className="tn-hd-chip-n">×{c.sourceCount}</span>}
                    </span>
                  </td>
                  <td className="tn-hd-tcell-vel">{vl ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <footer className="tn-hd-foot">
        <span className="tn-hd-foot-src">Keyless RSS · stories grouped by shared-entity similarity</span>
        {aiDormant && <span className="tn-hd-foot-note">AI synthesis dormant (no gateway)</span>}
        <button
          className="tn-hd-export"
          disabled={exportRows.length === 0}
          onClick={() => downloadText(`${exportFilename("headlines", Date.now())}.csv`, "text/csv", toCsv(exportRows))}
        >
          ⬇ Export CSV
        </button>
      </footer>
    </div>
  );
}

function ClusterCard({
  c,
  now,
  open,
  onToggle,
  updated,
  change,
  synth,
  aiDormant,
  onSynthesize,
}: {
  c: Cluster;
  now: number;
  open: boolean;
  onToggle: () => void;
  updated: boolean;
  change?: { from: string; to: string };
  synth?: SynthState;
  aiDormant: boolean;
  onSynthesize: () => void;
}) {
  const vl = velocityLabel(clusterVelocity(c, now));
  const trending = clusterVelocity(c, now)?.trending ?? false;
  const primary = detectPrimarySource(c.lead) ?? c.items.map((i) => detectPrimarySource(i)).find(Boolean) ?? null;
  const multi = c.sourceCount > 1;

  return (
    <article className={`tn-hd-card${trending ? " is-trending" : ""}`}>
      <div className="tn-hd-card-badges">
        {c.sources.slice(0, 6).map((s) => (
          <SourceIcon key={s} name={s} domain={sourceMeta(s).domain} size={18} title={s} />
        ))}
        {c.sources.length > 6 && <span className="tn-hd-chip-n">+{c.sources.length - 6}</span>}
      </div>

      <div className="tn-hd-card-meta">
        {multi && <span className="tn-hd-badge tn-hd-corrob">{c.sourceCount} sources</span>}
        {vl && <span className={`tn-hd-badge tn-hd-vel${trending ? " is-trending" : ""}`}>▲ {vl}</span>}
        {updated && (
          <span className="tn-hd-badge tn-hd-upd" title={change ? `Was: ${change.from}` : "Headline changed since last seen"}>
            Updated
          </span>
        )}
        {primary && (
          <span className="tn-hd-badge tn-hd-primary" title="Appears to reference a primary/official source">
            {primary.label}
          </span>
        )}
        <span className="tn-hd-card-time">{rel(c.latestTs, now)}</span>
      </div>

      <a className="tn-hd-card-title" href={c.lead.url} target="_blank" rel="noreferrer">
        {c.title}
      </a>
      <div className="tn-hd-card-lead-src">
        <SourceIcon name={c.lead.source} domain={sourceMeta(c.lead.source).domain} size={13} /> {c.lead.source}
      </div>
      {change && <p className="tn-hd-change">Updated from: “{change.from}”</p>}
      {c.lead.description && <p className="tn-hd-snippet">{c.lead.description}</p>}

      {multi && (
        <>
          <button className="tn-hd-more" onClick={onToggle} aria-expanded={open}>
            {open ? "▾ Hide" : "▸ Show"} all {c.items.length} reports
          </button>
          {open && (
            <ul className="tn-hd-corrob-list">
              {c.items.map((it, i) => (
                <li key={it.url || i}>
                  <SourceIcon name={it.source} domain={sourceMeta(it.source).domain} size={13} />
                  <a href={it.url} target="_blank" rel="noreferrer" className="tn-hd-corrob-title">
                    {it.title}
                  </a>
                  <span className="tn-hd-corrob-meta">
                    {it.source}
                    {it.ts ? ` · ${rel(it.ts, now)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {multi && !aiDormant && (
        <button className="tn-hd-synth-btn" onClick={onSynthesize} disabled={!!synth?.loading}>
          {synth?.loading ? "Synthesising…" : "✨ Cross-source synthesis"}
        </button>
      )}
      {synth?.text && (
        <div className="tn-hd-synth">
          <span className="tn-hd-synth-h">Cross-source synthesis</span>
          <p>{synth.text}</p>
        </div>
      )}
      {synth?.note && <p className="tn-hd-synth-note">{synth.note}</p>}
    </article>
  );
}
