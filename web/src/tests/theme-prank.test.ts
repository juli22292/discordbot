import { describe, expect, it } from "vitest";
import {
  parseStoredThemePrank,
  serializeThemePrank,
  themePrankSettingsSchema
} from "../server/theme-prank";

describe("light mode prank switch", () => {
  it("is disabled by default", () => {
    expect(parseStoredThemePrank(null)).toBe(false);
    expect(parseStoredThemePrank(undefined)).toBe(false);
  });

  it("round-trips enabled and disabled values", () => {
    expect(parseStoredThemePrank(serializeThemePrank(true))).toBe(true);
    expect(parseStoredThemePrank(serializeThemePrank(false))).toBe(false);
  });

  it("accepts only an explicit boolean", () => {
    expect(themePrankSettingsSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(themePrankSettingsSchema.safeParse({ enabled: "true" }).success).toBe(false);
  });
});
