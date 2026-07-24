import { describe, expect, it } from "vitest";
import {
  assertSameGuild,
  adminChannelUpdateSchema,
  adminMemberModerationSchema,
  adminResourceDeleteSchema,
  adminRoleUpdateSchema,
  autoroleSettingsSchema,
  backupActionSchema,
  commandConfigSchema,
  countingResetSchema,
  countingSettingsSchema,
  customCommandSchema,
  featureModuleSchema,
  featureSettingsSchema,
  levelSettingsSchema,
  musicSourceSchema,
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

  it("validates owner member moderation actions and Discord limits", () => {
    expect(adminMemberModerationSchema.parse({
      action: "timeout",
      reason: "Spam",
      durationSeconds: 3600
    }).durationSeconds).toBe(3600);
    expect(adminMemberModerationSchema.parse({ action: "ban", deleteMessageSeconds: 86400 }).action).toBe("ban");
    expect(() => adminMemberModerationSchema.parse({ action: "timeout" })).toThrow(/Dauer/);
    expect(() => adminMemberModerationSchema.parse({ action: "ban", deleteMessageSeconds: 604801 })).toThrow();
    expect(() => adminMemberModerationSchema.parse({ action: "delete" })).toThrow();
  });

  it("validates role and channel management payloads", () => {
    const role = adminRoleUpdateSchema.parse({
      name: "Support",
      color: "#4DDB8F",
      permissions: "1099511635974"
    });
    expect(role.permissions).toBe("1099511635974");
    expect(() => adminRoleUpdateSchema.parse({ name: "Support", color: "#4DDB8F", permissions: "admin" })).toThrow();

    const channel = adminChannelUpdateSchema.parse({
      name: "team-chat",
      topic: "Interner Austausch",
      categoryId: "123456789012345678",
      slowmodeSeconds: 10
    });
    expect(channel.slowmodeSeconds).toBe(10);
    expect(() => adminChannelUpdateSchema.parse({ name: "voice", bitrateKbps: 500 })).toThrow();
    expect(adminResourceDeleteSchema.parse({ confirm: true }).confirm).toBe(true);
    expect(() => adminResourceDeleteSchema.parse({ confirm: false })).toThrow(/bestätigt/);
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

  it("allows only the enabled YouTube music source", () => {
    expect(musicSourceSchema.parse({ source: "youtube" }).source).toBe("youtube");
    expect(() => musicSourceSchema.parse({ source: "spotify" })).toThrow();
    expect(() => musicSourceSchema.parse({ source: "soundcloud" })).toThrow();
  });

  it("validates ticket setup including unique panel categories", () => {
    const customEmoji = "<:ticket:1529165088760533113>";
    const settings = ticketSettingsSchema.parse({
      enabled: true,
      ticketCategoryId: "123456789012345678",
      supportRoleIds: ["223456789012345678"],
      formQuestions: ["Wobei brauchst du Hilfe?"],
      selectCategories: [{ label: "Support", description: "Allgemeine Hilfe", emoji: customEmoji, value: "support" }]
    });
    expect(settings.formQuestions).toHaveLength(1);
    expect(settings.selectCategories[0].emoji).toBe(customEmoji);
    expect(() => ticketSettingsSchema.parse({
      selectCategories: [{ label: "Support", description: "Allgemeine Hilfe", emoji: "x".repeat(101), value: "support" }]
    })).toThrow(/maximal 100/);
    expect(() => ticketSettingsSchema.parse({ enabled: true })).toThrow(/Discord-Kategorie/);
  });

  it("validates configurable guild feature modules", () => {
    expect(featureModuleSchema.parse("starboard")).toBe("starboard");
    expect(featureModuleSchema.parse("youtube-music")).toBe("youtube-music");
    expect(() => featureModuleSchema.parse("unknown-module")).toThrow();

    const settings = featureSettingsSchema.parse({
      enabled: true,
      fields: {
        channelId: "123456789012345678",
        threshold: 3,
        allowSelfStar: false,
        roleIds: ["223456789012345678"]
      }
    });
    expect(settings.enabled).toBe(true);
    expect(settings.fields.threshold).toBe(3);
    expect(() => featureSettingsSchema.parse({
      enabled: true,
      fields: { description: "x".repeat(4001) }
    })).toThrow();
  });
});
