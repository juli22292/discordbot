import { describe, expect, it } from "vitest";
import {
  aiVisibilitySettingsSchema,
  canAccessPublicAi,
  parseStoredAiVisibility,
  serializeAiVisibility
} from "../server/ai-visibility";

describe("AI+ visibility", () => {
  it("defaults to public visibility when no setting exists", () => {
    expect(parseStoredAiVisibility(null)).toBe(true);
    expect(parseStoredAiVisibility(undefined)).toBe(true);
  });

  it("round-trips public and owner-only settings", () => {
    expect(parseStoredAiVisibility(serializeAiVisibility(true))).toBe(true);
    expect(parseStoredAiVisibility(serializeAiVisibility(false))).toBe(false);
  });

  it("allows everyone in public mode and only the panel owner otherwise", () => {
    expect(canAccessPublicAi(true, null)).toBe(true);
    expect(canAccessPublicAi(false, "1267171819362717828")).toBe(true);
    expect(canAccessPublicAi(false, "111111111111111111")).toBe(false);
    expect(canAccessPublicAi(false, null)).toBe(false);
  });

  it("accepts only an explicit boolean update", () => {
    expect(aiVisibilitySettingsSchema.parse({ publicVisible: false })).toEqual({ publicVisible: false });
    expect(aiVisibilitySettingsSchema.safeParse({ publicVisible: "false" }).success).toBe(false);
  });
});
