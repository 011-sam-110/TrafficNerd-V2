import { expect, test } from "vitest";
import { resolveWidgetHelp, signalHelp } from "@/lib/console/help";

test("resolveWidgetHelp surfaces declared help verbatim", () => {
  const r = resolveWidgetHelp({
    title: "Markets",
    help: { what: "Live prices for commodities and crypto.", source: "Yahoo + CoinGecko" },
  });
  expect(r.title).toBe("Markets");
  expect(r.what).toBe("Live prices for commodities and crypto.");
  expect(r.source).toBe("Yahoo + CoinGecko");
});

test("resolveWidgetHelp falls back honestly when a widget declares no help", () => {
  const r = resolveWidgetHelp({ title: "Some Panel" });
  expect(r.title).toBe("Some Panel");
  expect(r.what).toContain("Some Panel"); // generic but names the panel
  expect(r.source).toBeUndefined();       // never invents a source
});

test("signalHelp builds a plain-language note from the source's group + attribution", () => {
  const help = signalHelp({ label: "Earthquakes", group: "Natural hazards", attribution: "USGS" });
  expect(help.what.startsWith("Earthquakes —")).toBe(true);
  expect(help.what.toLowerCase()).toContain("hazard");
  expect(help.source).toBe("USGS"); // carries the mandatory upstream credit as the source
});

test("signalHelp degrades gracefully for an unknown group (no crash, still honest)", () => {
  const help = signalHelp({ label: "Mystery", group: "Unmapped", attribution: "Somewhere" });
  expect(help.what).toContain("Mystery");
  expect(help.what).toContain("Unmapped");
  expect(help.source).toBe("Somewhere");
});
