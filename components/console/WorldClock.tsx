"use client";
import { useEffect, useState } from "react";

const ZONES = [
  { zone: "Europe/London", label: "LONDON" },
  { zone: "America/New_York", label: "NEW YORK" },
  { zone: "Asia/Tokyo", label: "TOKYO" },
  { zone: "UTC", label: "UTC" },
];

export default function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="tn-clock">
      {ZONES.map((z) => (
        <div key={z.zone} className="tn-clock-cell">
          <div className="tn-clock-time">
            {now
              ? now.toLocaleTimeString("en-GB", {
                  timeZone: z.zone,
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--:--"}
          </div>
          <div className="tn-clock-zone">{z.label}</div>
        </div>
      ))}
    </div>
  );
}
