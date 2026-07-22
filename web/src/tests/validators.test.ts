import { describe, expect, it } from "vitest";
import {
  assertSameGuild,
  autoroleSettingsSchema,
  backupActionSchema,
  commandConfigSchema,
  countingResetSchema,
  countingSettingsSchema,
  customCommandSchema,
  levelSettingsSchema,
  nicknameSchema,
  raidSettingsSchema,
  safeRedirectPath,
  snowflakeSchema,
  securitySettingsSchema,
  tempVoicePanelSchema,
  tempVoiceSettingsSchema,
  ticketSettingsSchema
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

  it("validates multiple Autoroles and requires a role when enabled", () => {
    const settings = autoroleSettingsSchema.parse({
      enabled: true,
      humanRoleIds: ["123456789012345678", "223456789012345678"],
      botRoleIds: ["323456789012345678"],
      delaySeconds: 15,
      waitForScreening: true
    });

    expect(settings.humanRoleIds).toHaveLength(2);
    expect(settings.delaySeconds).toBe(15);
    expect(() => autoroleSettingsSchema.parse({ enabled: true })).toThrow(/mindestens eine Rolle/);
    expect(() => autoroleSettingsSchema.parse({
      humanRoleIds: ["123456789012345678", "123456789012345678"]
    })).toThrow(/nur einmal/);
  });

  it("validates complete security settings and rejects conflicting domains", () => {
    const settings = securitySettingsSchema.parse({
      antispamEnabled: true,
      quarantineRoleId: "123456789012345678",
      antinukeEnabled: true,
      antinukePunishment: "quarantine",
      allowedDomains: ["example.com"],
      blockedDomains: ["evil.example"]
    });
    expect(settings.antispamMessageLimit).toBe(5);
    expect(() => securitySettingsSchema.parse({
      allowedDomains: ["example.com"],
      blockedDomains: ["example.com"]
    })).toThrow(/gleichzeitig/);
  });

  it("validates raid profiles and destructive backup confirmations", () => {
    expect(raidSettingsSchema.parse({ profile: "strict", panicSlowmodeSeconds: 30 }).profile).toBe("strict");
    expect(() => backupActionSchema.parse({ action: "delete", scope: "all", confirm: false })).toThrow(/bestätigt/);
    expect(backupActionSchema.parse({ action: "restore", scope: "roles", confirm: true }).scope).toBe("roles");
  });

  it("validates ticket setup including unique panel categories", () => {
    const settings = ticketSettingsSchema.parse({
      enabled: true,
      ticketCategoryId: "123456789012345678",
      supportRoleIds: ["223456789012345678"],
      formQuestions: ["Wobei brauchst du Hilfe?"],
      selectCategories: [{ label: "Support", description: "Allgemeine Hilfe", emoji: "🎫", value: "support" }]
    });
    expect(settings.formQuestions).toHaveLength(1);
    expect(() => ticketSettingsSchema.parse({ enabled: true })).toThrow(/Discord-Kategorie/);
  });
});
