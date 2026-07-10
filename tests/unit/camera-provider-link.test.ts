import { expect, test } from "vitest";
import { cameraProviderLink } from "@/lib/cameras/providerLink";

test("resolves the real camera-network attributions the app ingests", () => {
  expect(cameraProviderLink("Powered by TfL Open Data")?.url).toBe(
    "https://tfl.gov.uk/info-for/open-data-users/",
  );
  expect(cameraProviderLink("Live traffic data © Caltrans (California DOT)")?.label).toBe("Caltrans");
  expect(cameraProviderLink("Live weather-camera data © Fintraffic / Digitraffic")?.url).toBe(
    "https://www.digitraffic.fi/en/",
  );
  expect(cameraProviderLink("Live traffic-camera data © NZ Transport Agency Waka Kotahi (NZTA)")?.label).toBe(
    "NZTA Waka Kotahi",
  );
  expect(cameraProviderLink("Live traffic-camera data © Oregon DOT (ODOT) / TripCheck.com")?.url).toBe(
    "https://tripcheck.com/",
  );
});

test("returns an https link with a non-empty label whenever it matches", () => {
  const l = cameraProviderLink("Live traffic data © SCDOT / 511sc.org");
  expect(l).not.toBeNull();
  expect(l!.url.startsWith("https://")).toBe(true);
  expect(l!.label.length).toBeGreaterThan(0);
});

test("unknown operators yield null (no fabricated link)", () => {
  expect(cameraProviderLink("Some brand-new source © Nowhere")).toBeNull();
  expect(cameraProviderLink("")).toBeNull();
  expect(cameraProviderLink(undefined)).toBeNull();
});
