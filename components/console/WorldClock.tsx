"use client";
// The cinematic world clock — an ambient ribbon of major cities floated over the map
// stage, west → east so it reads as a sweep across the world's timezones. Each cell
// shows the local time and a sun/moon glyph tinted for day vs night. Rendered by
// ConsoleWorkspace only while a map stage is live and no widget is focused, so it (like
// the map controls) vanishes the instant a widget is fullscreened onto the stage.
//
// This replaces the old full-screen "clock" stage; the world clock is now an overlay,
// not a place the map switches away to.

import { useEffect, useState } from "react";

// Major cities spanning the globe (roughly evenly across the 24h dial).
const CITIES: { zone: string; label: string }[] = [
  { zone: "America/Los_Angeles", label: "LA" },
  { zone: "America/New_York", label: "NYC" },
  { zone: "Europe/London", label: "LDN" },
  { zone: "Asia/Dubai", label: "DXB" },
  { zone: "Asia/Singapore", label: "SGP" },
  { zone: "Asia/Tokyo", label: "TYO" },
  { zone: "Australia/Sydney", label: "SYD" },
];

/** Local "HH:MM" (24h) + hour-of-day for a zone; null-safe placeholders before mount. */
function partsFor(now: Date, zone: string): { time: string; hour: number } {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(now);
  return { time, hour: Number(time.slice(0, 2)) };
}

/** Daytime ≈ 06:00–18:00 local — good enough for a warm-sun / cool-moon tint. */
function isDay(hour: number): boolean {
  return hour >= 6 && hour < 18;
}

export default function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000); // minute precision, kept fresh
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tn-worldclock" role="group" aria-label="World clock">
      {CITIES.map((c) => {
        const p = now ? partsFor(now, c.zone) : null;
        const day = p ? isDay(p.hour) : true;
        return (
          <div key={c.zone} className={`tn-wc-cell ${day ? "is-day" : "is-night"}`}>
            <span className="tn-wc-glyph" aria-hidden>{day ? "☀" : "☾"}</span>
            <span className="tn-wc-time tn-num">{p ? p.time : "--:--"}</span>
            <span className="tn-wc-city">{c.label}</span>
          </div>
        );
      })}
    </div>
  );
}
