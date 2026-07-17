import type { DiscordGuild, DiscordUser, Env, TokenData } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface DiscordBotGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner_id?: string | null;
  member_count?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  features?: string[];
}

export interface DiscordBotMember {
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
  };
  nick?: string | null;
  roles?: string[];
  joined_at?: string | null;
  premium_since?: string | null;
  pending?: boolean;
}

export interface DiscordBotRole {
  id: string;
  name: string;
  color?: number;
  position?: number;
  managed?: boolean;
  permissions?: string;
  hoist?: boolean;
  mentionable?: boolean;
}

export interface DiscordBotChannel {
  id: string;
  name?: string;
  type?: number;
  parent_id?: string | null;
  position?: number;
}

export interface DiscordBotInvite {
  code: string;
  url?: string;
  channel?: {
    id: string;
    name?: string | null;
    type?: number;
  } | null;
  inviter?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  } | null;
  uses?: number | null;
  max_uses?: number | null;
  max_age?: number | null;
  temporary?: boolean;
  created_at?: string | null;
  expires_at?: string | null;
}

export interface DiscordApplicationCommand {
  id: string;
  name: string;
  description?: string;
  type?: number;
}

interface DiscordRateLimitBody {
  message?: string;
  retry_after?: number;
  global?: boolean;
}

export class DiscordApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs: number | null = null
  ) {
    super(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, bodyText: string): number | null {
  const header = response.headers.get("Retry-After");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  }

  try {
    const body = JSON.parse(bodyText) as DiscordRateLimitBody;
    if (typeof body.retry_after === "number" && Number.isFinite(body.retry_after) && body.retry_after >= 0) {
      return Math.ceil(body.retry_after * 1000);
    }
  } catch {
    return null;
  }

  return null;
}

async function discordRequest(path: string, init: RequestInit, retries = 2): Promise<Response> {
  let lastError: DiscordApiError | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(`${DISCORD_API}${path}`, init);
    if (response.status !== 429) return response;

    const text = await response.text();
    const waitMs = retryAfterMs(response, text);
    lastError = new DiscordApiError(response.status, `Discord API 429: Rate Limit. Bitte gleich erneut versuchen.`, waitMs);

    if (attempt < retries) {
      await sleep(Math.min((waitMs ?? 1000) + 150, 5000));
    }
  }

  throw lastError ?? new DiscordApiError(429, "Discord API 429: Rate Limit. Bitte gleich erneut versuchen.");
}

async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await discordRequest(path, init);
  if (!response.ok) {
    const text = await response.text();
    throw new DiscordApiError(response.status, `Discord API ${response.status}: ${text.slice(0, 300)}`);
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

  const response = await discordRequest(`/guilds/${guildId}?with_counts=true`, {
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

export async function fetchDiscordBotGuildMember(env: Env, guildId: string, userId: string): Promise<DiscordBotMember | null> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return null;

  const response = await discordRequest(`/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (response.status === 403 || response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord Bot API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json<DiscordBotMember>();
}

export async function fetchDiscordBotGuildMembers(env: Env, guildId: string, limit = 200): Promise<DiscordBotMember[]> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return [];

  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const response = await discordRequest(`/guilds/${guildId}/members?limit=${safeLimit}`, {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (response.status === 403 || response.status === 404) return [];
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord Bot API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json<DiscordBotMember[]>();
}

export async function fetchDiscordBotGuildRoles(env: Env, guildId: string): Promise<DiscordBotRole[]> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return [];

  return discordFetch<DiscordBotRole[]>(`/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
}

export async function fetchDiscordBotGuildChannels(env: Env, guildId: string): Promise<DiscordBotChannel[]> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return [];

  return discordFetch<DiscordBotChannel[]>(`/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
}

export async function fetchDiscordBotGuildInvites(env: Env, guildId: string): Promise<DiscordBotInvite[]> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) return [];

  const response = await discordRequest(`/guilds/${guildId}/invites`, {
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (response.status === 404) return [];
  if (response.status === 403) {
    throw new DiscordApiError(403, "Dem Bot fehlt auf dieser Guild die Berechtigung, Invite-Links zu lesen.");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new DiscordApiError(response.status, `Discord API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json<DiscordBotInvite[]>();
}

export async function createDiscordChannelInvite(
  env: Env,
  channelId: string,
  options: { maxAge: number; maxUses: number; temporary: boolean }
): Promise<DiscordBotInvite> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) throw new DiscordApiError(500, "DISCORD_BOT_TOKEN ist nicht konfiguriert.");

  return discordFetch<DiscordBotInvite>(`/channels/${channelId}/invites`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      max_age: options.maxAge,
      max_uses: options.maxUses,
      temporary: options.temporary,
      unique: true
    })
  });
}

export async function deleteDiscordInvite(env: Env, code: string): Promise<void> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) throw new DiscordApiError(500, "DISCORD_BOT_TOKEN ist nicht konfiguriert.");

  const response = await discordRequest(`/invites/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken}` }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new DiscordApiError(response.status, `Discord API ${response.status}: ${text.slice(0, 300)}`);
  }
}

export async function updateDiscordBotGuildNickname(env: Env, guildId: string, nickname: string | null): Promise<void> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken) throw new DiscordApiError(500, "DISCORD_BOT_TOKEN ist nicht konfiguriert.");

  const response = await discordRequest(`/guilds/${guildId}/members/@me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ nick: nickname })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new DiscordApiError(response.status, `Discord API ${response.status}: ${text.slice(0, 300)}`);
  }
}

export async function fetchDiscordApplicationCommands(env: Env): Promise<DiscordApplicationCommand[]> {
  const botToken = env.DISCORD_BOT_TOKEN?.trim();
  if (!botToken || !env.DISCORD_CLIENT_ID?.trim()) return [];

  return discordFetch<DiscordApplicationCommand[]>(`/applications/${env.DISCORD_CLIENT_ID}/commands`, {
    headers: { Authorization: `Bot ${botToken}` }
  });
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

export function discordBotInviteUrl(env: Env, guildId: string, state?: string): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  url.searchParams.set("scope", "bot applications.commands");
  url.searchParams.set("permissions", env.BOT_INVITE_PERMISSIONS ?? "1101994781894");
  url.searchParams.set("guild_id", guildId);
  url.searchParams.set("disable_guild_select", "true");

  if (state) {
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
    url.searchParams.set("state", state);
  }

  return url.toString();
}
