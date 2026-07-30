export const guildCapabilities = [
  "view",
  "settings",
  "team",
  "moderation",
  "tickets",
  "music",
  "history"
] as const;

export type GuildCapability = (typeof guildCapabilities)[number];
export type GuildAccessLevel = "owner" | "administrator" | "moderator" | "supporter" | "viewer";

const defaults: Record<Exclude<GuildAccessLevel, "owner">, GuildCapability[]> = {
  administrator: [...guildCapabilities],
  moderator: ["view", "moderation", "history"],
  supporter: ["view", "tickets", "history"],
  viewer: ["view"]
};

export function defaultCapabilities(level: Exclude<GuildAccessLevel, "owner">): GuildCapability[] {
  return [...defaults[level]];
}

export function normalizeCapabilities(
  value: unknown,
  level: Exclude<GuildAccessLevel, "owner">
): GuildCapability[] {
  const requested = Array.isArray(value) ? value : defaults[level];
  const allowed = new Set<GuildCapability>(guildCapabilities);
  const normalized = requested.filter((entry): entry is GuildCapability => (
    typeof entry === "string" && allowed.has(entry as GuildCapability)
  ));
  return Array.from(new Set<GuildCapability>(["view", ...normalized]));
}

export function hasGuildCapability(
  access: { native?: boolean; capabilities?: readonly string[] },
  capability: GuildCapability
): boolean {
  return Boolean(access.native || access.capabilities?.includes(capability));
}
