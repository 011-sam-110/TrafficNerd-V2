import { expect, test } from "vitest";
import { detectPrimarySource } from "@/lib/news/primary";

const at = (url: string) => ({ title: "", description: "", url });

test("official / primary-document domains are detected", () => {
  expect(detectPrimarySource(at("https://www.state.gov/press/x"))?.kind).toBe("official");
  expect(detectPrimarySource(at("https://www.gov.uk/government/news/x"))?.kind).toBe("official");
  expect(detectPrimarySource(at("https://www.un.org/press/en/x"))?.kind).toBe("official");
});

test("documentary phrasing in the headline is detected", () => {
  expect(detectPrimarySource({ title: "Kremlin issues official statement on ceasefire", url: "https://bbc.com/x" })?.kind).toBe("statement");
  expect(detectPrimarySource({ title: "Firm announces merger in press release", url: "https://bbc.com/x" })?.kind).toBe("press-release");
  expect(detectPrimarySource({ title: "UN publishes white paper on climate", url: "https://bbc.com/x" })?.kind).toBe("document");
});

test("ordinary news gets no primary-source tag (no over-tagging)", () => {
  expect(detectPrimarySource({ title: "Local team wins the match", url: "https://theguardian.com/x" })).toBeNull();
  expect(detectPrimarySource({ title: "Weather turns cold across Europe", url: "https://npr.org/x" })).toBeNull();
});

test("unparseable url is safe", () => {
  expect(detectPrimarySource({ title: "Something", url: "not a url" })).toBeNull();
});
