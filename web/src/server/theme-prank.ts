import { z } from "zod";

export const THEME_PRANK_SETTING_KEY = "light_mode_prank_enabled";

export const themePrankSettingsSchema = z.object({
  enabled: z.boolean()
});

export function parseStoredThemePrank(value?: string | null): boolean {
  return value === "enabled";
}

export function serializeThemePrank(enabled: boolean): string {
  return enabled ? "enabled" : "disabled";
}
