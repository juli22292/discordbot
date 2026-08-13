import { describe, expect, it } from "vitest";
import {
  parseStoredPremiumFeatures,
  premiumFeaturesSettingsSchema,
  serializePremiumFeatures
} from "../server/premium-features";

describe("premium feature switch", () => {
  it("defaults to enabled", () => {
    expect(parseStoredPremiumFeatures(null)).toBe(true);
    expect(parseStoredPremiumFeatures(undefined)).toBe(true);
  });

  it("round-trips enabled and disabled values", () => {
    expect(parseStoredPremiumFeatures(serializePremiumFeatures(true))).toBe(true);
    expect(parseStoredPremiumFeatures(serializePremiumFeatures(false))).toBe(false);
  });

  it("accepts only an explicit boolean", () => {
    expect(premiumFeaturesSettingsSchema.parse({ enabled: true })).toEqual({ enabled: true });
    expect(premiumFeaturesSettingsSchema.safeParse({ enabled: "true" }).success).toBe(false);
  });
});
