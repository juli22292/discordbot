import { describe, expect, it } from "vitest";
import {
  parseStoredPremiumRequirement,
  premiumFeaturesSettingsSchema,
  serializePremiumRequirement
} from "../server/premium-features";

describe("premium requirement switch", () => {
  it("requires premium by default", () => {
    expect(parseStoredPremiumRequirement(null)).toBe(true);
    expect(parseStoredPremiumRequirement(undefined)).toBe(true);
  });

  it("round-trips required and unlocked values", () => {
    expect(parseStoredPremiumRequirement(serializePremiumRequirement(true))).toBe(true);
    expect(parseStoredPremiumRequirement(serializePremiumRequirement(false))).toBe(false);
  });

  it("accepts only an explicit boolean", () => {
    expect(premiumFeaturesSettingsSchema.parse({ required: true })).toEqual({ required: true });
    expect(premiumFeaturesSettingsSchema.safeParse({ required: "true" }).success).toBe(false);
  });
});
