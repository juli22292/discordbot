import { z } from "zod";
import { canUseOwnerAdmin } from "./permissions";

export const AI_VISIBILITY_SETTING_KEY = "public_ai_visibility";

export const aiVisibilitySettingsSchema = z.object({
  publicVisible: z.boolean()
});

export function parseStoredAiVisibility(value?: string | null): boolean {
  return value !== "owner";
}

export function serializeAiVisibility(publicVisible: boolean): string {
  return publicVisible ? "public" : "owner";
}

export function canAccessPublicAi(publicVisible: boolean, discordUserId?: string | null): boolean {
  return publicVisible || canUseOwnerAdmin(discordUserId);
}
