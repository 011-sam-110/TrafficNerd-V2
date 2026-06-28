import { expect, test } from "vitest";
import { cameraAlerts, type CameraLite } from "@/lib/console/widgets/cameras.rules";

const cams: CameraLite[] = [
  { id: "a", name: "LHR A4", available: true },
  { id: "b", name: "I-95 MM12", available: false },
];

test("flags offline cameras as warn", () => {
  const a = cameraAlerts(cams, {});
  expect(a.length).toBe(1);
  expect(a[0].severity).toBe("warn");
  expect(a[0].ref).toBe("b");
});
