import { describe, expect, it } from "vitest";
import {
  assertSameGuild,
  commandConfigSchema,
  countingResetSchema,
  countingSettingsSchema,
  customCommandSchema,
  levelSettingsSchema,
  nicknameSchema,
  safeRedirectPath,
  snowflakeSchema,
  tempVoicePanelSchema,
  tempVoiceSettingsSchema
} from "../server/validators";

describe("guild-isolated validation", () => {
  it("keeps Discord snowflakes as strings", () => {
    expect(snowflakeSchema.parse("123456789012345678")).toBe("123456789012345678");
    expect(() => snowflakeSchema.parse("123")).toThrow();
  });

  it("blocks resource access across guild boundaries", () => {
    expect(() => assertSameGuild("gld_a", "gld_a")).not.toThrow();
    expect(() => assertSameGuild("gld_a", "gld_b")).toThrow(/Guild-Isolation/);
  });

  it("normalizes empty nicknames to reset values", () => {
    expect(nicknameSchema.parse({ nickname: "" }).nickname).toBeNull();
    expect(() => nicknameSchema.parse({ nickname: "x".repeat(33) })).toThrow();
  });

  it("validates command configuration limits", () => {
    const config = commandConfigSchema.parse({
      enabled: true,
      cooldownSeconds: 20,
      allowedChannelIds: ["123456789012345678"]
    });
    expect(config.cooldownSeconds).toBe(20);
    expect(() => commandConfigSchema.parse({ cooldownSeconds: -1 })).toThrow();
  });

  it("rejects unsafe custom command names", () => {
    expect(customCommandSchema.parse({
      name: "status-check",
      description: "Status",
      responseContent: "Alles ok"
    }).name).toBe("status-check");
    expect(() => customCommandSchema.parse({
      name: "@everyone",
      description: "bad",
      responseContent: "bad"
    })).toThrow();
  });

  it("prevents open redirects", () => {
    expect(safeRedirectPath("/home")).toBe("/home");
    expect(safeRedirectPath("/panel")).toBe("/panel");
    expect(safeRedirectPath("https://evil.test")).toBe("/panel");
    expect(safeRedirectPath("//evil.test")).toBe("/panel");
    expect(safeRedirectPath("/api/auth/discord")).toBe("/panel");
  });

  it("validates complete TempVoice settings", () => {
    const settings = tempVoiceSettingsSchema.parse({
      enabled: true,
      creatorChannelIds: ["123456789012345678", "223456789012345678"],
      categoryId: "323456789012345678",
      interfaceChannelId: "423456789012345678",
      nameTemplate: "{user}s Raum",
      defaultUserLimit: 12,
      defaultBitrateKbps: 96
    });

    expect(settings.creatorChannelIds).toHaveLength(2);
    expect(settings.defaultBitrateKbps).toBe(96);
    expect(() => tempVoiceSettingsSchema.parse({ defaultUserLimit: 100 })).toThrow();
    expect(() => tempVoiceSettingsSchema.parse({ defaultBitrateKbps: 7 })).toThrow();
  });

  it("requires a valid panel channel id when one is provided", () => {
    expect(tempVoicePanelSchema.parse({ channelId: "123456789012345678" }).channelId).toBe("123456789012345678");
    expect(tempVoicePanelSchema.parse({ channelId: "" }).channelId).toBeNull();
    expect(() => tempVoicePanelSchema.parse({ channelId: "123" })).toThrow();
  });

  it("validates Counting settings and reset limits", () => {
    const settings = countingSettingsSchema.parse({
      enabled: true,
      channelId: "123456789012345678",
      resetOnError: true,
      deleteWrongMessages: false,
      milestoneInterval: 250
    });

    expect(settings.channelId).toBe("123456789012345678");
    expect(settings.milestoneInterval).toBe(250);
    expect(() => countingSettingsSchema.parse({ milestoneInterval: 100001 })).toThrow();
    expect(countingResetSchema.parse({ number: 42 }).number).toBe(42);
    expect(() => countingResetSchema.parse({ number: -1 })).toThrow();
  });

  it("validates level channels and unique role rewards", () => {
    const settings = levelSettingsSchema.parse({
      enabled: true,
      announcementChannelId: "123456789012345678",
      roleRewards: [
        { level: 5, roleId: "223456789012345678" },
        { level: 10, roleId: "323456789012345678" }
      ]
    });

    expect(settings.roleRewards).toHaveLength(2);
    expect(levelSettingsSchema.parse({ announcementChannelId: "" }).announcementChannelId).toBeNull();
    expect(() => levelSettingsSchema.parse({
      roleRewards: [
        { level: 5, roleId: "223456789012345678" },
        { level: 5, roleId: "323456789012345678" }
      ]
    })).toThrow(/Level 5/);
  });
});
