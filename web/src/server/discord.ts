import type { DiscordGuild, DiscordUser, Env, TokenData } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface DiscordBotGuild {
  id: string;
  name: string;
  icon?: string | null;
}

async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json<T>();
}

export async function exchangeDiscordCode(env: Env, code: string): Promise<TokenData> {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI
  });

  const token = await discordFetch<DiscordTokenResponse>("/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    tokenType: token.token_type,
    scope: token.scope,
    expiresAt: Date.now() + token.expires_in * 1000
  };
}

export async function refreshDiscordToken(env: Env, tokenData: TokenData): Promise<TokenData> {
  if (!tokenData.refreshToken) return tokenData;

  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: tokenData.refreshToken
  });

  const token = await discordFetch<DiscordTokenResponse>("/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? tokenData.refreshToken,
    tokenType: token.token_type,
    scope: token.scope,
    expiresAt: Date.now() + token.expires_in * 1000
  };
}

export async function fetchDiscordUser(tokenData: TokenData): Promise<DiscordUser> {
  return discordFetch<DiscordUser>("/users/@me", {
    headers: { Authorization: `${tokenData.tokenType} ${tokenData.accessToken}` }
  });
}

export async function fetchDiscordGuilds(tokenData: TokenData): Promise<DiscordGuild[]> {
  return discordFetch<DiscordGuild[]>("/users/@me/guilds", {
    headers: { Authorization: `${tokenData.tokenType} ${tokenData.accessToken}` }
  });
}

export async function fetchDiscordBotGuild(env: Env, guildId: string): Promise<DiscordBotGuild | null> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return null;

  const response = await fetch(`${DISCORD_API}/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (response.status === 403 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord Bot API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json<DiscordBotGuild>();
}

export function discordAvatarUrl(user: Pick<DiscordUser, "id" | "avatar">): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export function discordGuildIconUrl(guild: Pick<DiscordGuild, "id" | "icon">): string | null {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`;
}

export function discordOAuthAuthorizeUrl(env: Env, state: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  return url.toString();
}

export function discordBotInviteUrl(env: Env, guildId: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", env.BOT_INVITE_PERMISSIONS ?? "1101994781894");
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");
  return url.toString();
}
