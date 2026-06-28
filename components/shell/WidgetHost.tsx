"use client";
// Resolves a placement key → its descriptor → the SourceWidget. A thin seam so the
// Workspace (and, in Phase 2, the rgl grid) renders by key without knowing widget kinds.

import { widgetForKey } from "@/lib/widgets/registry";
import SourceWidget from "@/components/shell/SourceWidget";

export default function WidgetHost({ widgetKey }: { widgetKey: string }) {
  const widget = widgetForKey(widgetKey);
  if (!widget) return null;
  return <SourceWidget widget={widget} />;
}
