import { expect, test, beforeEach } from "vitest";
import { registerWidget, getWidgetType, listWidgetTypes, widgetsByCategory, __resetRegistry } from "@/lib/console/registry";

const stub = (id: string, category: string) =>
  ({ id, title: id, icon: "■", category, defaultHeight: 200, defaultConfig: {}, component: (() => null) as never });

beforeEach(() => __resetRegistry());

test("register + get + list", () => {
  registerWidget(stub("aviation", "Aviation"));
  expect(getWidgetType("aviation")?.title).toBe("aviation");
  expect(listWidgetTypes().map((t) => t.id)).toEqual(["aviation"]);
});

test("widgetsByCategory groups and preserves insertion order", () => {
  registerWidget(stub("aviation", "Aviation"));
  registerWidget(stub("news", "News"));
  registerWidget(stub("emerg", "Aviation"));
  const groups = widgetsByCategory();
  expect(groups.map((g) => g.category)).toEqual(["Aviation", "News"]);
  expect(groups[0].types.map((t) => t.id)).toEqual(["aviation", "emerg"]);
});

test("listWidgetTypes preserves registration order; getWidgetType misses return undefined", () => {
  registerWidget(stub("aviation", "Aviation"));
  registerWidget(stub("news", "News"));
  expect(listWidgetTypes().map((t) => t.id)).toEqual(["aviation", "news"]);
  expect(getWidgetType("nope")).toBeUndefined();
});
