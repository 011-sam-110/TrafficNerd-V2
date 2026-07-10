import { describe, it, expect } from "vitest";
import { coerceRule, resolveChannels, isDiscordConfigured, type NotifyRule } from "@/lib/shell/notifications";

const rule = (over: Partial<NotifyRule> = {}): NotifyRule => ({
  enabled: true,
  channels: { browser: true, telegram: true, discord: true },
  ...over,
});

describe("isDiscordConfigured (SSRF-safe webhook shape)", () => {
  it("accepts canonical discord + discordapp webhook URLs", () => {
    expect(isDiscordConfigured("https://discord.com/api/webhooks/123456789/abcDEF-_123")).toBe(true);
    expect(isDiscordConfigured("https://discordapp.com/api/webhooks/987654321/tok_en-123")).toBe(true);
    expect(isDiscordConfigured("  https://discord.com/api/webhooks/1/x  ")).toBe(true); // trims
  });
  it("rejects junk / other hosts / non-https / empty", () => {
    expect(isDiscordConfigured("")).toBe(false);
    expect(isDiscordConfigured(undefined)).toBe(false);
    expect(isDiscordConfigured(null)).toBe(false);
    expect(isDiscordConfigured("http://discord.com/api/webhooks/1/x")).toBe(false); // not https
    expect(isDiscordConfigured("https://evil.com/api/webhooks/1/x")).toBe(false);    // wrong host
    expect(isDiscordConfigured("https://discord.com/api/webhooks/abc/x")).toBe(false); // non-numeric id
  });
});

describe("coerceRule", () => {
  it("junk → a disabled, no-channel rule", () => {
    const empty: NotifyRule = { enabled: false, channels: { browser: false, telegram: false, discord: false } };
    expect(coerceRule(null)).toEqual(empty);
    expect(coerceRule("nope")).toEqual(empty);
    expect(coerceRule({})).toEqual(empty);
  });
  it("preserves valid fields and drops non-finite thresholds", () => {
    expect(coerceRule({ enabled: true, channels: { browser: false, telegram: true, discord: true }, minValue: 5 }))
      .toEqual({ enabled: true, channels: { browser: false, telegram: true, discord: true }, minValue: 5 });
    const r = coerceRule({ enabled: true, channels: { telegram: true }, minValue: "x" });
    expect(r.minValue).toBeUndefined();
    expect(r.channels).toEqual({ browser: false, telegram: true, discord: false });
  });
});

describe("resolveChannels", () => {
  it("is inert when master off or the rule is disabled", () => {
    expect(resolveChannels(false, rule(), { telegram: true, discord: true })).toEqual([]);
    expect(resolveChannels(true, rule({ enabled: false }), { telegram: true, discord: true })).toEqual([]);
  });
  it("fires only armed channels that have creds (browser needs none)", () => {
    expect(resolveChannels(true, rule(), { telegram: true, discord: true })).toEqual(["browser", "telegram", "discord"]);
    expect(resolveChannels(true, rule(), { telegram: false, discord: false })).toEqual(["browser"]);
    expect(resolveChannels(true, rule({ channels: { browser: false, telegram: true, discord: false } }), { telegram: false, discord: true })).toEqual([]);
    expect(resolveChannels(true, rule({ channels: { browser: false, telegram: false, discord: true } }), { telegram: false, discord: true })).toEqual(["discord"]);
  });
});
