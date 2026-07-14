import type { DiscordGuild } from "./types";

export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 0x8n,
  MANAGE_GUILD: 0x20n
};

export function canManageGuild(guild: Pick<DiscordGuild, "owner" | "permissions">): boolean {
  if (guild.owner) return true;

  try {
    const permissions = BigInt(guild.permissions ?? "0");
    return (
      (permissions & DISCORD_PERMISSIONS.ADMINISTRATOR) === DISCORD_PERMISSIONS.ADMINISTRATOR ||
      (permissions & DISCORD_PERMISSIONS.MANAGE_GUILD) === DISCORD_PERMISSIONS.MANAGE_GUILD
    );
  } catch {
    return false;
  }
}

export function permissionLabel(guild: Pick<DiscordGuild, "owner" | "permissions">): string {
  if (guild.owner) return "Owner";

  try {
    const permissions = BigInt(guild.permissions ?? "0");
    if ((permissions & DISCORD_PERMISSIONS.ADMINISTRATOR) === DISCORD_PERMISSIONS.ADMINISTRATOR) {
      return "Administrator";
    }
    if ((permissions & DISCORD_PERMISSIONS.MANAGE_GUILD) === DISCORD_PERMISSIONS.MANAGE_GUILD) {
      return "Manage Guild";
    }
  } catch {
    return "Keine Verwaltungsrechte";
  }

  return "Keine Verwaltungsrechte";
}

export function botInvitePermissions(value?: string): string {
  return value && /^\d+$/.test(value) ? value : "1101994781894";
}
