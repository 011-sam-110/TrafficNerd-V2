import type { ComponentType } from "react";
import type { WidgetHelp } from "@/lib/console/help";

export interface WidgetBodyProps { instanceId: string; config: Record<string, unknown> }

export interface WidgetDetailProps { instanceId: string; config: Record<string, unknown> }

export interface WidgetType {
  id: string;
  title: string;
  icon: string;
  category: string;
  defaultHeight: number;
  defaultConfig: Record<string, unknown>;
  component: ComponentType<WidgetBodyProps>;
  /** Optional rich "focus" view shown when the widget is expanded onto the center stage. */
  detail?: ComponentType<WidgetDetailProps>;
  /** Concise, honest text for the frame's "?" help popover (what it shows + its data source). */
  help?: WidgetHelp;
  capabilities?: { filter?: boolean; sort?: boolean };
}

const reg = new Map<string, WidgetType>();

export function registerWidget(t: WidgetType): void { reg.set(t.id, t); }
export function getWidgetType(id: string): WidgetType | undefined { return reg.get(id); }
export function listWidgetTypes(): WidgetType[] { return [...reg.values()]; }
export function widgetsByCategory(): { category: string; types: WidgetType[] }[] {
  const order: string[] = [];
  const byCat = new Map<string, WidgetType[]>();
  for (const t of reg.values()) {
    if (!byCat.has(t.category)) { byCat.set(t.category, []); order.push(t.category); }
    byCat.get(t.category)!.push(t);
  }
  return order.map((category) => ({ category, types: byCat.get(category)! }));
}
/** Test-only: clear the singleton registry between tests. */
export function __resetRegistry(): void { reg.clear(); }
