import { z } from "zod";

export const PREMIUM_FEATURES_SETTING_KEY = "premium_features_required";

export const premiumFeaturesSettingsSchema = z.object({
  required: z.boolean()
});

export function parseStoredPremiumRequirement(value?: string | null): boolean {
  return value !== "not_required";
}

export function serializePremiumRequirement(required: boolean): string {
  return required ? "required" : "not_required";
}
