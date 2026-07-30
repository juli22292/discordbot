import { describe, expect, it } from "vitest";
import {
  defaultCapabilities,
  hasGuildCapability,
  normalizeCapabilities
} from "../server/guild-access";
import {
  guildModerationActionSchema,
  musicPlayerActionSchema
} from "../server/validators";

describe("delegated guild access", () => {
  it("uses conservative defaults for each team level", () => {
    expect(defaultCapabilities("administrator")).toContain("team");
    expect(defaultCapabilities("moderator")).toEqual(["view", "moderation", "history"]);
    expect(defaultCapabilities("supporter")).toEqual(["view", "tickets", "history"]);
    expect(defaultCapabilities("viewer")).toEqual(["view"]);
  });

  it("normalizes duplicate and unsupported capabilities", () => {
    expect(normalizeCapabilities(["music", "music", "invalid"], "viewer")).toEqual(["view", "music"]);
    expect(normalizeCapabilities(undefined, "supporter")).toEqual(["view", "tickets", "history"]);
  });

  it("lets native guild managers bypass delegated capability checks", () => {
    expect(hasGuildCapability({ native: true, capabilities: [] }, "team")).toBe(true);
    expect(hasGuildCapability({ native: false, capabilities: ["view", "music"] }, "music")).toBe(true);
    expect(hasGuildCapability({ native: false, capabilities: ["view"] }, "moderation")).toBe(false);
  });
});

describe("operations action validation", () => {
  it("requires a duration for timeouts", () => {
    expect(guildModerationActionSchema.safeParse({
      memberId: "1267171819362717828",
      action: "timeout",
      reason: "Test"
    }).success).toBe(false);
    expect(guildModerationActionSchema.safeParse({
      memberId: "1267171819362717828",
      action: "timeout",
      reason: "Test",
      durationSeconds: 3600
    }).success).toBe(true);
  });

  it("requires and bounds live player volume", () => {
    expect(musicPlayerActionSchema.safeParse({ action: "volume" }).success).toBe(false);
    expect(musicPlayerActionSchema.safeParse({ action: "volume", volume: 200 }).success).toBe(true);
    expect(musicPlayerActionSchema.safeParse({ action: "volume", volume: 201 }).success).toBe(false);
  });
});
