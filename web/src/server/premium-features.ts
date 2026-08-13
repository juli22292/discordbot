import { z } from "zod";

export const PREMIUM_FEATURES_SETTING_KEY = "premium_features_enabled";

export const premiumFeaturesSettingsSchema = z.object({
  enabled: z.boolean()
});

export function parseStoredPremiumFeatures(value?: string | null): boolean {
  return value !== "disabled";
}

export function serializePremiumFeatures(enabled: boolean): string {
  return enabled ? "enabled" : "disabled";
}
