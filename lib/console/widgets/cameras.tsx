"use client";
/**
 * Cameras widget — shows a live thumbnail grid of the cameras currently
 * loaded on the map and alerts on any that go offline.
 *
 * Field-mapping notes (real LoadedCamera shape vs brief assumed fields):
 * - LoadedCamera: { id, name, lat, lon, available, live }
 * - `available` is a REAL field → CameraLite.available = c.available (direct).
 * - `attribution` is NOT a field → falls back to "".
 * - `license` is NOT a field → falls back to "".
 * - `refreshSeconds` is NOT a field → falls back to 30.
 * - loadedCamerasStore has only set()/get(); NO subscribe method (intentionally
 *   "not reactive"). We use useState with an initial snapshot instead of
 *   useSyncExternalStore to avoid calling undefined .subscribe.
 */
import { useEffect, useMemo, useState } from "react";
import { loadedCamerasStore } from "@/lib/cameras/loaded";
import { CameraVideo } from "@/components/CameraVideo";
import { registerWidget, type WidgetBodyProps } from "@/lib/console/registry";
import { useWidgetReport } from "@/components/console/WidgetFrame";
import { runAlertRule } from "@/lib/console/alerts";
import { cameraAlerts, type CameraLite } from "@/lib/console/widgets/cameras.rules";

function CamerasBody({ config }: WidgetBodyProps) {
  // loadedCamerasStore is a non-reactive snapshot store (set/get only, no subscribe).
  // Read once on mount; the store is refreshed by WorldMap whenever CamerasFeed lands.
  const [cams] = useState(() => loadedCamerasStore.get());

  // Map to CameraLite for the alert rule.
  // available is a real field on LoadedCamera; attribution/license/refreshSeconds are not.
  const lite: CameraLite[] = useMemo(
    () => cams.map((c) => ({ id: c.id, name: c.name, available: c.available })),
    [cams],
  );

  const report = useWidgetReport();
  useEffect(() => {
    report({
      alerts: runAlertRule(cameraAlerts, lite, config),
      count: cams.length,
      freshLabel: "live",
    });
  }, [lite, cams.length, report, config]);

  return (
    <div className="tn-cam-grid">
      {cams.slice(0, 6).map((c) => (
        <div key={c.id} className="tn-cam-cell">
          <CameraVideo
            id={c.id}
            alt={c.name}
            attribution=""
            license=""
            refreshSeconds={30}
          />
          <span className="tn-cam-label">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

export const CAMERAS_WIDGET = {
  id: "cameras",
  title: "Cameras",
  icon: "📷",
  category: "Cameras",
  defaultHeight: 260,
  defaultConfig: {},
  component: CamerasBody,
};
registerWidget(CAMERAS_WIDGET);
