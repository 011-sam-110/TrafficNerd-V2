import { expect, test } from "vitest";
import { isAllowed } from "@/lib/proxy/allowlist";

test("allows the TfL JamCam S3 bucket path", () => {
  expect(isAllowed(new URL("https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.07450.jpg"))).toBe(true);
});

test("rejects a different S3 bucket on the same host", () => {
  expect(isAllowed(new URL("https://s3-eu-west-1.amazonaws.com/some-other-bucket/secret.jpg"))).toBe(false);
});

test("rejects arbitrary hosts (SSRF guard)", () => {
  expect(isAllowed(new URL("http://169.254.169.254/latest/meta-data/"))).toBe(false);
  expect(isAllowed(new URL("https://evil.example.com/x.jpg"))).toBe(false);
});

test("rejects non-http(s) protocols", () => {
  expect(isAllowed(new URL("file:///etc/passwd"))).toBe(false);
  expect(isAllowed(new URL("gopher://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/x.jpg"))).toBe(false);
});
