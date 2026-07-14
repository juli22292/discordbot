export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  OAUTH_STATE: KVNamespace;
  BOT_EVENT_NONCES: KVNamespace;
  GUILD_MEDIA?: R2Bucket;
  SYNC_QUEUE?: Queue<SyncEventMessage>;
  APP_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN?: string;
  DISCORD_REDIRECT_URI: string;
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
  INTERNAL_BOT_API_SECRET: string;
  SESSION_TTL_SECONDS?: string;
  BOT_INVITE_PERMISSIONS?: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
}

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  scope: string;
  expiresAt: number;
}

export interface SessionUser {
  id: string;
  discordUserId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface ActiveSession {
  id: string;
  user: SessionUser;
  tokenData: TokenData;
  expiresAt: string;
}

export interface GuildAccess {
  session: ActiveSession;
  userGuild: DiscordGuild;
  guild: {
    id: string;
    discordGuildId: string;
    name: string;
    icon: string | null;
    botJoinedAt: string | null;
  };
}

export interface SyncEventMessage {
  eventId: string;
  guildId: string;
  action: string;
  payload: unknown;
  createdAt: string;
  attempt: number;
}
