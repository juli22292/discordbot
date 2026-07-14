import { describe, expect, it } from "vitest";
import {
  assertSameGuild,
  commandConfigSchema,
  customCommandSchema,
  nicknameSchema,
  safeRedirectPath,
  snowflakeSchema
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
    expect(safeRedirectPath("https://evil.test")).toBe("/home");
    expect(safeRedirectPath("//evil.test")).toBe("/home");
    expect(safeRedirectPath("/api/auth/discord")).toBe("/home");
  });
});
