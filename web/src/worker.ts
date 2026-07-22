import { Hono, type Context } from "hono";
import {
  clearCookieHeader,
  cookieHeader,
  OAUTH_STATE_COOKIE,
  parseCookies,
  SESSION_COOKIE
} from "./server/cookies";
import { decryptJson, encryptJson, randomToken, verifyInternalBotRequest } from "./server/crypto";
import { all, asJson, first, newId, nowIso, parseJson } from "./server/db";
import { combineMediaChunks, detectImageMimeType, imageExtension, splitMediaBytes } from "./server/media";
import {
  DiscordApiError,
  createDiscordChannelInvite,
  deleteDiscordInvite,
  discordAvatarUrl,
  discordBotInviteUrl,
  discordGuildIconUrl,
  discordOAuthAuthorizeUrl,
  exchangeDiscordCode,
  fetchDiscordApplicationCommands,
  fetchDiscordBotGuildChannels,
  fetchDiscordBotGuild,
  fetchDiscordBotGuildMember,
  fetchDiscordBotGuildMembers,
  fetchDiscordBotGuildInvites,
  fetchDiscordBotGuildRoles,
  fetchDiscordGuilds,
  fetchDiscordUser,
  refreshDiscordToken,
  updateDiscordGuildRole,
  updateDiscordBotGuildNickname
} from "./server/discord";
import { PANEL_OWNER_DISCORD_USER_ID, canManageGuild, canUseOwnerAdmin, permissionLabel } from "./server/permissions";
import type { ActiveSession, DiscordGuild, Env, GuildAccess, SessionUser, TokenData } from "./server/types";
import {
  assertSameGuild,
  adminRoleUpdateSchema,
  autoroleSettingsSchema,
  backupActionSchema,
  botAdminActionSchema,
  commandConfigSchema,
  countingResetSchema,
  countingSettingsSchema,
  customCommandSchema,
  guildModuleSettingsSchema,
  inviteCreateSchema,
  levelSettingsSchema,
  logCategories,
  loggingSettingsSchema,
  loggingTestSchema,
  musicSourceSchema,
  nicknameSchema,
  partialCustomCommandSchema,
  pterodactylPowerSchema,
  presenceSchema,
  raidSettingsSchema,
  safeRedirectPath,
  settingsSchema,
  snowflakeSchema,
  securitySettingsSchema,
  tempVoicePanelSchema,
  tempVoiceSettingsSchema,
  ticketPanelSchema,
  ticketSettingsSchema,
  validationError,
  welcomeSettingsSchema
} from "./server/validators";

type AppBindings = { Bindings: Env };
const app = new Hono<AppBindings>();

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self' https://discord.com",
    "upgrade-insecure-requests"
  ].join("; "),
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self)",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin"
};

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

type HonoContext = Context<AppBindings>;

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  encrypted_token_data: string;
  discord_user_id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
}

interface GuildRow {
  id: string;
  discord_guild_id: string;
  name: string;
  icon: string | null;
  bot_joined_at: string | null;
}

interface SettingsRow {
  id: string;
  guild_id: string;
  locale: string;
  timezone: string | null;
  bot_nickname: string | null;
  bot_avatar_media_key: string | null;
  bot_avatar_sync_status: string;
  bot_avatar_sync_error: string | null;
}

interface WelcomeSettingsRow {
  guild_id: string;
  enabled: number;
  channel_id: string | null;
  message: string | null;
  embed_configuration: string;
  auto_role_id: string | null;
}

interface WelcomeEmbedConfig {
  useEmbed: boolean;
  title: string;
  description: string;
  color: string;
  imageMode: "banner" | "thumbnail" | "none";
  imageMediaKey: string | null;
  imageUrl: string | null;
  mentionMember: boolean;
  allowEveryone: boolean;
  allowedRoleIds: string[];
  showGeneratedCard: boolean;
}

interface WelcomeSettingsResponse {
  enabled: boolean;
  channelId: string | null;
  message: string;
  autoRoleId: string | null;
  embed: WelcomeEmbedConfig;
}

type LogCategory = (typeof logCategories)[number];

interface LoggingSettingsRow {
  guild_id: string;
  enabled_events: string;
  channel_mappings: string;
}

interface LoggingSettingsResponse {
  enabled: boolean;
  channelMappings: Record<LogCategory, string | null>;
  events: Record<LogCategory, boolean>;
}

interface TempVoiceSettingsRow {
  guild_id: string;
  enabled: number;
  creator_channel_ids: string;
  category_id: string | null;
  interface_channel_id: string | null;
  name_template: string;
  default_user_limit: number;
  default_bitrate_kbps: number;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  sync_status: string;
  sync_error: string | null;
}

interface TempVoiceSettingsResponse {
  enabled: boolean;
  creatorChannelIds: string[];
  categoryId: string | null;
  interfaceChannelId: string | null;
  nameTemplate: string;
  defaultUserLimit: number;
  defaultBitrateKbps: number;
  panelChannelId: string | null;
  panelMessageId: string | null;
  syncStatus: string;
  syncError: string | null;
}

interface CountingSettingsRow {
  guild_id: string;
  enabled: number;
  channel_id: string | null;
  reset_on_error: number;
  delete_wrong_messages: number;
  milestone_interval: number;
  current_number: number;
  record_number: number;
  total_counts: number;
  total_failures: number;
  last_user_id: string | null;
  sync_status: string;
  sync_error: string | null;
}

interface CountingSettingsResponse {
  enabled: boolean;
  channelId: string | null;
  resetOnError: boolean;
  deleteWrongMessages: boolean;
  milestoneInterval: number;
  currentNumber: number;
  recordNumber: number;
  totalCounts: number;
  totalFailures: number;
  lastUserId: string | null;
  syncStatus: string;
  syncError: string | null;
}

interface LevelRoleReward {
  level: number;
  roleId: string;
}

interface LevelSettingsRow {
  guild_id: string;
  enabled: number;
  announcement_channel_id: string | null;
  role_rewards: string;
  sync_status: string;
  sync_error: string | null;
}

interface LevelSettingsResponse {
  enabled: boolean;
  announcementChannelId: string | null;
  roleRewards: LevelRoleReward[];
  syncStatus: string;
  syncError: string | null;
}

interface AutoroleSettingsRow {
  guild_id: string;
  enabled: number;
  human_role_ids: string;
  bot_role_ids: string;
  delay_seconds: number;
  wait_for_screening: number;
  sync_status: string;
  sync_error: string | null;
}

interface AutoroleSettingsResponse {
  enabled: boolean;
  humanRoleIds: string[];
  botRoleIds: string[];
  delaySeconds: number;
  waitForScreening: boolean;
  syncStatus: string;
  syncError: string | null;
}

type GuildControlModule = "security" | "raidmode" | "tickets" | "backups";

interface GuildControlModuleRow {
  guild_id: string;
  module: GuildControlModule;
  configuration: string;
  runtime_state: string;
  sync_status: string;
  sync_error: string | null;
  updated_at: string;
}

interface GuildControlModuleResponse extends Record<string, unknown> {
  syncStatus: string;
  syncError: string | null;
  updatedAt: string | null;
}

interface BotRuntimeRow {
  id: string;
  status: string | null;
  activity_type: string | null;
  activity_text: string | null;
  latency_ms: number | null;
  ram_mb: number | null;
  cpu_percent: number | null;
  guild_count: number | null;
  user_count: number | null;
  command_count: number | null;
  shard_count: number | null;
  python_version: string | null;
  discord_py_version: string | null;
  platform: string | null;
  bot_version: string | null;
  uptime_seconds: number | null;
  process_uptime_seconds: number | null;
  payload: string;
  updated_at: string;
}

interface AdminGuildRuntimeItem {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  channelCount: number;
  roleCount: number;
  ownerId?: string | null;
  ownerName?: string | null;
  shardId?: number | null;
  createdAt?: string | null;
  joinedAt?: string | null;
}

interface PterodactylRuntime {
  state: string;
  suspended: boolean;
  ramMb: number | null;
  cpuPercent: number | null;
  diskMb: number | null;
  uptimeSeconds: number | null;
  checkedAt: string;
}

interface AdminPermissionCheck {
  key: string;
  label: string;
  description: string;
  ok: boolean | null;
  group: string;
}

interface AdminGuildModules {
  logging: boolean;
  welcome: boolean;
  tempVoice: boolean;
  counting: boolean;
  levelSystem: boolean;
  autorole: boolean;
  spotifyMusic: boolean;
  games: boolean;
  moderation: boolean;
}

interface CookieSessionData {
  kind: "session";
  id: string;
  user: SessionUser;
  tokenData: TokenData;
  expiresAt: string;
}

interface OAuthStateData {
  kind: "login" | "invite";
  state: string;
  returnTo?: string;
  guildId?: string;
  expiresAt: number;
}

type BotInstallStatus = "installed" | "missing" | "unknown";

function json(c: HonoContext, data: unknown, status = 200): Response {
  return c.json(data, status as 200);
}

function setSecurityHeaders(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

function withSecurityHeaders(response: Response): Response {
  try {
    setSecurityHeaders(response.headers);
    return response;
  } catch {
    const secured = new Response(response.body, response);
    setSecurityHeaders(secured.headers);
    return secured;
  }
}

function httpsRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (url.hostname !== "bot.carrothd.de" || (url.protocol !== "http:" && forwardedProto !== "http")) {
    return null;
  }

  url.protocol = "https:";
  return withSecurityHeaders(
    new Response(null, {
      status: 301,
      headers: { Location: url.toString() }
    })
  );
}

function requireEnv(env: Env, key: keyof Env): string {
  const value = env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(500, "missing_configuration", `${String(key)} ist nicht konfiguriert.`);
  }
  return value;
}

function sessionTtl(env: Env): number {
  const raw = Number(env.SESSION_TTL_SECONDS ?? "604800");
  return Number.isFinite(raw) && raw > 0 ? raw : 604800;
}

async function readJsonBody<T>(c: HonoContext): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_json", "Der Request enthält kein gültiges JSON.");
  }
}

async function signedInternalBody(c: HonoContext): Promise<unknown> {
  const bodyText = await c.req.raw.clone().text();
  await verifyInternalBotRequest(c.req.raw, c.env, bodyText);
  if (!bodyText) return {};

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new HttpError(400, "invalid_json", "Der interne Request enthält kein gültiges JSON.");
  }
}

function publicUser(session: ActiveSession): SessionUser {
  return session.user;
}

function hasDb(env: Env): boolean {
  return Boolean((env as { DB?: D1Database }).DB);
}

function botInstallStatus(env: Env, guild: Pick<GuildRow, "bot_joined_at">): BotInstallStatus {
  if (guild.bot_joined_at) return "installed";
  return env.DISCORD_BOT_TOKEN?.trim() ? "missing" : "unknown";
}

function requireDb(env: Env): D1Database {
  if (!hasDb(env)) {
    throw new HttpError(
      503,
      "database_not_configured",
      "Die Datenbank ist noch nicht verbunden. Bitte in Cloudflare das D1-Binding DB anlegen."
    );
  }

  return env.DB;
}

async function encryptedCookieState(env: Env, data: OAuthStateData): Promise<string> {
  requireEnv(env, "ENCRYPTION_KEY");
  return encryptJson(data, env.ENCRYPTION_KEY);
}

async function readEncryptedCookieState(c: HonoContext, expectedState: string, expectedKind?: OAuthStateData["kind"]): Promise<OAuthStateData> {
  requireEnv(c.env, "ENCRYPTION_KEY");
  const cookies = parseCookies(c.req.header("Cookie") ?? null);
  const cookieState = cookies.get(OAUTH_STATE_COOKIE);

  if (!cookieState) {
    throw new HttpError(400, "oauth_state_missing", "Der Login-State fehlt. Bitte erneut anmelden.");
  }

  let stateData: OAuthStateData;

  try {
    stateData = await decryptJson<OAuthStateData>(cookieState, c.env.ENCRYPTION_KEY);
  } catch {
    throw new HttpError(400, "oauth_state_invalid", "Der Login-State konnte nicht gelesen werden. Bitte erneut anmelden.");
  }

  if (
    (expectedKind && stateData.kind !== expectedKind) ||
    stateData.state !== expectedState ||
    stateData.expiresAt < Date.now()
  ) {
    throw new HttpError(400, "oauth_state_invalid", "Discord-Login konnte nicht sicher validiert werden.");
  }

  return stateData;
}

async function getSession(c: HonoContext): Promise<ActiveSession | null> {
  requireEnv(c.env, "ENCRYPTION_KEY");
  const cookies = parseCookies(c.req.header("Cookie") ?? null);
  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) return null;

  if (sessionId.startsWith("v1.")) {
    try {
      const cookieSession = await decryptJson<CookieSessionData>(sessionId, c.env.ENCRYPTION_KEY);

      if (cookieSession.kind !== "session" || cookieSession.expiresAt <= nowIso()) {
        return null;
      }

      if (cookieSession.tokenData.expiresAt <= Date.now()) {
        return null;
      }

      return {
        id: cookieSession.id,
        user: cookieSession.user,
        tokenData: cookieSession.tokenData,
        expiresAt: cookieSession.expiresAt
      };
    } catch {
      return null;
    }
  }

  const db = requireDb(c.env);
  const row = await first<SessionRow>(
    db.prepare(
      `SELECT s.id, s.user_id, s.expires_at, s.encrypted_token_data,
              u.discord_user_id, u.username, u.display_name, u.avatar
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND s.expires_at > ?`
    ).bind(sessionId, nowIso())
  );

  if (!row) return null;

  let tokenData = await decryptJson<TokenData>(row.encrypted_token_data, c.env.ENCRYPTION_KEY);
  if (tokenData.expiresAt < Date.now() + 60_000) {
    tokenData = await refreshDiscordToken(c.env, tokenData);
    const encrypted = await encryptJson(tokenData, c.env.ENCRYPTION_KEY);
    await db.prepare("UPDATE sessions SET encrypted_token_data = ?, updated_at = ? WHERE id = ?")
      .bind(encrypted, nowIso(), row.id)
      .run();
  }

  return {
    id: row.id,
    expiresAt: row.expires_at,
    tokenData,
    user: {
      id: row.user_id,
      discordUserId: row.discord_user_id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar
    }
  };
}

async function requireSession(c: HonoContext): Promise<ActiveSession> {
  const session = await getSession(c);
  if (!session) throw new HttpError(401, "session_required", "Bitte melde dich erneut mit Discord an.");
  return session;
}

async function upsertUser(env: Env, user: Awaited<ReturnType<typeof fetchDiscordUser>>): Promise<string> {
  const db = requireDb(env);
  const existing = await first<{ id: string }>(
    db.prepare("SELECT id FROM users WHERE discord_user_id = ?").bind(user.id)
  );
  const timestamp = nowIso();
  const avatar = discordAvatarUrl(user);

  if (existing) {
    await db.prepare(
      `UPDATE users
          SET username = ?, display_name = ?, avatar = ?, last_login_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(user.username, user.global_name ?? null, avatar, timestamp, timestamp, existing.id)
      .run();
    return existing.id;
  }

  const id = newId("usr");
  await db.prepare(
    `INSERT INTO users (id, discord_user_id, username, display_name, avatar, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, user.username, user.global_name ?? null, avatar, timestamp, timestamp, timestamp)
    .run();
  return id;
}

async function upsertGuildFromDiscord(env: Env, guild: DiscordGuild): Promise<GuildRow> {
  if (!hasDb(env)) {
    return {
      id: guild.id,
      discord_guild_id: guild.id,
      name: guild.name,
      icon: discordGuildIconUrl(guild),
      bot_joined_at: null
    };
  }

  const db = requireDb(env);
  const timestamp = nowIso();
  const icon = discordGuildIconUrl(guild);
  const existing = await first<GuildRow>(
    db.prepare(
      "SELECT id, discord_guild_id, name, icon, bot_joined_at FROM guilds WHERE discord_guild_id = ?"
    ).bind(guild.id)
  );

  if (existing) {
    await db.prepare("UPDATE guilds SET name = ?, icon = ?, updated_at = ? WHERE id = ?")
      .bind(guild.name, icon, timestamp, existing.id)
      .run();
    return { ...existing, name: guild.name, icon };
  }

  const id = newId("gld");
  await db.prepare(
    `INSERT INTO guilds (id, discord_guild_id, name, icon, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, guild.id, guild.name, icon, timestamp, timestamp)
    .run();

  return { id, discord_guild_id: guild.id, name: guild.name, icon, bot_joined_at: null };
}

async function refreshBotPresence(env: Env, guild: GuildRow): Promise<GuildRow> {
  if (!env.DISCORD_BOT_TOKEN?.trim()) return guild;

  let botGuild: Awaited<ReturnType<typeof fetchDiscordBotGuild>>;
  try {
    botGuild = await fetchDiscordBotGuild(env, guild.discord_guild_id);
  } catch (error) {
    console.warn("Discord Bot-Presence-Check fehlgeschlagen", error);
    return guild;
  }

  if (!hasDb(env)) {
    return {
      ...guild,
      bot_joined_at: botGuild ? guild.bot_joined_at ?? nowIso() : null
    };
  }

  const db = requireDb(env);
  const timestamp = nowIso();

  if (botGuild) {
    const joinedAt = guild.bot_joined_at ?? timestamp;
    await db.prepare(
      `UPDATE guilds
          SET bot_joined_at = COALESCE(bot_joined_at, ?),
              bot_removed_at = NULL,
              last_seen_at = ?,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(timestamp, timestamp, timestamp, guild.id)
      .run();
    return { ...guild, bot_joined_at: joinedAt };
  }

  if (guild.bot_joined_at) {
    await db.prepare(
      `UPDATE guilds
          SET bot_joined_at = NULL,
              bot_removed_at = ?,
              updated_at = ?
        WHERE id = ?`
    )
      .bind(timestamp, timestamp, guild.id)
      .run();
  }

  return { ...guild, bot_joined_at: null };
}

async function markBotInstalled(env: Env, guild: GuildAccess["guild"]): Promise<void> {
  if (!hasDb(env)) return;

  const timestamp = nowIso();
  await requireDb(env).prepare(
    `UPDATE guilds
        SET bot_joined_at = COALESCE(bot_joined_at, ?),
            bot_removed_at = NULL,
            last_seen_at = ?,
            updated_at = ?
      WHERE id = ?`
  )
    .bind(timestamp, timestamp, timestamp, guild.id)
    .run();
}

function addQueryParam(path: string, key: string, value: string): string {
  const url = new URL(path, "https://archive-bot.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

async function completeInviteCallback(
  c: HonoContext,
  stateData: OAuthStateData,
  options: { code?: string | null; inviteError?: string | null }
): Promise<Response> {
  if (!stateData.guildId) throw new HttpError(400, "invite_state_invalid", "Die Bot-Einladung ist unvollständig.");
  const access = await requireGuildManagementAccess(c, stateData.guildId, { requireBot: false });
  const returnTo = stateData.returnTo || `/dashboard/${stateData.guildId}/overview`;

  if (options.inviteError) {
    const response = c.redirect(addQueryParam(returnTo, "invite", "cancelled"));
    response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
    return response;
  }

  if (!options.code) {
    throw new HttpError(400, "invite_code_missing", "Discord hat die Bot-Einladung nicht bestätigt.");
  }

  await markBotInstalled(c.env, access.guild);

  const response = c.redirect(addQueryParam(returnTo, "invite", "done"));
  response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
  return response;
}

async function getFreshGuilds(c: HonoContext, session: ActiveSession): Promise<DiscordGuild[]> {
  try {
    return await fetchDiscordGuilds(session.tokenData);
  } catch (error) {
    if (error instanceof DiscordApiError && error.status === 429) {
      throw new HttpError(429, "discord_rate_limited", "Discord begrenzt gerade kurz die Anfragen. Bitte in ein paar Sekunden erneut aktualisieren.");
    }

    throw new HttpError(502, "discord_unavailable", error instanceof Error ? error.message : "Discord ist nicht erreichbar.");
  }
}

async function requireGuildManagementAccess(
  c: HonoContext,
  discordGuildId: string,
  options: { requireBot: boolean } = { requireBot: true }
): Promise<GuildAccess> {
  snowflakeSchema.parse(discordGuildId);
  const session = await requireSession(c);
  const guilds = await getFreshGuilds(c, session);
  const userGuild = guilds.find((guild) => guild.id === discordGuildId);

  if (!userGuild || !canManageGuild(userGuild)) {
    throw new HttpError(403, "guild_access_denied", "Du darfst diese Guild nicht verwalten.");
  }

  const guild = await refreshBotPresence(c.env, await upsertGuildFromDiscord(c.env, userGuild));
  if (options.requireBot && !guild.bot_joined_at) {
    throw new HttpError(409, "bot_not_in_guild", "Der Bot ist auf dieser Guild noch nicht installiert.");
  }

  return {
    session,
    userGuild,
    guild: {
      id: guild.id,
      discordGuildId: guild.discord_guild_id,
      name: guild.name,
      icon: guild.icon,
      botJoinedAt: guild.bot_joined_at
    }
  };
}

async function ensureSettings(env: Env, guildId: string): Promise<SettingsRow> {
  const db = requireDb(env);
  const existing = await first<SettingsRow>(
    db.prepare(
      `SELECT id, guild_id, locale, timezone, bot_nickname, bot_avatar_media_key,
              bot_avatar_sync_status, bot_avatar_sync_error
         FROM guild_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return existing;

  const id = newId("set");
  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO guild_settings (id, guild_id, locale, timezone, created_at, updated_at)
     VALUES (?, ?, 'de', 'Europe/Berlin', ?, ?)`
  )
    .bind(id, guildId, timestamp, timestamp)
    .run();

  return {
    id,
    guild_id: guildId,
    locale: "de",
    timezone: "Europe/Berlin",
    bot_nickname: null,
    bot_avatar_media_key: null,
    bot_avatar_sync_status: "idle",
    bot_avatar_sync_error: null
  };
}

const DEFAULT_WELCOME_SETTINGS = welcomeSettingsSchema.parse({
  enabled: false,
  channelId: null,
  message: "Willkommen {member_mention}! Schön, dass du auf **{server}** bist.",
  autoRoleId: null,
  embed: {
    useEmbed: true,
    title: "Willkommen auf {server}",
    description: "{member_mention}, mach es dir gemütlich. Du bist unser **{member_count}. Mitglied**.",
    color: "#68a8ff",
    imageMode: "banner",
    imageMediaKey: null,
    imageUrl: null,
    mentionMember: true,
    allowEveryone: false,
    allowedRoleIds: [],
    showGeneratedCard: true
  }
}) satisfies WelcomeSettingsResponse;

function normalizeWelcomeSettings(row: WelcomeSettingsRow | null | undefined): WelcomeSettingsResponse {
  const storedEmbed = parseJson<Partial<WelcomeEmbedConfig>>(row?.embed_configuration, {});
  const mergedEmbed = welcomeSettingsSchema.parse({
    ...DEFAULT_WELCOME_SETTINGS,
    enabled: Boolean(row?.enabled),
    channelId: row?.channel_id ?? null,
    message: row?.message ?? DEFAULT_WELCOME_SETTINGS.message,
    autoRoleId: row?.auto_role_id ?? null,
    embed: {
      ...DEFAULT_WELCOME_SETTINGS.embed,
      ...storedEmbed
    }
  }).embed;

  return {
    enabled: Boolean(row?.enabled),
    channelId: row?.channel_id ?? null,
    message: row?.message ?? DEFAULT_WELCOME_SETTINGS.message,
    autoRoleId: row?.auto_role_id ?? null,
    embed: mergedEmbed
  };
}

async function ensureWelcomeSettings(env: Env, guildId: string): Promise<WelcomeSettingsResponse> {
  const db = requireDb(env);
  const existing = await first<WelcomeSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled, channel_id, message, embed_configuration, auto_role_id
         FROM welcome_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeWelcomeSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO welcome_settings (guild_id, enabled, channel_id, message, embed_configuration, auto_role_id, created_at, updated_at)
     VALUES (?, 0, NULL, ?, ?, NULL, ?, ?)`
  )
    .bind(guildId, DEFAULT_WELCOME_SETTINGS.message, asJson(DEFAULT_WELCOME_SETTINGS.embed), timestamp, timestamp)
    .run();

  return DEFAULT_WELCOME_SETTINGS;
}

function emptyLogChannelMappings(): Record<LogCategory, string | null> {
  return Object.fromEntries(logCategories.map((category) => [category, null])) as Record<LogCategory, string | null>;
}

function defaultLogEvents(enabled = true): Record<LogCategory, boolean> {
  return Object.fromEntries(logCategories.map((category) => [category, enabled])) as Record<LogCategory, boolean>;
}

function normalizeLogCategoryMap(value: Record<string, unknown>): Record<LogCategory, string | null> {
  const mappings = emptyLogChannelMappings();

  for (const category of logCategories) {
    const channelId = value[category];
    mappings[category] = typeof channelId === "string" && /^\d{17,20}$/.test(channelId) ? channelId : null;
  }

  return mappings;
}

function normalizeLoggingSettings(row: LoggingSettingsRow | null | undefined): LoggingSettingsResponse {
  const rawMappings = parseJson<Record<string, unknown>>(row?.channel_mappings ?? "", {});
  const savedEnabledEvents = parseJson<string[]>(row?.enabled_events ?? "", []);
  const configured = rawMappings.__configured === true;
  const enabledEvents = new Set(
    (configured || savedEnabledEvents.length ? savedEnabledEvents : [...logCategories]).filter((category): category is LogCategory => {
      return (logCategories as readonly string[]).includes(category);
    })
  );

  return {
    enabled: rawMappings.__enabled === true,
    channelMappings: normalizeLogCategoryMap(rawMappings),
    events: Object.fromEntries(logCategories.map((category) => [category, enabledEvents.has(category)])) as Record<LogCategory, boolean>
  };
}

async function ensureLoggingSettings(env: Env, guildId: string): Promise<LoggingSettingsResponse> {
  const db = requireDb(env);
  const existing = await first<LoggingSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled_events, channel_mappings
         FROM logging_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeLoggingSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO logging_settings (guild_id, enabled_events, channel_mappings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(guildId, asJson([...logCategories]), asJson({ __configured: true, __enabled: false, ...emptyLogChannelMappings() }), timestamp, timestamp)
    .run();

  return {
    enabled: false,
    channelMappings: emptyLogChannelMappings(),
    events: defaultLogEvents(true)
  };
}

const DEFAULT_TEMP_VOICE_SETTINGS: TempVoiceSettingsResponse = {
  enabled: false,
  creatorChannelIds: [],
  categoryId: null,
  interfaceChannelId: null,
  nameTemplate: "{user}s Raum",
  defaultUserLimit: 0,
  defaultBitrateKbps: 64,
  panelChannelId: null,
  panelMessageId: null,
  syncStatus: "idle",
  syncError: null
};

let tempVoiceStorageReady: Promise<void> | null = null;

async function ensureTempVoiceStorage(env: Env): Promise<void> {
  if (!tempVoiceStorageReady) {
    const db = requireDb(env);
    tempVoiceStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS temp_voice_settings (
           guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
           enabled INTEGER NOT NULL DEFAULT 0,
           creator_channel_ids TEXT NOT NULL DEFAULT '[]',
           category_id TEXT,
           interface_channel_id TEXT,
           name_template TEXT NOT NULL DEFAULT '{user}s Raum',
           default_user_limit INTEGER NOT NULL DEFAULT 0,
           default_bitrate_kbps INTEGER NOT NULL DEFAULT 64,
           panel_channel_id TEXT,
           panel_message_id TEXT,
           sync_status TEXT NOT NULL DEFAULT 'idle',
           sync_error TEXT,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_temp_voice_settings_sync ON temp_voice_settings(sync_status, updated_at)"
      ).run();
    })().catch((error) => {
      tempVoiceStorageReady = null;
      throw error;
    });
  }

  await tempVoiceStorageReady;
}

function normalizeTempVoiceSettings(row: TempVoiceSettingsRow | null | undefined): TempVoiceSettingsResponse {
  if (!row) return { ...DEFAULT_TEMP_VOICE_SETTINGS };

  const creatorChannelIds = parseJson<unknown[]>(row.creator_channel_ids, [])
    .map((value) => String(value))
    .filter((value) => /^\d{17,20}$/.test(value));

  return {
    enabled: Boolean(row.enabled),
    creatorChannelIds: [...new Set(creatorChannelIds)],
    categoryId: row.category_id,
    interfaceChannelId: row.interface_channel_id,
    nameTemplate: row.name_template || DEFAULT_TEMP_VOICE_SETTINGS.nameTemplate,
    defaultUserLimit: Number(row.default_user_limit ?? 0),
    defaultBitrateKbps: Number(row.default_bitrate_kbps ?? 64),
    panelChannelId: row.panel_channel_id,
    panelMessageId: row.panel_message_id,
    syncStatus: row.sync_status || "idle",
    syncError: row.sync_error
  };
}

async function ensureTempVoiceSettings(env: Env, guildId: string): Promise<TempVoiceSettingsResponse> {
  await ensureTempVoiceStorage(env);
  const db = requireDb(env);
  const existing = await first<TempVoiceSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled, creator_channel_ids, category_id, interface_channel_id,
              name_template, default_user_limit, default_bitrate_kbps, panel_channel_id,
              panel_message_id, sync_status, sync_error
         FROM temp_voice_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeTempVoiceSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO temp_voice_settings (
       guild_id, enabled, creator_channel_ids, category_id, interface_channel_id,
       name_template, default_user_limit, default_bitrate_kbps, sync_status,
       created_at, updated_at
     ) VALUES (?, 0, '[]', NULL, NULL, ?, 0, 64, 'idle', ?, ?)`
  )
    .bind(guildId, DEFAULT_TEMP_VOICE_SETTINGS.nameTemplate, timestamp, timestamp)
    .run();

  return { ...DEFAULT_TEMP_VOICE_SETTINGS };
}

const DEFAULT_COUNTING_SETTINGS: CountingSettingsResponse = {
  enabled: false,
  channelId: null,
  resetOnError: true,
  deleteWrongMessages: false,
  milestoneInterval: 100,
  currentNumber: 0,
  recordNumber: 0,
  totalCounts: 0,
  totalFailures: 0,
  lastUserId: null,
  syncStatus: "idle",
  syncError: null
};

let countingStorageReady: Promise<void> | null = null;

async function ensureCountingStorage(env: Env): Promise<void> {
  if (!countingStorageReady) {
    const db = requireDb(env);
    countingStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS counting_settings (
           guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
           enabled INTEGER NOT NULL DEFAULT 0,
           channel_id TEXT,
           reset_on_error INTEGER NOT NULL DEFAULT 1,
           delete_wrong_messages INTEGER NOT NULL DEFAULT 0,
           milestone_interval INTEGER NOT NULL DEFAULT 100,
           current_number INTEGER NOT NULL DEFAULT 0,
           record_number INTEGER NOT NULL DEFAULT 0,
           total_counts INTEGER NOT NULL DEFAULT 0,
           total_failures INTEGER NOT NULL DEFAULT 0,
           last_user_id TEXT,
           sync_status TEXT NOT NULL DEFAULT 'idle',
           sync_error TEXT,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_counting_settings_sync ON counting_settings(sync_status, updated_at)"
      ).run();
    })().catch((error) => {
      countingStorageReady = null;
      throw error;
    });
  }

  await countingStorageReady;
}

function normalizeCountingSettings(row: CountingSettingsRow | null | undefined): CountingSettingsResponse {
  if (!row) return { ...DEFAULT_COUNTING_SETTINGS };
  return {
    enabled: Boolean(row.enabled),
    channelId: row.channel_id,
    resetOnError: Boolean(row.reset_on_error),
    deleteWrongMessages: Boolean(row.delete_wrong_messages),
    milestoneInterval: Number(row.milestone_interval ?? 100),
    currentNumber: Number(row.current_number ?? 0),
    recordNumber: Number(row.record_number ?? 0),
    totalCounts: Number(row.total_counts ?? 0),
    totalFailures: Number(row.total_failures ?? 0),
    lastUserId: row.last_user_id,
    syncStatus: row.sync_status || "idle",
    syncError: row.sync_error
  };
}

async function ensureCountingSettings(env: Env, guildId: string): Promise<CountingSettingsResponse> {
  await ensureCountingStorage(env);
  const db = requireDb(env);
  const existing = await first<CountingSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled, channel_id, reset_on_error, delete_wrong_messages,
              milestone_interval, current_number, record_number, total_counts,
              total_failures, last_user_id, sync_status, sync_error
         FROM counting_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeCountingSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO counting_settings (guild_id, created_at, updated_at)
     VALUES (?, ?, ?)`
  ).bind(guildId, timestamp, timestamp).run();
  return { ...DEFAULT_COUNTING_SETTINGS };
}

const DEFAULT_LEVEL_SETTINGS: LevelSettingsResponse = {
  enabled: true,
  announcementChannelId: null,
  roleRewards: [],
  syncStatus: "idle",
  syncError: null
};

let levelStorageReady: Promise<void> | null = null;

async function ensureLevelStorage(env: Env): Promise<void> {
  if (!levelStorageReady) {
    const db = requireDb(env);
    levelStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS level_settings (
           guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
           enabled INTEGER NOT NULL DEFAULT 1,
           announcement_channel_id TEXT,
           role_rewards TEXT NOT NULL DEFAULT '[]',
           sync_status TEXT NOT NULL DEFAULT 'idle',
           sync_error TEXT,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_level_settings_sync ON level_settings(sync_status, updated_at)"
      ).run();
    })().catch((error) => {
      levelStorageReady = null;
      throw error;
    });
  }

  await levelStorageReady;
}

function normalizeLevelSettings(row: LevelSettingsRow | null | undefined): LevelSettingsResponse {
  if (!row) return { ...DEFAULT_LEVEL_SETTINGS, roleRewards: [] };
  const rewards = parseJson<unknown>(row.role_rewards, []);
  const roleRewards = Array.isArray(rewards)
    ? rewards
      .filter((reward): reward is Record<string, unknown> => Boolean(reward && typeof reward === "object"))
      .map((reward) => ({ level: Number(reward.level), roleId: String(reward.roleId ?? reward.role_id ?? "") }))
      .filter((reward) => Number.isInteger(reward.level) && reward.level >= 1 && reward.level <= 1000 && /^\d{17,20}$/.test(reward.roleId))
      .sort((a, b) => a.level - b.level)
    : [];

  return {
    enabled: Boolean(row.enabled),
    announcementChannelId: row.announcement_channel_id,
    roleRewards,
    syncStatus: row.sync_status || "idle",
    syncError: row.sync_error
  };
}

async function ensureLevelSettings(env: Env, guildId: string): Promise<LevelSettingsResponse> {
  await ensureLevelStorage(env);
  const db = requireDb(env);
  const existing = await first<LevelSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled, announcement_channel_id, role_rewards, sync_status, sync_error
         FROM level_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeLevelSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO level_settings (guild_id, created_at, updated_at)
     VALUES (?, ?, ?)`
  ).bind(guildId, timestamp, timestamp).run();
  return { ...DEFAULT_LEVEL_SETTINGS, roleRewards: [] };
}

const DEFAULT_AUTOROLE_SETTINGS: AutoroleSettingsResponse = {
  enabled: false,
  humanRoleIds: [],
  botRoleIds: [],
  delaySeconds: 0,
  waitForScreening: true,
  syncStatus: "idle",
  syncError: null
};

let autoroleStorageReady: Promise<void> | null = null;

async function ensureAutoroleStorage(env: Env): Promise<void> {
  if (!autoroleStorageReady) {
    const db = requireDb(env);
    autoroleStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS autorole_settings (
           guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
           enabled INTEGER NOT NULL DEFAULT 0,
           human_role_ids TEXT NOT NULL DEFAULT '[]',
           bot_role_ids TEXT NOT NULL DEFAULT '[]',
           delay_seconds INTEGER NOT NULL DEFAULT 0,
           wait_for_screening INTEGER NOT NULL DEFAULT 1,
           sync_status TEXT NOT NULL DEFAULT 'idle',
           sync_error TEXT,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_autorole_settings_sync ON autorole_settings(sync_status, updated_at)"
      ).run();
    })().catch((error) => {
      autoroleStorageReady = null;
      throw error;
    });
  }

  await autoroleStorageReady;
}

function normalizeRoleIds(value: unknown): string[] {
  const raw = typeof value === "string" ? parseJson<unknown>(value, []) : value;
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(String).filter((roleId) => /^\d{17,20}$/.test(roleId)))).slice(0, 25);
}

function normalizeAutoroleSettings(row: AutoroleSettingsRow | null | undefined): AutoroleSettingsResponse {
  if (!row) return { ...DEFAULT_AUTOROLE_SETTINGS, humanRoleIds: [], botRoleIds: [] };
  return {
    enabled: Boolean(row.enabled),
    humanRoleIds: normalizeRoleIds(row.human_role_ids),
    botRoleIds: normalizeRoleIds(row.bot_role_ids),
    delaySeconds: Math.max(0, Math.min(3600, Number(row.delay_seconds) || 0)),
    waitForScreening: Boolean(row.wait_for_screening),
    syncStatus: row.sync_status || "idle",
    syncError: row.sync_error
  };
}

async function ensureAutoroleSettings(env: Env, guildId: string): Promise<AutoroleSettingsResponse> {
  await ensureAutoroleStorage(env);
  const db = requireDb(env);
  const existing = await first<AutoroleSettingsRow>(
    db.prepare(
      `SELECT guild_id, enabled, human_role_ids, bot_role_ids, delay_seconds,
              wait_for_screening, sync_status, sync_error
         FROM autorole_settings
        WHERE guild_id = ?`
    ).bind(guildId)
  );

  if (existing) return normalizeAutoroleSettings(existing);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO autorole_settings (guild_id, created_at, updated_at)
     VALUES (?, ?, ?)`
  ).bind(guildId, timestamp, timestamp).run();
  return { ...DEFAULT_AUTOROLE_SETTINGS, humanRoleIds: [], botRoleIds: [] };
}

const DEFAULT_SECURITY_CONFIGURATION = {
  antispamEnabled: false,
  antispamMessageLimit: 5,
  antispamWindowSeconds: 8,
  antispamTimeoutSeconds: 60,
  antilinkEnabled: false,
  antilinkTimeoutSeconds: 0,
  antiinviteEnabled: false,
  antiinviteTimeoutSeconds: 60,
  antimentionLimit: 0,
  antimentionTimeoutSeconds: 60,
  accountAgeMinDays: 0,
  quarantineRoleId: null,
  verificationEnabled: false,
  verificationChannelId: null,
  verificationRoleId: null,
  verificationTitle: "Verifizierung",
  verificationText: "Klicke auf den Button, um dich zu verifizieren.",
  auditLogWatchEnabled: false,
  antinukeEnabled: false,
  antinukeLimit: 3,
  antinukeWindowSeconds: 60,
  antinukePunishment: "log",
  allowedDomains: [],
  blockedDomains: []
};

const DEFAULT_RAID_CONFIGURATION = {
  profile: "off",
  panicEnabled: false,
  panicSlowmodeSeconds: 10
};

const DEFAULT_TICKET_CONFIGURATION = {
  enabled: false,
  ticketCategoryId: null,
  panelChannelId: null,
  logChannelId: null,
  supportRoleIds: [],
  notifyRoleId: null,
  panelTitle: "Ticketsystem",
  panelDescription: "Wähle unten eine Kategorie aus, um ein Ticket zu erstellen.",
  formTitle: "Ticket-Fragen",
  formQuestions: [],
  selectCategories: [
    { label: "Support", description: "Allgemeine Hilfe und Fragen", emoji: "🎫", value: "support" },
    { label: "Technik", description: "Technische Probleme melden", emoji: "🛠️", value: "technik" },
    { label: "Sonstiges", description: "Andere Anliegen", emoji: "💬", value: "sonstiges" }
  ],
  ratingEnabled: false,
  autoCloseHours: 0,
  reminderHours: 0,
  slaHours: 0,
  blacklistRoleIds: [],
  blacklistUserIds: []
};

const DEFAULT_CONTROL_CONFIGURATIONS: Record<GuildControlModule, Record<string, unknown>> = {
  security: DEFAULT_SECURITY_CONFIGURATION,
  raidmode: DEFAULT_RAID_CONFIGURATION,
  tickets: DEFAULT_TICKET_CONFIGURATION,
  backups: {}
};

const DEFAULT_CONTROL_RUNTIME: Record<GuildControlModule, Record<string, unknown>> = {
  security: { healthScore: 0, activeProtections: 0, totalProtections: 8 },
  raidmode: { raidmodeEnabled: false, panicEnabled: false },
  tickets: { totalTickets: 0, openTickets: 0, closedTickets: 0, deletedTickets: 0, averageRating: null, panelMessageId: null },
  backups: { items: [], lastSavedAt: null }
};

let guildControlStorageReady: Promise<void> | null = null;

async function ensureGuildControlStorage(env: Env): Promise<void> {
  if (!guildControlStorageReady) {
    const db = requireDb(env);
    guildControlStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS guild_control_modules (
           guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
           module TEXT NOT NULL,
           configuration TEXT NOT NULL DEFAULT '{}',
           runtime_state TEXT NOT NULL DEFAULT '{}',
           sync_status TEXT NOT NULL DEFAULT 'idle',
           sync_error TEXT,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY (guild_id, module)
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_guild_control_modules_sync ON guild_control_modules(module, sync_status, updated_at)"
      ).run();
    })().catch((error) => {
      guildControlStorageReady = null;
      throw error;
    });
  }
  await guildControlStorageReady;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeGuildControlModule(row: GuildControlModuleRow | null | undefined, module: GuildControlModule): GuildControlModuleResponse {
  const configuration = row ? recordValue(parseJson(row.configuration, {})) : {};
  const runtime = row ? recordValue(parseJson(row.runtime_state, {})) : {};
  return {
    ...DEFAULT_CONTROL_CONFIGURATIONS[module],
    ...configuration,
    ...DEFAULT_CONTROL_RUNTIME[module],
    ...runtime,
    syncStatus: row?.sync_status || "idle",
    syncError: row?.sync_error ?? null,
    updatedAt: row?.updated_at ?? null
  };
}

async function ensureGuildControlModule(env: Env, guildId: string, module: GuildControlModule): Promise<GuildControlModuleResponse> {
  await ensureGuildControlStorage(env);
  const db = requireDb(env);
  const existing = await first<GuildControlModuleRow>(
    db.prepare(
      `SELECT guild_id, module, configuration, runtime_state, sync_status, sync_error, updated_at
         FROM guild_control_modules
        WHERE guild_id = ? AND module = ?`
    ).bind(guildId, module)
  );
  if (existing) return normalizeGuildControlModule(existing, module);

  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO guild_control_modules (
       guild_id, module, configuration, runtime_state, sync_status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'idle', ?, ?)`
  ).bind(
    guildId,
    module,
    asJson(DEFAULT_CONTROL_CONFIGURATIONS[module]),
    asJson(DEFAULT_CONTROL_RUNTIME[module]),
    timestamp,
    timestamp
  ).run();
  return normalizeGuildControlModule(null, module);
}

async function setGuildControlPending(
  env: Env,
  guildId: string,
  module: GuildControlModule,
  configuration: Record<string, unknown>,
  runtimeState?: Record<string, unknown>
): Promise<void> {
  await ensureGuildControlStorage(env);
  const timestamp = nowIso();
  await env.DB.prepare(
    `INSERT INTO guild_control_modules (
       guild_id, module, configuration, runtime_state, sync_status, sync_error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(guild_id, module) DO UPDATE SET
       configuration = excluded.configuration,
       runtime_state = CASE WHEN ? IS NULL THEN guild_control_modules.runtime_state ELSE excluded.runtime_state END,
       sync_status = 'pending', sync_error = NULL, updated_at = excluded.updated_at`
  ).bind(
    guildId,
    module,
    asJson(configuration),
    asJson(runtimeState ?? DEFAULT_CONTROL_RUNTIME[module]),
    timestamp,
    timestamp,
    runtimeState ? "replace" : null
  ).run();
}

function mediaPreviewUrl(discordGuildId: string, mediaKey: string): string {
  return `/api/guilds/${discordGuildId}/media?key=${encodeURIComponent(mediaKey)}`;
}

let guildMediaStorageReady: Promise<void> | null = null;

async function ensureGuildMediaStorage(env: Env): Promise<void> {
  if (!guildMediaStorageReady) {
    const db = requireDb(env);
    guildMediaStorageReady = (async () => {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS guild_media_chunks (
           media_id TEXT NOT NULL REFERENCES guild_media(id) ON DELETE CASCADE,
           chunk_index INTEGER NOT NULL,
           chunk_data BLOB NOT NULL,
           PRIMARY KEY (media_id, chunk_index)
         )`
      ).run();
      await db.prepare(
        "CREATE INDEX IF NOT EXISTS idx_guild_media_chunks_media ON guild_media_chunks(media_id, chunk_index)"
      ).run();
    })().catch((error) => {
      guildMediaStorageReady = null;
      throw error;
    });
  }

  await guildMediaStorageReady;
}

async function storeGuildMedia(
  env: Env,
  media: {
    id: string;
    guildId: string;
    mediaKey: string;
    mimeType: string;
    createdByDiscordUserId: string;
  },
  bytes: ArrayBuffer
): Promise<void> {
  if (bytes.byteLength === 0) throw new HttpError(400, "media_empty", "Die Bilddatei ist leer.");
  await ensureGuildMediaStorage(env);
  const db = requireDb(env);
  const chunks = splitMediaBytes(bytes);
  const statements: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO guild_media (id, guild_id, media_key, mime_type, size_bytes, created_by_discord_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      media.id,
      media.guildId,
      media.mediaKey,
      media.mimeType,
      bytes.byteLength,
      media.createdByDiscordUserId,
      nowIso()
    ),
    ...chunks.map((chunk, index) => db.prepare(
      "INSERT INTO guild_media_chunks (media_id, chunk_index, chunk_data) VALUES (?, ?, ?)"
    ).bind(media.id, index, chunk))
  ];

  await db.batch(statements);
}

async function loadGuildMedia(
  env: Env,
  mediaKey: string,
  guildId?: string
): Promise<{ body: ArrayBuffer; mimeType: string; sizeBytes: number } | null> {
  await ensureGuildMediaStorage(env);
  const db = requireDb(env);
  const media = guildId
    ? await first<{ id: string; mime_type: string; size_bytes: number }>(
        db.prepare("SELECT id, mime_type, size_bytes FROM guild_media WHERE media_key = ? AND guild_id = ?")
          .bind(mediaKey, guildId)
      )
    : await first<{ id: string; mime_type: string; size_bytes: number }>(
        db.prepare("SELECT id, mime_type, size_bytes FROM guild_media WHERE media_key = ?").bind(mediaKey)
      );

  if (!media) return null;
  const chunks = await all<{ chunk_data: number[] }>(
    db.prepare(
      "SELECT chunk_data FROM guild_media_chunks WHERE media_id = ? ORDER BY chunk_index ASC"
    ).bind(media.id)
  );

  return {
    body: combineMediaChunks(chunks.map((chunk) => chunk.chunk_data), Number(media.size_bytes)),
    mimeType: media.mime_type,
    sizeBytes: Number(media.size_bytes)
  };
}

async function deleteGuildMedia(env: Env, guildId: string, mediaKey: string): Promise<void> {
  await ensureGuildMediaStorage(env);
  const db = requireDb(env);
  const media = await first<{ id: string }>(
    db.prepare("SELECT id FROM guild_media WHERE guild_id = ? AND media_key = ?").bind(guildId, mediaKey)
  );

  if (!media) return;
  await db.batch([
    db.prepare("DELETE FROM guild_media_chunks WHERE media_id = ?").bind(media.id),
    db.prepare("DELETE FROM guild_media WHERE id = ? AND guild_id = ?").bind(media.id, guildId)
  ]);
}

async function assertGuildMedia(env: Env, guildId: string, mediaKey: string | null | undefined): Promise<void> {
  if (!mediaKey) return;
  const row = await first<{ id: string }>(
    requireDb(env).prepare("SELECT id FROM guild_media WHERE guild_id = ? AND media_key = ?").bind(guildId, mediaKey)
  );
  if (!row) {
    throw new HttpError(400, "media_not_found", "Das ausgewählte Begrüßungsbild gehört nicht zu dieser Guild.");
  }
}

function adminUserIds(_env: Env): Set<string> {
  return new Set([PANEL_OWNER_DISCORD_USER_ID]);
}

async function requireAdminSession(c: HonoContext): Promise<ActiveSession> {
  const session = await requireSession(c);
  const allowedIds = adminUserIds(c.env);

  if (allowedIds.size > 0) {
    if (!allowedIds.has(session.user.discordUserId) || !canUseOwnerAdmin(session.user.discordUserId)) {
      throw new HttpError(403, "admin_forbidden", "Du bist für den Admin-Bereich nicht freigeschaltet.");
    }

    return session;
  }

  const guilds = await getFreshGuilds(c, session);
  if (!guilds.some(canManageGuild)) {
    throw new HttpError(403, "admin_forbidden", "Du brauchst mindestens einen verwaltbaren Discord-Server.");
  }

  return session;
}

async function ensureBotRuntimeTable(env: Env): Promise<void> {
  const db = requireDb(env);
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS bot_runtime_status (
       id TEXT PRIMARY KEY,
       status TEXT,
       activity_type TEXT,
       activity_text TEXT,
       latency_ms REAL,
       ram_mb REAL,
       cpu_percent REAL,
       guild_count INTEGER,
       user_count INTEGER,
       command_count INTEGER,
       shard_count INTEGER,
       python_version TEXT,
       discord_py_version TEXT,
       platform TEXT,
       bot_version TEXT,
       uptime_seconds INTEGER,
       process_uptime_seconds INTEGER,
       payload TEXT NOT NULL DEFAULT '{}',
       updated_at TEXT NOT NULL
     )`
  ).run();
}

function normalizeBotRuntime(row: BotRuntimeRow | null): Record<string, unknown> | null {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    activityType: row.activity_type,
    activityText: row.activity_text,
    latencyMs: row.latency_ms,
    ramMb: row.ram_mb,
    cpuPercent: row.cpu_percent,
    guildCount: row.guild_count,
    userCount: row.user_count,
    commandCount: row.command_count,
    shardCount: row.shard_count,
    pythonVersion: row.python_version,
    discordPyVersion: row.discord_py_version,
    platform: row.platform,
    botVersion: row.bot_version,
    uptimeSeconds: row.uptime_seconds,
    processUptimeSeconds: row.process_uptime_seconds,
    updatedAt: row.updated_at,
    details: parseJson<Record<string, unknown>>(row.payload, {})
  };
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundNumber(value: number | null, fractionDigits = 2): number | null {
  if (value === null) return null;
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function pterodactylPanelUrl(env: Env): string | null {
  const raw = env.PTERODACTYL_PANEL_URL?.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return null;
  }
}

async function fetchPterodactylRuntime(env: Env): Promise<PterodactylRuntime | null> {
  const panelUrl = pterodactylPanelUrl(env);
  const apiKey = env.PTERODACTYL_CLIENT_API_KEY?.trim();
  const serverId = env.PTERODACTYL_SERVER_ID?.trim();

  if (!panelUrl || !apiKey || !serverId) return null;

  try {
    const response = await fetch(`${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}/resources`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`Pterodactyl API ${response.status}: ${text.slice(0, 300)}`);
      return null;
    }

    const data = await response.json() as {
      attributes?: {
        current_state?: string;
        is_suspended?: boolean;
        resources?: {
          memory_bytes?: number;
          cpu_absolute?: number;
          disk_bytes?: number;
          uptime?: number;
        };
      };
    };
    const attributes = data.attributes ?? {};
    const resources = attributes.resources ?? {};
    const memoryBytes = finiteNumber(resources.memory_bytes);
    const diskBytes = finiteNumber(resources.disk_bytes);
    const uptimeMs = finiteNumber(resources.uptime);

    return {
      state: String(attributes.current_state ?? "unknown"),
      suspended: Boolean(attributes.is_suspended),
      ramMb: roundNumber(memoryBytes === null ? null : memoryBytes / 1024 / 1024),
      cpuPercent: roundNumber(finiteNumber(resources.cpu_absolute)),
      diskMb: roundNumber(diskBytes === null ? null : diskBytes / 1024 / 1024),
      uptimeSeconds: uptimeMs === null ? null : Math.floor(uptimeMs / 1000),
      checkedAt: nowIso()
    };
  } catch (error) {
    console.warn("Pterodactyl API konnte nicht abgefragt werden", error);
    return null;
  }
}

async function sendPterodactylPowerSignal(env: Env, signal: "start" | "stop" | "restart" | "kill"): Promise<void> {
  const panelUrl = pterodactylPanelUrl(env);
  const apiKey = env.PTERODACTYL_CLIENT_API_KEY?.trim();
  const serverId = env.PTERODACTYL_SERVER_ID?.trim();

  if (!panelUrl || !apiKey || !serverId) {
    throw new HttpError(503, "pterodactyl_not_configured", "Pterodactyl ist im Webpanel noch nicht vollständig konfiguriert.");
  }

  const response = await fetch(`${panelUrl}/api/client/servers/${encodeURIComponent(serverId)}/power`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ signal })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new HttpError(response.status, "pterodactyl_power_failed", `Pterodactyl ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function fallbackAdminGuilds(env: Env): Promise<AdminGuildRuntimeItem[]> {
  const rows = await all<Record<string, unknown>>(
    requireDb(env).prepare(
      `SELECT
         g.discord_guild_id AS id,
         g.name,
         g.icon,
         g.bot_joined_at AS joinedAt,
         (SELECT COUNT(*) FROM guild_channels c WHERE c.guild_id = g.id) AS channelCount,
         (SELECT COUNT(*) FROM guild_roles r WHERE r.guild_id = g.id) AS roleCount
       FROM guilds g
       WHERE g.bot_joined_at IS NOT NULL
       ORDER BY LOWER(g.name) ASC`
    )
  );

  return rows.map((guild) => ({
    id: String(guild.id ?? ""),
    name: String(guild.name ?? "Unbekannte Guild"),
    icon: guild.icon ? String(guild.icon) : null,
    memberCount: null,
    channelCount: Number(guild.channelCount ?? 0),
    roleCount: Number(guild.roleCount ?? 0),
    joinedAt: guild.joinedAt ? String(guild.joinedAt) : null
  }));
}

async function requireAdminGuild(env: Env, discordGuildId: string): Promise<GuildRow> {
  snowflakeSchema.parse(discordGuildId);
  const existing = await first<GuildRow>(
    requireDb(env).prepare(
      `SELECT id, discord_guild_id, name, icon, bot_joined_at
         FROM guilds
        WHERE discord_guild_id = ?`
    ).bind(discordGuildId)
  );

  if (existing?.bot_joined_at) return existing;

  const liveGuild = await fetchDiscordBotGuild(env, discordGuildId);

  if (!liveGuild) {
    throw new HttpError(404, "guild_not_found", "Diese Guild wurde im Owner-Bereich nicht gefunden oder der Bot ist dort nicht mehr installiert.");
  }

  const timestamp = nowIso();
  const icon = discordGuildIconUrl({ id: liveGuild.id, icon: liveGuild.icon ?? null });

  if (existing) {
    await requireDb(env).prepare(
      `UPDATE guilds
          SET name = ?, icon = ?, bot_joined_at = COALESCE(bot_joined_at, ?),
              bot_removed_at = NULL, last_seen_at = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(liveGuild.name, icon, timestamp, timestamp, timestamp, existing.id)
      .run();

    return {
      ...existing,
      name: liveGuild.name,
      icon,
      bot_joined_at: existing.bot_joined_at ?? timestamp
    };
  }

  const id = newId("gld");
  await requireDb(env).prepare(
    `INSERT INTO guilds (id, discord_guild_id, name, icon, bot_joined_at, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, liveGuild.id, liveGuild.name, icon, timestamp, timestamp, timestamp, timestamp)
    .run();

  return {
    id,
    discord_guild_id: liveGuild.id,
    name: liveGuild.name,
    icon,
    bot_joined_at: timestamp
  };
}

function discordRoleColor(value: unknown): string {
  const color = Number(value ?? 0);
  if (!Number.isFinite(color) || color <= 0) return "#5865F2";
  return `#${Math.max(0, Math.min(0xffffff, color)).toString(16).padStart(6, "0").toUpperCase()}`;
}

function discordRoleColorInt(value: string): number {
  return parseInt(value.replace("#", ""), 16);
}

const DISCORD_PERMISSION_BITS = {
  createInstantInvite: 1n,
  kickMembers: 2n,
  banMembers: 4n,
  administrator: 8n,
  manageChannels: 16n,
  manageGuild: 32n,
  viewAuditLog: 128n,
  viewChannel: 1024n,
  sendMessages: 2048n,
  manageMessages: 8192n,
  connect: 1048576n,
  speak: 2097152n,
  manageRoles: 268435456n,
  moderateMembers: 1099511627776n
} as const;

const permissionChecks: Array<{ key: keyof typeof DISCORD_PERMISSION_BITS; label: string; description: string; group: string }> = [
  { key: "viewChannel", label: "Kanäle sehen", description: "Basis für Browser, Logging-Auswahl und normale Bot-Aktionen.", group: "Basis" },
  { key: "sendMessages", label: "Nachrichten senden", description: "Nötig für Logs, Welcome, Hinweise und Bot-Antworten.", group: "Basis" },
  { key: "createInstantInvite", label: "Invites erstellen", description: "Nötig für Invite-Manager und Bot-erstellte Einladungen.", group: "Guild" },
  { key: "manageRoles", label: "Rollen verwalten", description: "Nötig für Role-Aktionen und Webpanel-Rollenbearbeitung.", group: "Guild" },
  { key: "manageChannels", label: "Kanäle verwalten", description: "Nötig für Temp-Voice, Setup-Kanäle und Channel-Automation.", group: "Guild" },
  { key: "viewAuditLog", label: "Audit-Log lesen", description: "Nötig für Antinuke, Moderationsnachweise und Logging.", group: "Moderation" },
  { key: "manageMessages", label: "Nachrichten verwalten", description: "Nötig für Cleanup, Moderation und gelöschte Inhalte.", group: "Moderation" },
  { key: "kickMembers", label: "Mitglieder kicken", description: "Nötig für Kick-Moderation.", group: "Moderation" },
  { key: "banMembers", label: "Mitglieder bannen", description: "Nötig für Ban-Moderation.", group: "Moderation" },
  { key: "moderateMembers", label: "Timeouts setzen", description: "Nötig für Timeouts und Auto-Moderation.", group: "Moderation" },
  { key: "connect", label: "Voice verbinden", description: "Nötig für Musik und Voice-Funktionen.", group: "Voice" },
  { key: "speak", label: "Voice sprechen", description: "Nötig für Musik-Wiedergabe.", group: "Voice" }
];

function parsePermissionBits(value: unknown): bigint | null {
  try {
    const text = String(value ?? "0");
    if (!/^\d+$/.test(text)) return null;
    return BigInt(text);
  } catch {
    return null;
  }
}

function computeBotPermissionBits(guildId: string, roles: Array<Record<string, unknown>>, botMember: Record<string, unknown> | null): bigint | null {
  if (!botMember) return null;
  const roleIds = new Set<string>([guildId]);
  const memberRoles = Array.isArray(botMember.roles) ? botMember.roles : [];

  for (const roleId of memberRoles) {
    roleIds.add(String(roleId));
  }

  let bits = 0n;
  let sawPermission = false;

  for (const role of roles) {
    const roleId = String(role.id ?? "");
    if (!roleIds.has(roleId)) continue;
    const permissions = parsePermissionBits(role.permissions);
    if (permissions === null) continue;
    bits |= permissions;
    sawPermission = true;
  }

  return sawPermission ? bits : null;
}

function buildPermissionChecks(guildId: string, roles: Array<Record<string, unknown>>, botMember: Record<string, unknown> | null): AdminPermissionCheck[] {
  const bits = computeBotPermissionBits(guildId, roles, botMember);
  const hasAdmin = bits !== null && (bits & DISCORD_PERMISSION_BITS.administrator) === DISCORD_PERMISSION_BITS.administrator;

  return permissionChecks.map((check) => ({
    key: check.key,
    label: check.label,
    description: check.description,
    group: check.group,
    ok: bits === null ? null : hasAdmin || (bits & DISCORD_PERMISSION_BITS[check.key]) === DISCORD_PERMISSION_BITS[check.key]
  }));
}

function normalizeGuildModules(value: unknown): AdminGuildModules {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    logging: Boolean(raw.logging),
    welcome: Boolean(raw.welcome),
    tempVoice: Boolean(raw.tempVoice ?? raw.temp_voice),
    counting: Boolean(raw.counting),
    levelSystem: Boolean(raw.levelSystem ?? raw.level_system),
    autorole: Boolean(raw.autorole),
    spotifyMusic: Boolean(raw.spotifyMusic ?? raw.spotify_music),
    games: Boolean(raw.games),
    moderation: Boolean(raw.moderation)
  };
}

function discordChannelTypeLabel(value: unknown): string {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const labels: Record<number, string> = {
      0: "Text",
      2: "Voice",
      4: "Kategorie",
      5: "News",
      10: "News-Thread",
      11: "Thread",
      12: "Privater Thread",
      13: "Stage",
      15: "Forum"
    };
    return labels[numeric] ?? `Typ ${numeric}`;
  }

  return String(value || "unknown");
}

function discordUserAvatarUrl(user: { id?: string; avatar?: string | null } | undefined): string | null {
  if (!user?.id || !user.avatar) return null;
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

function runtimeGuildFromRow(row: BotRuntimeRow | null, guildId: string): Record<string, unknown> | null {
  const payload = parseJson<Record<string, unknown>>(row?.payload ?? "", {});
  const guilds = Array.isArray(payload.guilds) ? payload.guilds : [];
  return (guilds.find((item) => {
    return item && typeof item === "object" && String((item as Record<string, unknown>).id ?? "") === guildId;
  }) as Record<string, unknown> | undefined) ?? null;
}

function normalizeAdminRole(role: Record<string, unknown>) {
  const color = discordRoleColor(role.color);
  return {
    id: String(role.id ?? role.discord_role_id ?? ""),
    name: String(role.name ?? "Unbenannte Rolle"),
    color,
    position: Number(role.position ?? 0),
    managed: Boolean(role.managed),
    botCanManage: Boolean(role.botCanManage ?? role.bot_can_manage),
    permissions: role.permissions !== undefined && role.permissions !== null ? String(role.permissions) : null,
    mentionable: Boolean(role.mentionable),
    hoist: Boolean(role.hoist)
  };
}

function normalizeAdminChannel(channel: Record<string, unknown>) {
  return {
    id: String(channel.id ?? channel.discord_channel_id ?? ""),
    name: String(channel.name ?? "unbenannt"),
    type: discordChannelTypeLabel(channel.type ?? channel.channel_type),
    categoryId: channel.categoryId ? String(channel.categoryId) : channel.category_id ? String(channel.category_id) : null,
    categoryName: channel.categoryName ? String(channel.categoryName) : channel.category_name ? String(channel.category_name) : null,
    position: Number(channel.position ?? 0),
    canView: channel.canView !== undefined ? Boolean(channel.canView) : channel.can_view !== undefined ? Boolean(channel.can_view) : null,
    canSend: channel.canSend !== undefined ? Boolean(channel.canSend) : channel.can_send !== undefined ? Boolean(channel.can_send) : null
  };
}

function normalizeAdminMember(member: Record<string, unknown>) {
  const user = (member.user && typeof member.user === "object" ? member.user : {}) as Record<string, unknown>;
  const username = String(user.username ?? "Unbekannt");
  const globalName = user.global_name ? String(user.global_name) : null;
  const nick = member.nick ? String(member.nick) : null;
  return {
    id: String(user.id ?? member.id ?? ""),
    username,
    displayName: nick || globalName || username,
    globalName,
    nick,
    avatar: discordUserAvatarUrl({ id: String(user.id ?? ""), avatar: user.avatar ? String(user.avatar) : null }),
    bot: Boolean(user.bot),
    roles: Array.isArray(member.roles) ? member.roles.map((role) => String(role)) : [],
    joinedAt: member.joined_at ? String(member.joined_at) : null,
    premiumSince: member.premium_since ? String(member.premium_since) : null
  };
}

function inviteCodeFromInput(value: string): string {
  let text = String(value || "").trim().replace(/^<|>$/g, "");
  text = text.replace(/^https?:\/\//i, "").replace(/^www\./i, "");

  for (const prefix of ["discord.gg/", "discord.com/invite/", "discordapp.com/invite/"]) {
    if (text.toLowerCase().startsWith(prefix)) {
      text = text.slice(prefix.length);
      break;
    }
  }

  return text.split("?")[0]?.split("/")[0]?.trim() ?? "";
}

function normalizeAdminInvite(invite: Record<string, unknown>) {
  const channel = (invite.channel && typeof invite.channel === "object" ? invite.channel : {}) as Record<string, unknown>;
  const inviter = (invite.inviter && typeof invite.inviter === "object" ? invite.inviter : {}) as Record<string, unknown>;
  const code = String(invite.code ?? "");

  return {
    code,
    url: String(invite.url ?? `https://discord.gg/${code}`),
    channelId: channel.id ? String(channel.id) : null,
    channelName: channel.name ? String(channel.name) : null,
    inviterId: inviter.id ? String(inviter.id) : null,
    inviterName: inviter.global_name ? String(inviter.global_name) : inviter.username ? String(inviter.username) : null,
    uses: finiteNumber(invite.uses),
    maxUses: finiteNumber(invite.max_uses),
    maxAge: finiteNumber(invite.max_age),
    temporary: Boolean(invite.temporary),
    createdAt: invite.created_at ? String(invite.created_at) : null,
    expiresAt: invite.expires_at ? String(invite.expires_at) : null
  };
}

async function refreshCommandStatsFromDiscord(env: Env, knownCommands: number): Promise<number> {
  if (knownCommands > 0 || !env.DISCORD_BOT_TOKEN?.trim() || !env.DISCORD_CLIENT_ID?.trim()) {
    return knownCommands;
  }

  try {
    const commands = await fetchDiscordApplicationCommands(env);
    if (!commands.length) return knownCommands;

    const timestamp = nowIso();
    for (const command of commands) {
      if (!command.name || !/^[a-z0-9 _-]{1,80}$/.test(command.name)) continue;
      await requireDb(env).prepare(
        `INSERT INTO bot_commands (id, command_name, description, command_type, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(command_name) DO UPDATE SET
           description = excluded.description,
           command_type = excluded.command_type,
           updated_at = excluded.updated_at`
      )
        .bind(newId("bc"), command.name, command.description ?? "", "slash", timestamp)
        .run();
    }

    return commands.length;
  } catch (error) {
    console.warn("Discord Commands konnten nicht direkt geladen werden", error);
    return knownCommands;
  }
}

function buildAdminRuntime(
  row: BotRuntimeRow | null,
  options: {
    guilds: AdminGuildRuntimeItem[];
    pterodactyl: PterodactylRuntime | null;
    installedGuilds: number;
    knownGuilds: number;
    knownCommands: number;
  }
): Record<string, unknown> | null {
  const normalized = normalizeBotRuntime(row);
  const pterodactyl = options.pterodactyl;

  if (normalized) {
    const details = (normalized.details && typeof normalized.details === "object" ? normalized.details : {}) as Record<string, unknown>;
    if (!Array.isArray(details.guilds) || details.guilds.length === 0) details.guilds = options.guilds;
    if (pterodactyl) {
      details.pterodactyl = pterodactyl;
      normalized.ramMb = normalized.ramMb ?? pterodactyl.ramMb;
      normalized.cpuPercent = normalized.cpuPercent ?? pterodactyl.cpuPercent;
      normalized.uptimeSeconds = normalized.uptimeSeconds ?? pterodactyl.uptimeSeconds;
      normalized.processUptimeSeconds = normalized.processUptimeSeconds ?? pterodactyl.uptimeSeconds;
    }
    normalized.details = details;
    normalized.guildCount = (finiteNumber(normalized.guildCount) ?? options.installedGuilds) || options.knownGuilds || options.guilds.length;
    normalized.commandCount = finiteNumber(normalized.commandCount) ?? options.knownCommands;
    return normalized;
  }

  if (!pterodactyl && !options.guilds.length && !options.knownCommands && !options.installedGuilds && !options.knownGuilds) {
    return null;
  }

  return {
    id: "fallback",
    status: pterodactyl ? (pterodactyl.suspended || pterodactyl.state !== "running" ? "offline" : "online") : null,
    activityType: null,
    activityText: null,
    latencyMs: null,
    ramMb: pterodactyl?.ramMb ?? null,
    cpuPercent: pterodactyl?.cpuPercent ?? null,
    guildCount: options.installedGuilds || options.knownGuilds || options.guilds.length,
    userCount: null,
    commandCount: options.knownCommands,
    shardCount: null,
    pythonVersion: null,
    discordPyVersion: null,
    platform: pterodactyl ? "Pterodactyl" : null,
    botVersion: null,
    uptimeSeconds: pterodactyl?.uptimeSeconds ?? null,
    processUptimeSeconds: pterodactyl?.uptimeSeconds ?? null,
    updatedAt: pterodactyl?.checkedAt ?? null,
    details: {
      heartbeat: false,
      source: pterodactyl ? "pterodactyl" : "database",
      guilds: options.guilds,
      pterodactyl
    }
  };
}

async function enqueueBotAdminEvent(env: Env, action: string, payload: unknown): Promise<string> {
  const guild = await first<GuildRow>(
    requireDb(env).prepare(
      `SELECT id, discord_guild_id, name, icon, bot_joined_at
         FROM guilds
        WHERE bot_joined_at IS NOT NULL
        ORDER BY last_seen_at DESC, updated_at DESC
        LIMIT 1`
    )
  );

  if (!guild) {
    throw new HttpError(409, "bot_not_connected", "Der Bot hat sich noch mit keiner Guild im Webpanel gemeldet.");
  }

  return enqueueSyncEvent(
    env,
    {
      id: guild.id,
      discordGuildId: guild.discord_guild_id,
      name: guild.name,
      icon: guild.icon,
      botJoinedAt: guild.bot_joined_at
    },
    action,
    payload
  );
}

async function audit(
  env: Env,
  guildId: string,
  actorDiscordUserId: string,
  action: string,
  target: string,
  oldValue: unknown,
  newValue: unknown
): Promise<void> {
  const db = requireDb(env);
  await db.prepare(
    `INSERT INTO audit_logs (id, guild_id, actor_discord_user_id, action, target, old_value, new_value, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(newId("aud"), guildId, actorDiscordUserId, action, target, asJson(oldValue), asJson(newValue), nowIso())
    .run();
}

async function enqueueSyncEvent(
  env: Env,
  guild: GuildAccess["guild"],
  action: string,
  payload: unknown
): Promise<string> {
  const db = requireDb(env);
  const eventId = newId("evt");
  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO sync_events (id, guild_id, action, payload, status, attempts, max_attempts, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, 5, ?, ?)`
  )
    .bind(eventId, guild.id, action, asJson(payload), timestamp, timestamp)
    .run();

  if (env.SYNC_QUEUE) {
    await env.SYNC_QUEUE.send({
      eventId,
      guildId: guild.discordGuildId,
      action,
      payload,
      createdAt: timestamp,
      attempt: 0
    });
  }

  return eventId;
}

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return json(c, { error: { code: error.code, message: error.message } }, error.status);
  }

  if (error instanceof DiscordApiError) {
    const status = error.status >= 400 && error.status < 600 ? error.status : 502;
    return json(c, { error: { code: "discord_api_error", message: error.message } }, status);
  }

  const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
  console.error(error);
  return json(c, { error: { code: "internal_error", message } }, 500);
});

app.get("/api/me", async (c) => {
  const session = await requireSession(c);
  return json(c, {
    user: {
      ...publicUser(session),
      ownerAdmin: canUseOwnerAdmin(session.user.discordUserId)
    },
    expiresAt: session.expiresAt
  });
});

app.get("/api/auth/discord", async (c) => {
  requireEnv(c.env, "DISCORD_CLIENT_ID");
  requireEnv(c.env, "DISCORD_CLIENT_SECRET");
  const state = randomToken(32);
  const returnTo = safeRedirectPath(c.req.query("returnTo"));
  const encryptedState = await encryptedCookieState(c.env, {
    kind: "login",
    state,
    returnTo,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  const response = c.redirect(discordOAuthAuthorizeUrl(c.env, state));
  response.headers.append("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, encryptedState, c.env, 600));
  return response;
});

app.get("/api/auth/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const inviteError = c.req.query("error");

  if (!state) {
    throw new HttpError(400, "oauth_state_invalid", "Discord-Login konnte nicht sicher validiert werden.");
  }

  const stateData = await readEncryptedCookieState(c, state);

  if (stateData.kind === "invite") {
    return completeInviteCallback(c, stateData, { code, inviteError });
  }

  if (!code) {
    throw new HttpError(400, "oauth_state_invalid", "Discord-Login konnte nicht sicher validiert werden.");
  }

  const tokenData = await exchangeDiscordCode(c.env, code);
  const user = await fetchDiscordUser(tokenData);
  const sessionId = randomToken(32);
  const ttl = sessionTtl(c.env);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const sessionUser: SessionUser = {
    id: user.id,
    discordUserId: user.id,
    username: user.username,
    displayName: user.global_name ?? null,
    avatar: discordAvatarUrl(user)
  };
  let sessionCookieValue = await encryptJson(
    {
      kind: "session",
      id: sessionId,
      user: sessionUser,
      tokenData,
      expiresAt
    } satisfies CookieSessionData,
    c.env.ENCRYPTION_KEY
  );
  const timestamp = nowIso();

  if (hasDb(c.env)) {
    const db = requireDb(c.env);
    const userId = await upsertUser(c.env, user);
    const encrypted = await encryptJson(tokenData, c.env.ENCRYPTION_KEY);
    await db.prepare(
      `INSERT INTO sessions (id, user_id, encrypted_token_data, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(sessionId, userId, encrypted, expiresAt, timestamp, timestamp)
      .run();
    sessionCookieValue = sessionId;
  }

  const response = c.redirect(stateData.returnTo || "/panel");
  response.headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE, sessionCookieValue, c.env, ttl));
  response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
  return response;
});

async function logoutResponse(c: HonoContext): Promise<Response> {
  const cookies = parseCookies(c.req.header("Cookie") ?? null);
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId && !sessionId.startsWith("v1.") && hasDb(c.env)) {
    await requireDb(c.env).prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  const response = c.redirect("/login");
  response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE, c.env));
  return response;
}

app.get("/logout", logoutResponse);
app.post("/api/logout", logoutResponse);

app.get("/api/guilds", async (c) => {
  const session = await requireSession(c);
  const discordGuilds = await getFreshGuilds(c, session);
  const manageable = discordGuilds.filter(canManageGuild);
  const items = [];

  for (const discordGuild of manageable) {
    const guild = await refreshBotPresence(c.env, await upsertGuildFromDiscord(c.env, discordGuild));
    items.push({
      id: discordGuild.id,
      name: discordGuild.name,
      icon: discordGuildIconUrl(discordGuild),
      owner: Boolean(discordGuild.owner),
      permission: permissionLabel(discordGuild),
      botInstalled: Boolean(guild.bot_joined_at),
      botInstallStatus: botInstallStatus(c.env, guild),
      botJoinedAt: guild.bot_joined_at
    });
  }

  return json(c, { guilds: items });
});

app.get("/api/bot/invite", async (c) => {
  const guildId = c.req.query("guildId");
  if (!guildId) throw new HttpError(400, "guild_required", "Es fehlt eine Guild-ID.");
  const access = await requireGuildManagementAccess(c, guildId, { requireBot: false });

  if (access.guild.botJoinedAt) {
    return c.redirect(`/dashboard/${guildId}/overview?bot=installed`);
  }

  const state = randomToken(32);
  const requestedReturnTo = c.req.query("returnTo");
  const returnTo = requestedReturnTo ? safeRedirectPath(requestedReturnTo) : `/dashboard/${guildId}/overview`;
  const encryptedState = await encryptedCookieState(c.env, {
    kind: "invite",
    state,
    guildId,
    returnTo,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  const response = c.redirect(discordBotInviteUrl(c.env, guildId, state));
  response.headers.append("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, encryptedState, c.env, 600));
  return response;
});

app.get("/api/bot/invite/callback", async (c) => {
  const inviteError = c.req.query("error");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!state) {
    throw new HttpError(400, "invite_state_invalid", "Die Bot-Einladung konnte nicht sicher validiert werden.");
  }

  const stateData = await readEncryptedCookieState(c, state, "invite");
  return completeInviteCallback(c, stateData, { code, inviteError });
});

app.get("/api/guilds/:guildId", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const settings = await ensureSettings(c.env, access.guild.id);
  return json(c, {
    guild: {
      id: access.guild.discordGuildId,
      name: access.guild.name,
      icon: access.guild.icon,
      botInstalled: Boolean(access.guild.botJoinedAt),
      botInstallStatus: access.guild.botJoinedAt ? "installed" : "missing",
      permission: permissionLabel(access.userGuild)
    },
    settings
  });
});

app.get("/api/guilds/:guildId/settings", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const settings = await ensureSettings(c.env, access.guild.id);
  return json(c, { settings });
});

app.patch("/api/guilds/:guildId/settings", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = settingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureSettings(c.env, access.guild.id);
  await c.env.DB.prepare("UPDATE guild_settings SET locale = ?, timezone = ?, updated_at = ? WHERE guild_id = ?")
    .bind(data.locale, data.timezone, nowIso(), access.guild.id)
    .run();
  await audit(c.env, access.guild.id, access.session.user.discordUserId, "settings.update", "guild_settings", oldValue, data);
  return json(c, { ok: true, settings: { ...oldValue, ...data } });
});

app.patch("/api/guilds/:guildId/profile", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = nicknameSchema.parse(await readJsonBody(c));
  const oldValue = await ensureSettings(c.env, access.guild.id);

  await c.env.DB.prepare("UPDATE guild_settings SET bot_nickname = ?, updated_at = ? WHERE guild_id = ?")
    .bind(data.nickname, nowIso(), access.guild.id)
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "guild.nickname.update", {
    discordGuildId: access.guild.discordGuildId,
    nickname: data.nickname
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "profile.nickname.update", "bot_nickname", oldValue.bot_nickname, data.nickname);
  return json(c, { ok: true, eventId, nickname: data.nickname });
});

app.post("/api/guilds/:guildId/profile/avatar", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const previousSettings = await ensureSettings(c.env, access.guild.id);
  const form = await c.req.formData();
  const file = form.get("avatar");

  if (!(file instanceof File)) {
    throw new HttpError(400, "avatar_missing", "Bitte lade eine Bilddatei hoch.");
  }

  const maxBytes = 512 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(400, "avatar_too_large", "Das Bild darf maximal 512 KiB groß sein.");
  }

  const bytes = await file.arrayBuffer();
  const mimeType = detectImageMimeType(bytes);

  if (!mimeType) {
    throw new HttpError(400, "avatar_type_invalid", "Die Datei enthält kein gültiges PNG-, JPEG-, GIF- oder WebP-Bild.");
  }

  const mediaId = newId("med");
  const mediaKey = `guilds/${access.guild.discordGuildId}/bot-avatar/${mediaId}.${imageExtension(mimeType)}`;

  await storeGuildMedia(c.env, {
    id: mediaId,
    guildId: access.guild.id,
    mediaKey,
    mimeType,
    createdByDiscordUserId: access.session.user.discordUserId
  }, bytes);

  await c.env.DB.prepare(
    `UPDATE guild_settings
        SET bot_avatar_media_key = ?, bot_avatar_sync_status = 'pending', bot_avatar_sync_error = NULL, updated_at = ?
      WHERE guild_id = ?`
  )
    .bind(mediaKey, nowIso(), access.guild.id)
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "guild.member_avatar.update", {
    discordGuildId: access.guild.discordGuildId,
    mediaKey,
    mimeType,
    previousMediaKey: previousSettings.bot_avatar_media_key
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "profile.avatar.update", "bot_avatar", previousSettings.bot_avatar_media_key, { mediaKey, mimeType, sizeBytes: file.size });
  return json(c, { ok: true, eventId, mediaKey, mimeType });
});

app.delete("/api/guilds/:guildId/profile/avatar", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const settings = await ensureSettings(c.env, access.guild.id);

  await c.env.DB.prepare(
    `UPDATE guild_settings
        SET bot_avatar_media_key = NULL, bot_avatar_sync_status = 'pending', bot_avatar_sync_error = NULL, updated_at = ?
      WHERE guild_id = ?`
  )
    .bind(nowIso(), access.guild.id)
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "guild.member_avatar.update", {
    discordGuildId: access.guild.discordGuildId,
    mediaKey: null,
    mimeType: null,
    previousMediaKey: settings.bot_avatar_media_key
  });

  await audit(
    c.env,
    access.guild.id,
    access.session.user.discordUserId,
    "profile.avatar.reset",
    "bot_avatar",
    settings.bot_avatar_media_key,
    null
  );
  return json(c, { ok: true, eventId });
});

app.get("/api/guilds/:guildId/channels", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const channels = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT discord_channel_id AS id, name, channel_type AS type, category_id AS categoryId,
              category_name AS categoryName, can_view AS canView, can_send AS canSend, position
         FROM guild_channels
        WHERE guild_id = ?
        ORDER BY position ASC, name ASC`
    ).bind(access.guild.id)
  );
  return json(c, { channels });
});

app.get("/api/guilds/:guildId/temp-voice", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const tempVoice = await ensureTempVoiceSettings(c.env, access.guild.id);
  return json(c, { tempVoice });
});

app.put("/api/guilds/:guildId/temp-voice", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = tempVoiceSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureTempVoiceSettings(c.env, access.guild.id);
  const creatorChannelIds = [...new Set(data.creatorChannelIds)];

  if (data.enabled && creatorChannelIds.length === 0) {
    throw new HttpError(400, "temp_voice_creator_required", "Wähle mindestens einen Creator-Sprachkanal aus.");
  }

  const selectedIds = [...new Set([
    ...creatorChannelIds,
    ...(data.categoryId ? [data.categoryId] : []),
    ...(data.interfaceChannelId ? [data.interfaceChannelId] : [])
  ])];
  const channelRows = selectedIds.length
    ? await all<{ id: string; type: string; canSend: number }>(
      c.env.DB.prepare(
        `SELECT discord_channel_id AS id, channel_type AS type, can_send AS canSend
           FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id IN (${selectedIds.map(() => "?").join(", ")})`
      ).bind(access.guild.id, ...selectedIds)
    )
    : [];
  const channelsById = new Map(channelRows.map((channel) => [channel.id, channel]));

  for (const channelId of creatorChannelIds) {
    const channel = channelsById.get(channelId);
    const type = String(channel?.type ?? "").toLowerCase();

    if (!channel || type !== "voice") {
      throw new HttpError(400, "temp_voice_creator_invalid", "Ein ausgewählter Creator-Kanal ist kein Sprachkanal.");
    }
  }

  if (data.categoryId) {
    const category = channelsById.get(data.categoryId);

    if (!category || String(category.type).toLowerCase() !== "category") {
      throw new HttpError(400, "temp_voice_category_invalid", "Die ausgewählte Kategorie wurde im Bot-Snapshot nicht gefunden.");
    }
  }

  if (data.interfaceChannelId) {
    const interfaceChannel = channelsById.get(data.interfaceChannelId);
    const type = String(interfaceChannel?.type ?? "").toLowerCase();

    if (!interfaceChannel || !new Set(["text", "news", "announcement"]).has(type)) {
      throw new HttpError(400, "temp_voice_interface_invalid", "Der Interface-Kanal muss ein Textkanal sein.");
    }

    if (!interfaceChannel.canSend) {
      throw new HttpError(400, "temp_voice_interface_forbidden", "Der Bot kann im ausgewählten Interface-Kanal nicht schreiben.");
    }
  }

  const timestamp = nowIso();
  await ensureTempVoiceStorage(c.env);
  await c.env.DB.prepare(
    `INSERT INTO temp_voice_settings (
       guild_id, enabled, creator_channel_ids, category_id, interface_channel_id,
       name_template, default_user_limit, default_bitrate_kbps, sync_status,
       sync_error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       creator_channel_ids = excluded.creator_channel_ids,
       category_id = excluded.category_id,
       interface_channel_id = excluded.interface_channel_id,
       name_template = excluded.name_template,
       default_user_limit = excluded.default_user_limit,
       default_bitrate_kbps = excluded.default_bitrate_kbps,
       sync_status = 'pending',
       sync_error = NULL,
       updated_at = excluded.updated_at`
  )
    .bind(
      access.guild.id,
      data.enabled ? 1 : 0,
      asJson(creatorChannelIds),
      data.categoryId,
      data.interfaceChannelId,
      data.nameTemplate,
      data.defaultUserLimit,
      data.defaultBitrateKbps,
      timestamp,
      timestamp
    )
    .run();

  const saved: TempVoiceSettingsResponse = {
    ...oldValue,
    ...data,
    creatorChannelIds,
    syncStatus: "pending",
    syncError: null
  };
  const eventId = await enqueueSyncEvent(c.env, access.guild, "temp_voice.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: data
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "temp_voice.update", "temp_voice_settings", oldValue, saved);
  return json(c, { ok: true, eventId, tempVoice: saved });
});

app.post("/api/guilds/:guildId/temp-voice/panel", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = tempVoicePanelSchema.parse(await readJsonBody(c));
  const settings = await ensureTempVoiceSettings(c.env, access.guild.id);
  const channelId = data.channelId || settings.interfaceChannelId;

  if (!channelId) {
    throw new HttpError(400, "temp_voice_interface_required", "Wähle zuerst einen Textkanal für das Interface aus.");
  }

  const channel = await first<{ type: string; canSend: number }>(
    c.env.DB.prepare(
      `SELECT channel_type AS type, can_send AS canSend
         FROM guild_channels
        WHERE guild_id = ? AND discord_channel_id = ?`
    ).bind(access.guild.id, channelId)
  );
  const type = String(channel?.type ?? "").toLowerCase();

  if (!channel || !new Set(["text", "news", "announcement"]).has(type)) {
    throw new HttpError(400, "temp_voice_interface_invalid", "Der Interface-Kanal ist kein Textkanal.");
  }

  if (!channel.canSend) {
    throw new HttpError(400, "temp_voice_interface_forbidden", "Der Bot kann im ausgewählten Interface-Kanal nicht schreiben.");
  }

  await c.env.DB.prepare(
    `UPDATE temp_voice_settings
        SET interface_channel_id = ?, sync_status = 'pending', sync_error = NULL, updated_at = ?
      WHERE guild_id = ?`
  )
    .bind(channelId, nowIso(), access.guild.id)
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "temp_voice.panel.send", {
    discordGuildId: access.guild.discordGuildId,
    channelId
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "temp_voice.panel.send", channelId, null, { eventId });
  return json(c, { ok: true, eventId });
});

app.get("/api/guilds/:guildId/counting", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const counting = await ensureCountingSettings(c.env, access.guild.id);
  return json(c, { counting });
});

app.put("/api/guilds/:guildId/counting", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = countingSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureCountingSettings(c.env, access.guild.id);

  if (data.enabled && !data.channelId) {
    throw new HttpError(400, "counting_channel_required", "Wähle einen Textkanal für das aktive Counting-Modul aus.");
  }

  if (data.channelId) {
    const channel = await first<{ type: string; canSend: number }>(
      c.env.DB.prepare(
        `SELECT channel_type AS type, can_send AS canSend
           FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id = ?`
      ).bind(access.guild.id, data.channelId)
    );
    const type = String(channel?.type ?? "").toLowerCase();

    if (!channel || !new Set(["text", "news", "announcement"]).has(type)) {
      throw new HttpError(400, "counting_channel_invalid", "Der Counting-Kanal muss ein Textkanal sein.");
    }

    if (!channel.canSend) {
      throw new HttpError(400, "counting_channel_forbidden", "Der Bot kann im ausgewählten Counting-Kanal nicht schreiben.");
    }
  }

  const timestamp = nowIso();
  await ensureCountingStorage(c.env);
  await c.env.DB.prepare(
    `INSERT INTO counting_settings (
       guild_id, enabled, channel_id, reset_on_error, delete_wrong_messages,
       milestone_interval, sync_status, sync_error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       channel_id = excluded.channel_id,
       reset_on_error = excluded.reset_on_error,
       delete_wrong_messages = excluded.delete_wrong_messages,
       milestone_interval = excluded.milestone_interval,
       sync_status = 'pending',
       sync_error = NULL,
       updated_at = excluded.updated_at`
  ).bind(
    access.guild.id,
    data.enabled ? 1 : 0,
    data.channelId,
    data.resetOnError ? 1 : 0,
    data.deleteWrongMessages ? 1 : 0,
    data.milestoneInterval,
    timestamp,
    timestamp
  ).run();

  const saved: CountingSettingsResponse = {
    ...oldValue,
    ...data,
    syncStatus: "pending",
    syncError: null
  };
  const eventId = await enqueueSyncEvent(c.env, access.guild, "counting.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: data
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "counting.update", "counting_settings", oldValue, saved);
  return json(c, { ok: true, eventId, counting: saved });
});

app.post("/api/guilds/:guildId/counting/reset", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = countingResetSchema.parse(await readJsonBody(c));
  const oldValue = await ensureCountingSettings(c.env, access.guild.id);
  const timestamp = nowIso();

  await c.env.DB.prepare(
    `UPDATE counting_settings
        SET current_number = ?, last_user_id = NULL,
            record_number = CASE WHEN ? = 1 THEN ? ELSE record_number END,
            sync_status = 'pending', sync_error = NULL, updated_at = ?
      WHERE guild_id = ?`
  ).bind(data.number, data.clearRecord ? 1 : 0, data.number, timestamp, access.guild.id).run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "counting.reset", {
    discordGuildId: access.guild.discordGuildId,
    number: data.number,
    clearRecord: data.clearRecord
  });
  const saved: CountingSettingsResponse = {
    ...oldValue,
    currentNumber: data.number,
    recordNumber: data.clearRecord ? data.number : oldValue.recordNumber,
    lastUserId: null,
    syncStatus: "pending",
    syncError: null
  };

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "counting.reset", "counting_settings", oldValue, saved);
  return json(c, { ok: true, eventId, counting: saved });
});

app.get("/api/guilds/:guildId/level-system", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const levelSystem = await ensureLevelSettings(c.env, access.guild.id);
  return json(c, { levelSystem });
});

app.put("/api/guilds/:guildId/level-system", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = levelSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureLevelSettings(c.env, access.guild.id);

  if (data.announcementChannelId) {
    const channel = await first<{ type: string; canSend: number }>(
      c.env.DB.prepare(
        `SELECT channel_type AS type, can_send AS canSend
           FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id = ?`
      ).bind(access.guild.id, data.announcementChannelId)
    );
    const type = String(channel?.type ?? "").toLowerCase();

    if (!channel || !new Set(["text", "news", "announcement"]).has(type)) {
      throw new HttpError(400, "level_channel_invalid", "Der Level-up-Kanal muss ein Textkanal sein.");
    }
    if (!channel.canSend) {
      throw new HttpError(400, "level_channel_forbidden", "Der Bot kann im ausgewählten Level-up-Kanal nicht schreiben.");
    }
  }

  if (data.roleRewards.length) {
    const roleRows = await all<{ id: string; managed: number; botCanManage: number }>(
      c.env.DB.prepare(
        `SELECT discord_role_id AS id, managed, bot_can_manage AS botCanManage
           FROM guild_roles
          WHERE guild_id = ?`
      ).bind(access.guild.id)
    );
    const availableRoles = new Map(roleRows.map((role) => [role.id, role]));

    for (const reward of data.roleRewards) {
      const role = availableRoles.get(reward.roleId);
      if (!role || role.managed || !role.botCanManage) {
        throw new HttpError(
          400,
          "level_role_unmanageable",
          `Die Rolle für Level ${reward.level} kann vom Bot nicht vergeben werden. Prüfe die Rollenhierarchie.`
        );
      }
    }
  }

  const roleRewards = [...data.roleRewards].sort((a, b) => a.level - b.level);
  const timestamp = nowIso();
  await ensureLevelStorage(c.env);
  await c.env.DB.prepare(
    `INSERT INTO level_settings (
       guild_id, enabled, announcement_channel_id, role_rewards,
       sync_status, sync_error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       announcement_channel_id = excluded.announcement_channel_id,
       role_rewards = excluded.role_rewards,
       sync_status = 'pending',
       sync_error = NULL,
       updated_at = excluded.updated_at`
  ).bind(
    access.guild.id,
    data.enabled ? 1 : 0,
    data.announcementChannelId,
    asJson(roleRewards),
    timestamp,
    timestamp
  ).run();

  const saved: LevelSettingsResponse = {
    enabled: data.enabled,
    announcementChannelId: data.announcementChannelId,
    roleRewards,
    syncStatus: "pending",
    syncError: null
  };
  const eventId = await enqueueSyncEvent(c.env, access.guild, "level.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: saved
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "level.update", "level_settings", oldValue, saved);
  return json(c, { ok: true, eventId, levelSystem: saved });
});

app.get("/api/guilds/:guildId/autorole", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const autorole = await ensureAutoroleSettings(c.env, access.guild.id);
  return json(c, { autorole });
});

app.put("/api/guilds/:guildId/autorole", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = autoroleSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureAutoroleSettings(c.env, access.guild.id);
  const selectedRoleIds = Array.from(new Set([...data.humanRoleIds, ...data.botRoleIds]));

  if (selectedRoleIds.length) {
    const roleRows = await all<{ id: string; name: string; managed: number; botCanManage: number }>(
      c.env.DB.prepare(
        `SELECT discord_role_id AS id, name, managed, bot_can_manage AS botCanManage
           FROM guild_roles
          WHERE guild_id = ?`
      ).bind(access.guild.id)
    );
    const availableRoles = new Map(roleRows.map((role) => [role.id, role]));

    for (const roleId of selectedRoleIds) {
      const role = availableRoles.get(roleId);
      if (!role || role.managed || !role.botCanManage) {
        throw new HttpError(
          400,
          "autorole_role_unmanageable",
          `Die Rolle ${role?.name ?? roleId} kann vom Bot nicht vergeben werden. Prüfe die Rollenhierarchie.`
        );
      }
    }
  }

  const timestamp = nowIso();
  await ensureAutoroleStorage(c.env);
  await c.env.DB.prepare(
    `INSERT INTO autorole_settings (
       guild_id, enabled, human_role_ids, bot_role_ids, delay_seconds,
       wait_for_screening, sync_status, sync_error, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       human_role_ids = excluded.human_role_ids,
       bot_role_ids = excluded.bot_role_ids,
       delay_seconds = excluded.delay_seconds,
       wait_for_screening = excluded.wait_for_screening,
       sync_status = 'pending',
       sync_error = NULL,
       updated_at = excluded.updated_at`
  ).bind(
    access.guild.id,
    data.enabled ? 1 : 0,
    asJson(data.humanRoleIds),
    asJson(data.botRoleIds),
    data.delaySeconds,
    data.waitForScreening ? 1 : 0,
    timestamp,
    timestamp
  ).run();

  const saved: AutoroleSettingsResponse = {
    ...data,
    syncStatus: "pending",
    syncError: null
  };
  const eventId = await enqueueSyncEvent(c.env, access.guild, "autorole.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: saved
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "autorole.update", "autorole_settings", oldValue, saved);
  return json(c, { ok: true, eventId, autorole: saved });
});

app.get("/api/guilds/:guildId/security", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  return json(c, { security: await ensureGuildControlModule(c.env, access.guild.id, "security") });
});

app.put("/api/guilds/:guildId/security", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = securitySettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureGuildControlModule(c.env, access.guild.id, "security");
  const selectedRoleIds = [data.quarantineRoleId, data.verificationRoleId].filter((value): value is string => Boolean(value));

  if (selectedRoleIds.length) {
    const roles = await all<{ id: string; managed: number; botCanManage: number }>(
      c.env.DB.prepare(
        `SELECT discord_role_id AS id, managed, bot_can_manage AS botCanManage
           FROM guild_roles WHERE guild_id = ?`
      ).bind(access.guild.id)
    );
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    for (const roleId of selectedRoleIds) {
      const role = roleMap.get(roleId);
      if (!role || role.managed || !role.botCanManage) {
        throw new HttpError(400, "security_role_unmanageable", "Eine ausgewählte Sicherheitsrolle kann vom Bot nicht vergeben werden. Prüfe die Rollenhierarchie.");
      }
    }
  }

  if (data.verificationChannelId) {
    const channel = await first<{ type: string; canSend: number }>(
      c.env.DB.prepare(
        `SELECT channel_type AS type, can_send AS canSend FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id = ?`
      ).bind(access.guild.id, data.verificationChannelId)
    );
    if (!channel || !new Set(["text", "news", "announcement"]).has(String(channel.type).toLowerCase()) || !channel.canSend) {
      throw new HttpError(400, "verification_channel_invalid", "Der Verifizierungskanal muss ein beschreibbarer Textkanal sein.");
    }
  }

  await setGuildControlPending(c.env, access.guild.id, "security", { ...data });
  const eventId = await enqueueSyncEvent(c.env, access.guild, "security.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: data
  });
  const saved = { ...oldValue, ...data, syncStatus: "pending", syncError: null };
  await audit(c.env, access.guild.id, access.session.user.discordUserId, "security.update", "security", oldValue, saved);
  return json(c, { ok: true, eventId, security: saved });
});

app.get("/api/guilds/:guildId/raidmode", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  return json(c, { raidmode: await ensureGuildControlModule(c.env, access.guild.id, "raidmode") });
});

app.put("/api/guilds/:guildId/raidmode", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = raidSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureGuildControlModule(c.env, access.guild.id, "raidmode");
  await setGuildControlPending(c.env, access.guild.id, "raidmode", { ...data });
  const eventId = await enqueueSyncEvent(c.env, access.guild, "raidmode.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: data
  });
  const saved = { ...oldValue, ...data, syncStatus: "pending", syncError: null };
  await audit(c.env, access.guild.id, access.session.user.discordUserId, "raidmode.update", "raidmode", oldValue, saved);
  return json(c, { ok: true, eventId, raidmode: saved });
});

app.get("/api/guilds/:guildId/tickets", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  return json(c, { tickets: await ensureGuildControlModule(c.env, access.guild.id, "tickets") });
});

app.put("/api/guilds/:guildId/tickets", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = ticketSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureGuildControlModule(c.env, access.guild.id, "tickets");
  const channelIds = [data.ticketCategoryId, data.panelChannelId, data.logChannelId].filter((value): value is string => Boolean(value));
  const channelRows = channelIds.length
    ? await all<{ id: string; type: string; canSend: number }>(
      c.env.DB.prepare(
        `SELECT discord_channel_id AS id, channel_type AS type, can_send AS canSend
           FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id IN (${channelIds.map(() => "?").join(", ")})`
      ).bind(access.guild.id, ...channelIds)
    )
    : [];
  const channelMap = new Map(channelRows.map((channel) => [channel.id, channel]));

  if (data.ticketCategoryId && String(channelMap.get(data.ticketCategoryId)?.type ?? "").toLowerCase() !== "category") {
    throw new HttpError(400, "ticket_category_invalid", "Die Ticket-Kategorie wurde nicht gefunden oder ist keine Discord-Kategorie.");
  }
  for (const channelId of [data.panelChannelId, data.logChannelId].filter((value): value is string => Boolean(value))) {
    const channel = channelMap.get(channelId);
    if (!channel || !new Set(["text", "news", "announcement"]).has(String(channel.type).toLowerCase()) || !channel.canSend) {
      throw new HttpError(400, "ticket_channel_invalid", "Panel- und Logkanal müssen beschreibbare Textkanäle sein.");
    }
  }

  const selectedRoleIds = Array.from(new Set([
    ...data.supportRoleIds,
    ...data.blacklistRoleIds,
    ...(data.notifyRoleId ? [data.notifyRoleId] : [])
  ]));
  if (selectedRoleIds.length) {
    const roles = await all<{ id: string; managed: number }>(
      c.env.DB.prepare(
        `SELECT discord_role_id AS id, managed FROM guild_roles
          WHERE guild_id = ?`
      ).bind(access.guild.id)
    );
    const roleMap = new Map(roles.map((role) => [role.id, role]));
    for (const roleId of selectedRoleIds) {
      if (!roleMap.has(roleId)) throw new HttpError(400, "ticket_role_invalid", `Die Ticket-Rolle ${roleId} wurde auf dieser Guild nicht gefunden.`);
    }
  }

  await setGuildControlPending(c.env, access.guild.id, "tickets", { ...data });
  const eventId = await enqueueSyncEvent(c.env, access.guild, "ticket.settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: data
  });
  const saved = { ...oldValue, ...data, syncStatus: "pending", syncError: null };
  await audit(c.env, access.guild.id, access.session.user.discordUserId, "ticket.update", "tickets", oldValue, saved);
  return json(c, { ok: true, eventId, tickets: saved });
});

app.post("/api/guilds/:guildId/tickets/panel", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = ticketPanelSchema.parse(await readJsonBody(c));
  const current = await ensureGuildControlModule(c.env, access.guild.id, "tickets");
  const channel = await first<{ type: string; canSend: number }>(
    c.env.DB.prepare(
      `SELECT channel_type AS type, can_send AS canSend FROM guild_channels
        WHERE guild_id = ? AND discord_channel_id = ?`
    ).bind(access.guild.id, data.channelId)
  );
  if (!channel || !new Set(["text", "news", "announcement"]).has(String(channel.type).toLowerCase()) || !channel.canSend) {
    throw new HttpError(400, "ticket_panel_channel_invalid", "Das Ticket-Panel braucht einen beschreibbaren Textkanal.");
  }
  const currentConfiguration = ticketSettingsSchema.parse(current);
  await setGuildControlPending(c.env, access.guild.id, "tickets", {
    ...currentConfiguration,
    panelChannelId: data.channelId
  });
  const eventId = await enqueueSyncEvent(c.env, access.guild, "ticket.panel.send", {
    discordGuildId: access.guild.discordGuildId,
    channelId: data.channelId
  });
  await audit(c.env, access.guild.id, access.session.user.discordUserId, "ticket.panel.send", data.channelId, null, { eventId });
  return json(c, { ok: true, eventId });
});

app.get("/api/guilds/:guildId/backups", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  return json(c, { backups: await ensureGuildControlModule(c.env, access.guild.id, "backups") });
});

app.post("/api/guilds/:guildId/backups/actions", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = backupActionSchema.parse(await readJsonBody(c));
  const current = await ensureGuildControlModule(c.env, access.guild.id, "backups");
  await setGuildControlPending(c.env, access.guild.id, "backups", {}, {
    items: Array.isArray(current.items) ? current.items : [],
    lastSavedAt: current.lastSavedAt ?? null,
    guildRoleCount: Number(current.guildRoleCount ?? 0),
    guildChannelCount: Number(current.guildChannelCount ?? 0),
    pendingAction: data.action,
    pendingScope: data.scope
  });
  const eventId = await enqueueSyncEvent(c.env, access.guild, "backup.action", {
    discordGuildId: access.guild.discordGuildId,
    action: data.action,
    scope: data.scope,
    confirmed: data.confirm
  });
  await audit(c.env, access.guild.id, access.session.user.discordUserId, `backup.${data.action}`, data.scope, null, { eventId });
  return json(c, { ok: true, eventId });
});

app.get("/api/guilds/:guildId/roles", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const roles = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT discord_role_id AS id, name, color, position, managed, bot_can_manage AS botCanManage
         FROM guild_roles
        WHERE guild_id = ?
        ORDER BY position DESC, name ASC`
    ).bind(access.guild.id)
  );
  return json(c, { roles });
});

app.get("/api/guilds/:guildId/media", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const key = c.req.query("key");

  if (!key || key.includes("..") || !key.startsWith(`guilds/${access.guild.discordGuildId}/`)) {
    throw new HttpError(400, "media_key_invalid", "Media-Key ist ungültig.");
  }

  const object = await loadGuildMedia(c.env, key, access.guild.id);
  if (!object) throw new HttpError(404, "media_not_found", "Medium nicht gefunden.");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.mimeType,
      "Content-Length": String(object.sizeBytes),
      "Cache-Control": "private, max-age=60"
    }
  });
});

app.get("/api/guilds/:guildId/welcome", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const welcome = await ensureWelcomeSettings(c.env, access.guild.id);
  return json(c, { welcome });
});

app.get("/api/guilds/:guildId/logging", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const logging = await ensureLoggingSettings(c.env, access.guild.id);
  return json(c, { logging });
});

app.put("/api/guilds/:guildId/logging", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = loggingSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureLoggingSettings(c.env, access.guild.id);
  const channelMappings = emptyLogChannelMappings();
  const events = defaultLogEvents(true);

  for (const category of logCategories) {
    channelMappings[category] = data.channelMappings[category] ?? null;
    events[category] = data.events[category] ?? true;
  }

  const selectedChannelIds = [...new Set(Object.values(channelMappings).filter((channelId): channelId is string => Boolean(channelId)))];

  if (data.enabled && selectedChannelIds.length === 0) {
    throw new HttpError(400, "logging_channel_required", "Bitte wähle mindestens einen Logkanal aus.");
  }

  if (selectedChannelIds.length > 0) {
    const placeholders = selectedChannelIds.map(() => "?").join(", ");
    const rows = await all<{ id: string; can_send: number }>(
      c.env.DB.prepare(
        `SELECT discord_channel_id AS id, can_send
           FROM guild_channels
          WHERE guild_id = ? AND discord_channel_id IN (${placeholders})`
      ).bind(access.guild.id, ...selectedChannelIds)
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    for (const channelId of selectedChannelIds) {
      const channel = byId.get(channelId);
      if (!channel) throw new HttpError(400, "logging_channel_invalid", "Ein ausgewählter Logkanal wurde im Bot-Snapshot nicht gefunden.");
      if (!channel.can_send) throw new HttpError(400, "logging_channel_forbidden", "Der Bot kann in mindestens einem ausgewählten Logkanal nicht schreiben.");
    }
  }

  const saved: LoggingSettingsResponse = {
    enabled: data.enabled,
    channelMappings,
    events
  };
  const enabledEvents = logCategories.filter((category) => saved.events[category]);
  const storedMappings = {
    __configured: true,
    __enabled: saved.enabled,
    ...saved.channelMappings
  };
  const timestamp = nowIso();

  await c.env.DB.prepare(
    `INSERT INTO logging_settings (guild_id, enabled_events, channel_mappings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled_events = excluded.enabled_events,
       channel_mappings = excluded.channel_mappings,
       updated_at = excluded.updated_at`
  )
    .bind(access.guild.id, asJson(enabledEvents), asJson(storedMappings), timestamp, timestamp)
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "logging_settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: saved
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "logging.update", "logging_settings", oldValue, saved);
  return json(c, { ok: true, eventId, logging: saved });
});

app.post("/api/guilds/:guildId/logging/test", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = loggingTestSchema.parse(await readJsonBody(c));
  const logging = await ensureLoggingSettings(c.env, access.guild.id);

  if (!logging.enabled) {
    throw new HttpError(400, "logging_disabled", "Logging ist auf dieser Guild noch deaktiviert.");
  }

  const eventId = await enqueueSyncEvent(c.env, access.guild, "logging_settings.test", {
    discordGuildId: access.guild.discordGuildId,
    category: data.category
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "logging.test", data.category, null, { eventId });
  return json(c, { ok: true, eventId });
});

app.put("/api/guilds/:guildId/welcome", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = welcomeSettingsSchema.parse(await readJsonBody(c));
  const oldValue = await ensureWelcomeSettings(c.env, access.guild.id);

  if (data.enabled && !data.channelId) {
    throw new HttpError(400, "welcome_channel_required", "Bitte wähle einen Zielkanal für die Begrüßung aus.");
  }

  if (data.channelId) {
    const channel = await first<{ can_send: number }>(
      c.env.DB.prepare("SELECT can_send FROM guild_channels WHERE guild_id = ? AND discord_channel_id = ?")
        .bind(access.guild.id, data.channelId)
    );
    if (!channel) throw new HttpError(400, "welcome_channel_invalid", "Dieser Kanal wurde im Bot-Snapshot nicht gefunden.");
    if (!channel.can_send) throw new HttpError(400, "welcome_channel_forbidden", "Der Bot kann in diesem Kanal nicht schreiben.");
  }

  if (data.autoRoleId) {
    const role = await first<{ bot_can_manage: number }>(
      c.env.DB.prepare("SELECT bot_can_manage FROM guild_roles WHERE guild_id = ? AND discord_role_id = ?")
        .bind(access.guild.id, data.autoRoleId)
    );
    if (!role) throw new HttpError(400, "welcome_role_invalid", "Diese Startrolle wurde im Bot-Snapshot nicht gefunden.");
    if (!role.bot_can_manage) throw new HttpError(400, "welcome_role_forbidden", "Der Bot kann diese Startrolle nicht vergeben.");
  }

  const roleRows = await all<{ id: string }>(
    c.env.DB.prepare("SELECT discord_role_id AS id FROM guild_roles WHERE guild_id = ?").bind(access.guild.id)
  );
  const validRoleIds = new Set(roleRows.map((role) => role.id));
  const allowedRoleIds = data.embed.allowedRoleIds.filter((roleId) => validRoleIds.has(roleId));
  const saved: WelcomeSettingsResponse = {
    ...data,
    embed: {
      ...data.embed,
      allowedRoleIds
    }
  };

  await assertGuildMedia(c.env, access.guild.id, saved.embed.imageMediaKey);
  const imageMedia = saved.embed.imageMediaKey
    ? await first<{ mime_type: string }>(
        c.env.DB.prepare("SELECT mime_type FROM guild_media WHERE guild_id = ? AND media_key = ?")
          .bind(access.guild.id, saved.embed.imageMediaKey)
      )
    : null;

  const timestamp = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO welcome_settings (guild_id, enabled, channel_id, message, embed_configuration, auto_role_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       channel_id = excluded.channel_id,
       message = excluded.message,
       embed_configuration = excluded.embed_configuration,
       auto_role_id = excluded.auto_role_id,
       updated_at = excluded.updated_at`
  )
    .bind(
      access.guild.id,
      saved.enabled ? 1 : 0,
      saved.channelId,
      saved.message,
      asJson(saved.embed),
      saved.autoRoleId,
      timestamp,
      timestamp
    )
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "welcome_settings.upsert", {
    discordGuildId: access.guild.discordGuildId,
    settings: saved,
    imageMimeType: imageMedia?.mime_type ?? null,
    previousImageMediaKey: oldValue.embed.imageMediaKey
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "welcome.update", "welcome_settings", oldValue, saved);
  return json(c, { ok: true, eventId, welcome: saved });
});

app.post("/api/guilds/:guildId/welcome/image", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const form = await c.req.formData();
  const file = form.get("image");

  if (!(file instanceof File)) {
    throw new HttpError(400, "welcome_image_missing", "Bitte lade eine Bilddatei hoch.");
  }

  const maxBytes = 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(400, "welcome_image_too_large", "Das Bild darf maximal 4 MiB groß sein.");
  }

  const bytes = await file.arrayBuffer();
  const mimeType = detectImageMimeType(bytes);

  if (!mimeType) {
    throw new HttpError(400, "welcome_image_type_invalid", "Die Datei enthält kein gültiges PNG-, JPEG-, GIF- oder WebP-Bild.");
  }

  const mediaId = newId("med");
  const mediaKey = `guilds/${access.guild.discordGuildId}/welcome/${mediaId}.${imageExtension(mimeType)}`;

  await storeGuildMedia(c.env, {
    id: mediaId,
    guildId: access.guild.id,
    mediaKey,
    mimeType,
    createdByDiscordUserId: access.session.user.discordUserId
  }, bytes);

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "welcome.image.upload", "guild_media", null, {
    mediaKey,
    mimeType,
    sizeBytes: file.size
  });

  return json(c, {
    ok: true,
    mediaKey,
    mediaUrl: mediaPreviewUrl(access.guild.discordGuildId, mediaKey),
    mimeType,
    sizeBytes: file.size
  });
});

app.get("/api/guilds/:guildId/commands", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const commands = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT b.command_name AS commandName, b.description, b.command_type AS commandType,
              COALESCE(cc.enabled, 1) AS enabled,
              COALESCE(cc.cooldown_seconds, 0) AS cooldownSeconds,
              COALESCE(cc.ephemeral, 1) AS ephemeral,
              COALESCE(cc.administrator_only, 0) AS administratorOnly,
              COALESCE(cc.moderator_only, 0) AS moderatorOnly,
              COALESCE(cc.allowed_channel_ids, '[]') AS allowedChannelIds,
              COALESCE(cc.denied_channel_ids, '[]') AS deniedChannelIds,
              COALESCE(cc.allowed_role_ids, '[]') AS allowedRoleIds,
              COALESCE(cc.denied_role_ids, '[]') AS deniedRoleIds
         FROM bot_commands b
         LEFT JOIN command_configurations cc
           ON cc.command_name = b.command_name AND cc.guild_id = ?
        ORDER BY b.command_name ASC`
    ).bind(access.guild.id)
  );

  return json(c, {
    commands: commands.map((command) => ({
      ...command,
      enabled: Boolean(command.enabled),
      ephemeral: Boolean(command.ephemeral),
      administratorOnly: Boolean(command.administratorOnly),
      moderatorOnly: Boolean(command.moderatorOnly),
      allowedChannelIds: parseJson(String(command.allowedChannelIds), []),
      deniedChannelIds: parseJson(String(command.deniedChannelIds), []),
      allowedRoleIds: parseJson(String(command.allowedRoleIds), []),
      deniedRoleIds: parseJson(String(command.deniedRoleIds), [])
    }))
  });
});

app.patch("/api/guilds/:guildId/commands/:commandName", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const commandName = decodeURIComponent(c.req.param("commandName")).trim().toLowerCase();
  if (!/^[a-z0-9 _-]{1,80}$/.test(commandName)) {
    throw new HttpError(400, "command_name_invalid", "Der Command-Name ist ungültig.");
  }

  const data = commandConfigSchema.parse(await readJsonBody(c));
  const oldValue = await first<Record<string, unknown>>(
    c.env.DB.prepare("SELECT * FROM command_configurations WHERE guild_id = ? AND command_name = ?")
      .bind(access.guild.id, commandName)
  );

  const timestamp = nowIso();
  await c.env.DB.prepare(
    `INSERT INTO command_configurations (
       id, guild_id, command_name, enabled, cooldown_seconds, ephemeral, administrator_only, moderator_only,
       allowed_channel_ids, denied_channel_ids, allowed_role_ids, denied_role_ids, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, command_name) DO UPDATE SET
       enabled = excluded.enabled,
       cooldown_seconds = excluded.cooldown_seconds,
       ephemeral = excluded.ephemeral,
       administrator_only = excluded.administrator_only,
       moderator_only = excluded.moderator_only,
       allowed_channel_ids = excluded.allowed_channel_ids,
       denied_channel_ids = excluded.denied_channel_ids,
       allowed_role_ids = excluded.allowed_role_ids,
       denied_role_ids = excluded.denied_role_ids,
       updated_at = excluded.updated_at`
  )
    .bind(
      newId("cmd"),
      access.guild.id,
      commandName,
      data.enabled ? 1 : 0,
      data.cooldownSeconds,
      data.ephemeral ? 1 : 0,
      data.administratorOnly ? 1 : 0,
      data.moderatorOnly ? 1 : 0,
      asJson(data.allowedChannelIds),
      asJson(data.deniedChannelIds),
      asJson(data.allowedRoleIds),
      asJson(data.deniedRoleIds),
      timestamp,
      timestamp
    )
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "command_configuration.upsert", {
    discordGuildId: access.guild.discordGuildId,
    commandName,
    configuration: data
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "commands.update", commandName, oldValue, data);
  return json(c, { ok: true, eventId, commandName, configuration: data });
});

app.get("/api/guilds/:guildId/custom-commands", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const rows = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT id, name, description, response_type AS responseType, response_content AS responseContent,
              enabled, ephemeral, cooldown_seconds AS cooldownSeconds,
              allowed_channel_ids AS allowedChannelIds, denied_channel_ids AS deniedChannelIds,
              allowed_role_ids AS allowedRoleIds, denied_role_ids AS deniedRoleIds,
              sync_status AS syncStatus, sync_error AS syncError, created_at AS createdAt, updated_at AS updatedAt
         FROM custom_commands
        WHERE guild_id = ?
        ORDER BY name ASC`
    ).bind(access.guild.id)
  );

  return json(c, {
    customCommands: rows.map((row) => ({
      ...row,
      enabled: Boolean(row.enabled),
      ephemeral: Boolean(row.ephemeral),
      allowedChannelIds: parseJson(String(row.allowedChannelIds), []),
      deniedChannelIds: parseJson(String(row.deniedChannelIds), []),
      allowedRoleIds: parseJson(String(row.allowedRoleIds), []),
      deniedRoleIds: parseJson(String(row.deniedRoleIds), [])
    }))
  });
});

app.post("/api/guilds/:guildId/custom-commands", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const data = customCommandSchema.parse(await readJsonBody(c));
  const id = newId("ccm");
  const timestamp = nowIso();

  try {
    await c.env.DB.prepare(
      `INSERT INTO custom_commands (
         id, guild_id, name, description, response_type, response_content, enabled, ephemeral, cooldown_seconds,
         allowed_channel_ids, denied_channel_ids, allowed_role_ids, denied_role_ids,
         sync_status, created_by_discord_user_id, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, 'message', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    )
      .bind(
        id,
        access.guild.id,
        data.name,
        data.description,
        data.responseContent,
        data.enabled ? 1 : 0,
        data.ephemeral ? 1 : 0,
        data.cooldownSeconds,
        asJson(data.allowedChannelIds),
        asJson(data.deniedChannelIds),
        asJson(data.allowedRoleIds),
        asJson(data.deniedRoleIds),
        access.session.user.discordUserId,
        timestamp,
        timestamp
      )
      .run();
  } catch (error) {
    throw new HttpError(409, "custom_command_exists", "Ein Custom Command mit diesem Namen existiert bereits.");
  }

  const eventId = await enqueueSyncEvent(c.env, access.guild, "custom_command.upsert", {
    discordGuildId: access.guild.discordGuildId,
    command: { id, ...data }
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "custom_commands.create", data.name, null, data);
  return json(c, { ok: true, eventId, customCommand: { id, ...data } }, 201);
});

app.patch("/api/guilds/:guildId/custom-commands/:commandId", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const commandId = c.req.param("commandId");
  const oldValue = await first<Record<string, unknown>>(
    c.env.DB.prepare("SELECT * FROM custom_commands WHERE id = ? AND guild_id = ?").bind(commandId, access.guild.id)
  );
  if (!oldValue) throw new HttpError(404, "custom_command_not_found", "Custom Command nicht gefunden.");
  assertSameGuild(access.guild.id, String(oldValue.guild_id));

  const data = partialCustomCommandSchema.parse(await readJsonBody(c));
  const next = {
    name: data.name ?? String(oldValue.name),
    description: data.description ?? String(oldValue.description),
    responseContent: data.responseContent ?? String(oldValue.response_content),
    enabled: data.enabled ?? Boolean(oldValue.enabled),
    ephemeral: data.ephemeral ?? Boolean(oldValue.ephemeral),
    cooldownSeconds: data.cooldownSeconds ?? Number(oldValue.cooldown_seconds ?? 0),
    allowedChannelIds: data.allowedChannelIds ?? parseJson<string[]>(String(oldValue.allowed_channel_ids), []),
    deniedChannelIds: data.deniedChannelIds ?? parseJson<string[]>(String(oldValue.denied_channel_ids), []),
    allowedRoleIds: data.allowedRoleIds ?? parseJson<string[]>(String(oldValue.allowed_role_ids), []),
    deniedRoleIds: data.deniedRoleIds ?? parseJson<string[]>(String(oldValue.denied_role_ids), [])
  };

  await c.env.DB.prepare(
    `UPDATE custom_commands
        SET name = ?, description = ?, response_content = ?, enabled = ?, ephemeral = ?, cooldown_seconds = ?,
            allowed_channel_ids = ?, denied_channel_ids = ?, allowed_role_ids = ?, denied_role_ids = ?,
            sync_status = 'pending', sync_error = NULL, updated_at = ?
      WHERE id = ? AND guild_id = ?`
  )
    .bind(
      next.name,
      next.description,
      next.responseContent,
      next.enabled ? 1 : 0,
      next.ephemeral ? 1 : 0,
      next.cooldownSeconds,
      asJson(next.allowedChannelIds),
      asJson(next.deniedChannelIds),
      asJson(next.allowedRoleIds),
      asJson(next.deniedRoleIds),
      nowIso(),
      commandId,
      access.guild.id
    )
    .run();

  const eventId = await enqueueSyncEvent(c.env, access.guild, "custom_command.upsert", {
    discordGuildId: access.guild.discordGuildId,
    command: { id: commandId, ...next }
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "custom_commands.update", next.name, oldValue, next);
  return json(c, { ok: true, eventId, customCommand: { id: commandId, ...next } });
});

app.delete("/api/guilds/:guildId/custom-commands/:commandId", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const commandId = c.req.param("commandId");
  const oldValue = await first<Record<string, unknown>>(
    c.env.DB.prepare("SELECT * FROM custom_commands WHERE id = ? AND guild_id = ?").bind(commandId, access.guild.id)
  );
  if (!oldValue) throw new HttpError(404, "custom_command_not_found", "Custom Command nicht gefunden.");
  assertSameGuild(access.guild.id, String(oldValue.guild_id));

  await c.env.DB.prepare("DELETE FROM custom_commands WHERE id = ? AND guild_id = ?").bind(commandId, access.guild.id).run();
  const eventId = await enqueueSyncEvent(c.env, access.guild, "custom_command.delete", {
    discordGuildId: access.guild.discordGuildId,
    commandId,
    name: oldValue.name
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "custom_commands.delete", String(oldValue.name), oldValue, null);
  return json(c, { ok: true, eventId });
});

app.get("/api/guilds/:guildId/audit-log", async (c) => {
  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const rows = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT id, actor_discord_user_id AS actorDiscordUserId, action, target, old_value AS oldValue,
              new_value AS newValue, created_at AS createdAt
         FROM audit_logs
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT 100`
    ).bind(access.guild.id)
  );
  return json(c, { auditLog: rows });
});

app.get("/api/admin/bot", async (c) => {
  await requireAdminSession(c);
  await ensureBotRuntimeTable(c.env);

  const runtime = await first<BotRuntimeRow>(
    c.env.DB.prepare("SELECT * FROM bot_runtime_status WHERE id = 'latest'")
  );
  const recentEvents = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT e.id, e.action, e.status, e.attempts, e.max_attempts AS maxAttempts,
              e.last_error AS lastError, e.created_at AS createdAt, e.completed_at AS completedAt,
              g.discord_guild_id AS guildId, g.name AS guildName
         FROM sync_events e
         LEFT JOIN guilds g ON g.id = e.guild_id
        ORDER BY e.created_at DESC
        LIMIT 20`
    )
  );
  const guildStats = await first<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT
         COUNT(*) AS knownGuilds,
         SUM(CASE WHEN bot_joined_at IS NOT NULL THEN 1 ELSE 0 END) AS installedGuilds
       FROM guilds`
    )
  );
  const commandStats = await first<Record<string, unknown>>(
    c.env.DB.prepare("SELECT COUNT(*) AS knownCommands FROM bot_commands")
  );
  const installedGuilds = Number(guildStats?.installedGuilds ?? 0);
  const knownGuilds = Number(guildStats?.knownGuilds ?? 0);
  const fallbackGuilds = await fallbackAdminGuilds(c.env);
  const knownCommands = await refreshCommandStatsFromDiscord(c.env, Number(commandStats?.knownCommands ?? 0));
  const pterodactyl = await fetchPterodactylRuntime(c.env);

  return json(c, {
    runtime: buildAdminRuntime(runtime, {
      guilds: fallbackGuilds,
      pterodactyl,
      installedGuilds,
      knownGuilds,
      knownCommands
    }),
    adminRestricted: adminUserIds(c.env).size > 0,
    stats: {
      knownGuilds,
      installedGuilds,
      knownCommands
    },
    recentEvents: recentEvents.map((event) => ({
      ...event,
      attempts: Number(event.attempts ?? 0),
      maxAttempts: Number(event.maxAttempts ?? 0)
    }))
  });
});

app.get("/api/admin/bot/logs", async (c) => {
  await requireAdminSession(c);
  await ensureBotRuntimeTable(c.env);

  const runtime = await first<BotRuntimeRow>(
    c.env.DB.prepare("SELECT payload FROM bot_runtime_status WHERE id = 'latest'")
  );
  const payload = parseJson<Record<string, unknown>>(runtime?.payload ?? "", {});
  const detailsLogs = Array.isArray(payload.logs) ? payload.logs : [];
  const syncEvents = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT e.id, e.action, e.status, e.last_error AS lastError, e.created_at AS createdAt,
              e.completed_at AS completedAt, g.discord_guild_id AS guildId, g.name AS guildName
         FROM sync_events e
         LEFT JOIN guilds g ON g.id = e.guild_id
        ORDER BY e.created_at DESC
        LIMIT 40`
    )
  );
  const auditRows = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT a.id, a.action, a.target, a.actor_discord_user_id AS actorDiscordUserId,
              a.created_at AS createdAt, g.discord_guild_id AS guildId, g.name AS guildName
         FROM audit_logs a
         LEFT JOIN guilds g ON g.id = a.guild_id
        ORDER BY a.created_at DESC
        LIMIT 40`
    )
  );

  return json(c, {
    logs: detailsLogs.slice(-80),
    syncEvents,
    auditLog: auditRows
  });
});

app.post("/api/admin/sync-events/:eventId/retry", async (c) => {
  const session = await requireAdminSession(c);
  const eventId = c.req.param("eventId");

  if (!/^evt_[a-f0-9]{32}$/.test(eventId)) {
    throw new HttpError(400, "event_id_invalid", "Die Sync-Event-ID ist ungültig.");
  }

  const event = await first<{
    id: string;
    guild_id: string;
    action: string;
    status: string;
    attempts: number;
    last_error: string | null;
  }>(
    c.env.DB.prepare(
      "SELECT id, guild_id, action, status, attempts, last_error FROM sync_events WHERE id = ?"
    ).bind(eventId)
  );

  if (!event) {
    throw new HttpError(404, "event_not_found", "Sync-Event nicht gefunden.");
  }

  if (event.status !== "failed") {
    throw new HttpError(409, "event_not_failed", "Nur fehlgeschlagene Sync-Events können erneut gestartet werden.");
  }

  await c.env.DB.prepare(
    `UPDATE sync_events
        SET status = 'pending', attempts = 0, last_error = NULL, completed_at = NULL, updated_at = ?
      WHERE id = ?`
  )
    .bind(nowIso(), eventId)
    .run();

  await audit(
    c.env,
    event.guild_id,
    session.user.discordUserId,
    "owner.sync_event.retry",
    event.action,
    { status: event.status, attempts: event.attempts, error: event.last_error },
    { status: "pending", attempts: 0 }
  );

  return json(c, { ok: true, eventId, status: "pending" });
});

app.post("/api/admin/bot/actions", async (c) => {
  const session = await requireAdminSession(c);
  const data = botAdminActionSchema.parse(await readJsonBody(c));
  const eventId = await enqueueBotAdminEvent(c.env, `bot.admin.${data.action}`, {
    requestedAction: data.action,
    actorDiscordUserId: session.user.discordUserId,
    actorUsername: session.user.displayName || session.user.username
  });

  return json(c, { ok: true, eventId, action: data.action });
});

app.post("/api/admin/bot/music-source", async (c) => {
  const session = await requireAdminSession(c);
  const data = musicSourceSchema.parse(await readJsonBody(c));
  const eventId = await enqueueBotAdminEvent(c.env, "bot.admin.music.source.update", {
    source: data.source,
    actorDiscordUserId: session.user.discordUserId,
    actorUsername: session.user.displayName || session.user.username
  });

  return json(c, { ok: true, eventId, source: data.source });
});

app.post("/api/admin/pterodactyl/power", async (c) => {
  await requireAdminSession(c);
  const data = pterodactylPowerSchema.parse(await readJsonBody(c));
  await sendPterodactylPowerSignal(c.env, data.signal);
  return json(c, { ok: true, signal: data.signal });
});

app.get("/api/admin/bot/export", async (c) => {
  await requireAdminSession(c);
  await ensureBotRuntimeTable(c.env);

  const [guilds, commands, runtime, events] = await Promise.all([
    all<Record<string, unknown>>(c.env.DB.prepare("SELECT discord_guild_id, name, icon, bot_joined_at, last_seen_at FROM guilds ORDER BY LOWER(name) ASC")),
    all<Record<string, unknown>>(c.env.DB.prepare("SELECT command_name, description, command_type, updated_at FROM bot_commands ORDER BY command_name ASC")),
    first<BotRuntimeRow>(c.env.DB.prepare("SELECT * FROM bot_runtime_status WHERE id = 'latest'")),
    all<Record<string, unknown>>(
      c.env.DB.prepare(
        `SELECT action, status, attempts, max_attempts AS maxAttempts, last_error AS lastError, created_at AS createdAt, completed_at AS completedAt
           FROM sync_events
          ORDER BY created_at DESC
          LIMIT 100`
      )
    )
  ]);

  return json(c, {
    exportedAt: nowIso(),
    app: "discordbot-webpanel",
    guilds,
    commands,
    runtime: normalizeBotRuntime(runtime),
    recentEvents: events
  });
});

app.get("/api/admin/discordguilds/:guildId", async (c) => {
  await requireAdminSession(c);
  await ensureBotRuntimeTable(c.env);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const settings = await ensureSettings(c.env, guild.id);
  const runtime = await first<BotRuntimeRow>(
    c.env.DB.prepare("SELECT * FROM bot_runtime_status WHERE id = 'latest'")
  );
  const runtimeGuild = runtimeGuildFromRow(runtime, guildId);
  const warnings: string[] = [];

  const dbRoles = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT discord_role_id AS id, name, color, position, managed, bot_can_manage AS botCanManage
         FROM guild_roles
        WHERE guild_id = ?
        ORDER BY position DESC, name ASC`
    ).bind(guild.id)
  );
  const dbChannels = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT discord_channel_id AS id, name, channel_type AS type, category_id AS categoryId,
              category_name AS categoryName, can_view AS canView, can_send AS canSend, position
         FROM guild_channels
        WHERE guild_id = ?
        ORDER BY position ASC, name ASC`
    ).bind(guild.id)
  );

  let liveGuild: Awaited<ReturnType<typeof fetchDiscordBotGuild>> = null;
  let liveRoles: Record<string, unknown>[] = [];
  let liveChannels: Record<string, unknown>[] = [];
  let liveMembers: Record<string, unknown>[] = [];
  let botMember: Record<string, unknown> | null = null;

  try {
    liveGuild = await fetchDiscordBotGuild(c.env, guildId);
  } catch (error) {
    warnings.push(`Discord-Guild konnte nicht live geladen werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  }

  try {
    liveRoles = (await fetchDiscordBotGuildRoles(c.env, guildId)) as unknown as Record<string, unknown>[];
  } catch (error) {
    warnings.push(`Live-Rollen konnten nicht geladen werden, Snapshot wird genutzt: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  }

  try {
    liveChannels = (await fetchDiscordBotGuildChannels(c.env, guildId)) as unknown as Record<string, unknown>[];
  } catch (error) {
    warnings.push(`Live-Kanäle konnten nicht geladen werden, Snapshot wird genutzt: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  }

  try {
    liveMembers = (await fetchDiscordBotGuildMembers(c.env, guildId, 250)) as unknown as Record<string, unknown>[];
  } catch (error) {
    warnings.push(`Mitglieder konnten nicht geladen werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}`);
  }

  if (c.env.DISCORD_CLIENT_ID?.trim()) {
    try {
      botMember = await fetchDiscordBotGuildMember(c.env, guildId, c.env.DISCORD_CLIENT_ID.trim()) as unknown as Record<string, unknown> | null;
    } catch {
      botMember = null;
    }
  }

  const roles = (liveRoles.length ? liveRoles : dbRoles).map(normalizeAdminRole).filter((role) => role.id);
  const channels = (liveChannels.length ? liveChannels : dbChannels).map(normalizeAdminChannel).filter((channel) => channel.id);
  const members = liveMembers.map(normalizeAdminMember).filter((member) => member.id);
  const moduleSettings = normalizeGuildModules(runtimeGuild?.modules);
  const permissionChecks = buildPermissionChecks(guildId, liveRoles.length ? liveRoles : dbRoles, botMember);
  const memberCount = finiteNumber(liveGuild?.member_count)
    ?? finiteNumber(liveGuild?.approximate_member_count)
    ?? finiteNumber(runtimeGuild?.memberCount)
    ?? members.length
    ?? null;

  return json(c, {
    guild: {
      id: guild.discord_guild_id,
      name: liveGuild?.name ?? guild.name,
      icon: liveGuild?.icon ? discordGuildIconUrl({ id: guild.discord_guild_id, icon: liveGuild.icon }) : guild.icon,
      ownerId: liveGuild?.owner_id ?? runtimeGuild?.ownerId ?? null,
      ownerName: runtimeGuild?.ownerName ?? null,
      memberCount,
      presenceCount: finiteNumber(liveGuild?.approximate_presence_count),
      channelCount: channels.length,
      roleCount: roles.length,
      shardId: finiteNumber(runtimeGuild?.shardId),
      createdAt: runtimeGuild?.createdAt ?? null,
      joinedAt: runtimeGuild?.joinedAt ?? guild.bot_joined_at,
      features: Array.isArray(liveGuild?.features) ? liveGuild.features : []
    },
    settings: {
      botNickname: settings.bot_nickname,
      effectiveBotNickname: botMember?.nick ? String(botMember.nick) : settings.bot_nickname
    },
    roles,
    channels,
    members,
    modules: moduleSettings,
    permissionChecks,
    limits: {
      membersShown: members.length,
      membersPartial: memberCount !== null ? members.length < memberCount : false
    },
    warnings
  });
});

app.get("/api/admin/discordguilds/:guildId/invites", async (c) => {
  await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  await requireAdminGuild(c.env, guildId);

  const invites = await fetchDiscordBotGuildInvites(c.env, guildId);
  return json(c, { invites: invites.map((invite) => normalizeAdminInvite(invite as unknown as Record<string, unknown>)) });
});

app.post("/api/admin/discordguilds/:guildId/invites", async (c) => {
  const session = await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const data = inviteCreateSchema.parse(await readJsonBody(c));
  const knownChannel = await first<Record<string, unknown>>(
    c.env.DB.prepare("SELECT discord_channel_id FROM guild_channels WHERE guild_id = ? AND discord_channel_id = ?")
      .bind(guild.id, data.channelId)
  );

  if (!knownChannel) {
    const liveChannels = await fetchDiscordBotGuildChannels(c.env, guildId);
    if (!liveChannels.some((channel) => channel.id === data.channelId)) {
      throw new HttpError(400, "channel_not_in_guild", "Dieser Kanal gehört nicht zu dieser Guild oder ist für den Bot nicht sichtbar.");
    }
  }

  const invite = await createDiscordChannelInvite(c.env, data.channelId, {
    maxAge: data.maxAge,
    maxUses: data.maxUses,
    temporary: data.temporary
  });

  await audit(c.env, guild.id, session.user.discordUserId, "owner.guild.invite.create", "discord_invite", null, {
    channelId: data.channelId,
    code: invite.code,
    maxAge: data.maxAge,
    maxUses: data.maxUses,
    temporary: data.temporary
  });

  return json(c, { ok: true, invite: normalizeAdminInvite(invite as unknown as Record<string, unknown>) });
});

app.delete("/api/admin/discordguilds/:guildId/invites/:code", async (c) => {
  const session = await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const code = inviteCodeFromInput(decodeURIComponent(c.req.param("code") ?? ""));

  if (!/^[A-Za-z0-9_-]{2,120}$/.test(code)) {
    throw new HttpError(400, "invite_code_invalid", "Der Invite-Code ist ungültig.");
  }

  const invites = await fetchDiscordBotGuildInvites(c.env, guildId);
  const invite = invites.find((item) => item.code === code);

  if (!invite) {
    throw new HttpError(404, "invite_not_found", "Dieser Invite wurde auf der Guild nicht gefunden.");
  }

  await deleteDiscordInvite(c.env, code);
  await audit(c.env, guild.id, session.user.discordUserId, "owner.guild.invite.delete", "discord_invite", normalizeAdminInvite(invite as unknown as Record<string, unknown>), null);
  return json(c, { ok: true, code });
});

app.patch("/api/admin/discordguilds/:guildId/bot-nickname", async (c) => {
  const session = await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const data = nicknameSchema.parse(await readJsonBody(c));
  const oldValue = await ensureSettings(c.env, guild.id);

  await updateDiscordBotGuildNickname(c.env, guildId, data.nickname);
  await c.env.DB.prepare("UPDATE guild_settings SET bot_nickname = ?, updated_at = ? WHERE guild_id = ?")
    .bind(data.nickname, nowIso(), guild.id)
    .run();

  await audit(c.env, guild.id, session.user.discordUserId, "owner.guild.nickname.update", "bot_nickname", oldValue.bot_nickname, data.nickname);
  return json(c, { ok: true, nickname: data.nickname });
});

app.put("/api/admin/discordguilds/:guildId/modules", async (c) => {
  const session = await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const data = guildModuleSettingsSchema.parse(await readJsonBody(c));
  const modules = normalizeGuildModules(data.modules);
  const eventId = await enqueueSyncEvent(c.env, {
    id: guild.id,
    discordGuildId: guild.discord_guild_id,
    name: guild.name,
    icon: guild.icon,
    botJoinedAt: guild.bot_joined_at
  }, "guild.modules.update", {
    discordGuildId: guild.discord_guild_id,
    modules,
    actorDiscordUserId: session.user.discordUserId,
    actorUsername: session.user.displayName || session.user.username
  });

  await audit(c.env, guild.id, session.user.discordUserId, "owner.guild.modules.update", "guild_modules", null, modules);
  return json(c, { ok: true, eventId, modules });
});

app.patch("/api/admin/discordguilds/:guildId/roles/:roleId", async (c) => {
  const session = await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const roleId = snowflakeSchema.parse(c.req.param("roleId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const data = adminRoleUpdateSchema.parse(await readJsonBody(c));
  const roles = await fetchDiscordBotGuildRoles(c.env, guildId) as unknown as Record<string, unknown>[];
  const role = roles.find((item) => String(item.id) === roleId);

  if (!role) throw new HttpError(404, "role_not_found", "Diese Rolle wurde auf der Guild nicht gefunden.");
  if (roleId === guildId) throw new HttpError(400, "role_everyone_forbidden", "Die @everyone-Rolle kann nicht bearbeitet werden.");
  if (Boolean(role.managed)) throw new HttpError(400, "role_managed_forbidden", "Verwaltete Discord-/Bot-Rollen können nicht bearbeitet werden.");

  const updated = await updateDiscordGuildRole(c.env, guildId, roleId, {
    name: data.name,
    color: discordRoleColorInt(data.color),
    hoist: data.hoist,
    mentionable: data.mentionable
  });

  await audit(c.env, guild.id, session.user.discordUserId, "owner.guild.role.update", roleId, normalizeAdminRole(role), normalizeAdminRole(updated as unknown as Record<string, unknown>));
  return json(c, { ok: true, role: normalizeAdminRole(updated as unknown as Record<string, unknown>) });
});

app.get("/api/admin/discordguilds/:guildId/export", async (c) => {
  await requireAdminSession(c);
  const guildId = snowflakeSchema.parse(c.req.param("guildId"));
  const guild = await requireAdminGuild(c.env, guildId);
  const [settings, welcome, logging, channels, roles, auditRows] = await Promise.all([
    ensureSettings(c.env, guild.id),
    ensureWelcomeSettings(c.env, guild.id),
    ensureLoggingSettings(c.env, guild.id),
    all<Record<string, unknown>>(c.env.DB.prepare("SELECT discord_channel_id, name, channel_type, category_id, category_name, can_view, can_send, position FROM guild_channels WHERE guild_id = ? ORDER BY position ASC").bind(guild.id)),
    all<Record<string, unknown>>(c.env.DB.prepare("SELECT discord_role_id, name, color, position, managed, bot_can_manage FROM guild_roles WHERE guild_id = ? ORDER BY position DESC").bind(guild.id)),
    all<Record<string, unknown>>(c.env.DB.prepare("SELECT action, target, created_at AS createdAt FROM audit_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT 50").bind(guild.id))
  ]);

  return json(c, {
    exportedAt: nowIso(),
    guild: {
      id: guild.discord_guild_id,
      name: guild.name,
      icon: guild.icon,
      botJoinedAt: guild.bot_joined_at
    },
    settings,
    welcome,
    logging,
    channels,
    roles,
    recentAudit: auditRows
  });
});

app.post("/api/admin/bot/presence", async (c) => {
  const session = await requireAdminSession(c);
  const data = presenceSchema.parse(await readJsonBody(c));

  if (data.activityType !== "none" && !data.text) {
    throw new HttpError(400, "presence_text_required", "Bitte gib einen Text für die Aktivität ein.");
  }

  const eventId = await enqueueBotAdminEvent(c.env, "bot.presence.update", {
    ...data,
    actorDiscordUserId: session.user.discordUserId,
    actorUsername: session.user.displayName || session.user.username
  });

  return json(c, { ok: true, eventId, presence: data });
});

app.post("/api/internal/bot/runtime", async (c) => {
  const body = (await signedInternalBody(c)) as Record<string, unknown>;
  await ensureBotRuntimeTable(c.env);

  const presence = (body.presence && typeof body.presence === "object" ? body.presence : {}) as Record<string, unknown>;
  const system = (body.system && typeof body.system === "object" ? body.system : {}) as Record<string, unknown>;
  const counts = (body.counts && typeof body.counts === "object" ? body.counts : {}) as Record<string, unknown>;
  const versions = (body.versions && typeof body.versions === "object" ? body.versions : {}) as Record<string, unknown>;
  const timestamp = nowIso();
  const num = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  await c.env.DB.prepare(
    `INSERT INTO bot_runtime_status (
       id, status, activity_type, activity_text, latency_ms, ram_mb, cpu_percent,
       guild_count, user_count, command_count, shard_count,
       python_version, discord_py_version, platform, bot_version,
       uptime_seconds, process_uptime_seconds, payload, updated_at
     )
     VALUES ('latest', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       status = excluded.status,
       activity_type = excluded.activity_type,
       activity_text = excluded.activity_text,
       latency_ms = excluded.latency_ms,
       ram_mb = excluded.ram_mb,
       cpu_percent = excluded.cpu_percent,
       guild_count = excluded.guild_count,
       user_count = excluded.user_count,
       command_count = excluded.command_count,
       shard_count = excluded.shard_count,
       python_version = excluded.python_version,
       discord_py_version = excluded.discord_py_version,
       platform = excluded.platform,
       bot_version = excluded.bot_version,
       uptime_seconds = excluded.uptime_seconds,
       process_uptime_seconds = excluded.process_uptime_seconds,
       payload = excluded.payload,
       updated_at = excluded.updated_at`
  )
    .bind(
      String(presence.status ?? ""),
      String(presence.activityType ?? ""),
      String(presence.activityText ?? ""),
      num(system.latencyMs),
      num(system.ramMb),
      num(system.cpuPercent),
      num(counts.guilds),
      num(counts.users),
      num(counts.commands),
      num(counts.shards),
      String(versions.python ?? ""),
      String(versions.discordPy ?? ""),
      String(system.platform ?? ""),
      String(versions.bot ?? ""),
      num(system.uptimeSeconds),
      num(system.processUptimeSeconds),
      asJson(body),
      timestamp
    )
    .run();

  return json(c, { ok: true, updatedAt: timestamp });
});

app.post("/api/internal/bot/snapshot", async (c) => {
  const payload = (await signedInternalBody(c)) as {
    guilds?: Array<{
      id: string;
      name: string;
      icon?: string | null;
      channels?: Array<Record<string, unknown>>;
      roles?: Array<Record<string, unknown>>;
      counting?: Record<string, unknown>;
      levelSystem?: Record<string, unknown>;
      autorole?: Record<string, unknown>;
      security?: Record<string, unknown>;
      raidmode?: Record<string, unknown>;
      tickets?: Record<string, unknown>;
      backups?: Record<string, unknown>;
    }>;
    commands?: Array<{ name: string; description?: string; type?: string }>;
  };
  const db = requireDb(c.env);
  const timestamp = nowIso();
  const commands = (payload.commands ?? []).filter(
    (command) => Boolean(command.name && /^[a-z0-9 _-]{1,80}$/.test(command.name))
  );
  const guilds = Array.from(
    new Map(
      (payload.guilds ?? [])
        .filter((guild) => /^\d{17,20}$/.test(String(guild.id ?? "")))
        .map((guild) => [guild.id, guild] as const)
    ).values()
  );

  const knownGuilds = guilds.length
    ? await all<{ id: string; discord_guild_id: string }>(
      db.prepare(
        `SELECT id, discord_guild_id
           FROM guilds
          WHERE discord_guild_id IN (${guilds.map(() => "?").join(", ")})`
      ).bind(...guilds.map((guild) => guild.id))
    )
    : [];
  const internalGuildIds = new Map(
    knownGuilds.map((guild) => [guild.discord_guild_id, guild.id])
  );

  for (const guild of guilds) {
    if (!internalGuildIds.has(guild.id)) {
      internalGuildIds.set(guild.id, newId("gld"));
    }
  }

  const commandRows = commands.map((command) => ({
    id: newId("bc"),
    name: command.name,
    description: command.description ?? "",
    type: command.type ?? "slash",
    updatedAt: timestamp
  }));
  const guildRows = guilds.map((guild) => ({
    id: internalGuildIds.get(guild.id)!,
    discordGuildId: guild.id,
    name: String(guild.name ?? "Unbekannte Guild"),
    icon: guild.icon ?? null,
    timestamp
  }));
  const internalGuildIdList = guildRows.map((guild) => guild.id);
  const channelRows: Array<Record<string, unknown>> = [];
  const roleRows: Array<Record<string, unknown>> = [];
  const countingRows: Array<Record<string, unknown>> = [];
  const levelRows: Array<Record<string, unknown>> = [];
  const autoroleRows: Array<Record<string, unknown>> = [];
  const controlRows: Array<Record<string, unknown>> = [];

  for (const guild of guilds) {
    const internalGuildId = internalGuildIds.get(guild.id)!;

    for (const channel of guild.channels ?? []) {
      const channelId = String(channel.id ?? "");
      if (!/^\d{17,20}$/.test(channelId)) continue;
      channelRows.push({
        id: newId("chn"),
        guildId: internalGuildId,
        discordChannelId: channelId,
        name: String(channel.name ?? "Unbenannt"),
        type: String(channel.type ?? "unknown"),
        categoryId: channel.categoryId ? String(channel.categoryId) : null,
        categoryName: channel.categoryName ? String(channel.categoryName) : null,
        canView: channel.canView ? 1 : 0,
        canSend: channel.canSend ? 1 : 0,
        position: Number(channel.position ?? 0),
        updatedAt: timestamp
      });
    }

    for (const role of guild.roles ?? []) {
      const roleId = String(role.id ?? "");
      if (!/^\d{17,20}$/.test(roleId)) continue;
      roleRows.push({
        id: newId("rol"),
        guildId: internalGuildId,
        discordRoleId: roleId,
        name: String(role.name ?? "Unbenannt"),
        color: Number(role.color ?? 0),
        position: Number(role.position ?? 0),
        managed: role.managed ? 1 : 0,
        botCanManage: role.botCanManage ? 1 : 0,
        updatedAt: timestamp
      });
    }

    const counting = guild.counting && typeof guild.counting === "object" ? guild.counting : {};
    const safeInteger = (value: unknown, fallback = 0) => {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
    };
    countingRows.push({
      guildId: internalGuildId,
      enabled: counting.enabled ? 1 : 0,
      channelId: /^\d{17,20}$/.test(String(counting.channelId ?? "")) ? String(counting.channelId) : null,
      resetOnError: counting.resetOnError === false ? 0 : 1,
      deleteWrongMessages: counting.deleteWrongMessages ? 1 : 0,
      milestoneInterval: Math.min(100000, safeInteger(counting.milestoneInterval, 100)),
      currentNumber: safeInteger(counting.currentNumber),
      recordNumber: safeInteger(counting.recordNumber),
      totalCounts: safeInteger(counting.totalCounts),
      totalFailures: safeInteger(counting.totalFailures),
      lastUserId: /^\d{17,20}$/.test(String(counting.lastUserId ?? "")) ? String(counting.lastUserId) : null,
      timestamp
    });

    const levelSystem = guild.levelSystem && typeof guild.levelSystem === "object" ? guild.levelSystem : {};
    const rawRewards = Array.isArray(levelSystem.roleRewards) ? levelSystem.roleRewards : [];
    const usedLevels = new Set<number>();
    const usedRoles = new Set<string>();
    const roleRewards: LevelRoleReward[] = [];

    for (const rawReward of rawRewards) {
      if (!rawReward || typeof rawReward !== "object") continue;
      const reward = rawReward as Record<string, unknown>;
      const level = Number(reward.level);
      const roleId = String(reward.roleId ?? reward.role_id ?? "");
      if (!Number.isInteger(level) || level < 1 || level > 1000 || !/^\d{17,20}$/.test(roleId)) continue;
      if (usedLevels.has(level) || usedRoles.has(roleId)) continue;
      usedLevels.add(level);
      usedRoles.add(roleId);
      roleRewards.push({ level, roleId });
    }

    levelRows.push({
      guildId: internalGuildId,
      enabled: levelSystem.enabled === false ? 0 : 1,
      announcementChannelId: /^\d{17,20}$/.test(String(levelSystem.announcementChannelId ?? ""))
        ? String(levelSystem.announcementChannelId)
        : null,
      roleRewards: roleRewards.sort((a, b) => a.level - b.level),
      timestamp
    });

    const autorole = guild.autorole && typeof guild.autorole === "object" ? guild.autorole : {};
    autoroleRows.push({
      guildId: internalGuildId,
      enabled: autorole.enabled ? 1 : 0,
      humanRoleIds: normalizeRoleIds(autorole.humanRoleIds),
      botRoleIds: normalizeRoleIds(autorole.botRoleIds),
      delaySeconds: Math.min(3600, safeInteger(autorole.delaySeconds)),
      waitForScreening: autorole.waitForScreening === false ? 0 : 1,
      timestamp
    });

    for (const module of ["security", "raidmode", "tickets", "backups"] as GuildControlModule[]) {
      const section = recordValue(guild[module]);
      controlRows.push({
        guildId: internalGuildId,
        module,
        configuration: recordValue(section.configuration),
        runtimeState: recordValue(section.runtime),
        timestamp
      });
    }
  }

  await ensureCountingStorage(c.env);
  await ensureLevelStorage(c.env);
  await ensureAutoroleStorage(c.env);
  await ensureGuildControlStorage(c.env);
  await db.batch([
    db.prepare(
      `INSERT INTO bot_commands (id, command_name, description, command_type, updated_at)
       SELECT
         json_extract(value, '$.id'),
         json_extract(value, '$.name'),
         json_extract(value, '$.description'),
         json_extract(value, '$.type'),
         json_extract(value, '$.updatedAt')
       FROM json_each(?)
       WHERE true
       ON CONFLICT(command_name) DO UPDATE SET
         description = excluded.description,
         command_type = excluded.command_type,
         updated_at = excluded.updated_at`
    ).bind(asJson(commandRows)),
    db.prepare(
      `INSERT INTO guilds (
         id, discord_guild_id, name, icon, bot_joined_at, bot_removed_at,
         last_seen_at, created_at, updated_at
       )
       SELECT
         json_extract(value, '$.id'),
         json_extract(value, '$.discordGuildId'),
         json_extract(value, '$.name'),
         json_extract(value, '$.icon'),
         json_extract(value, '$.timestamp'),
         NULL,
         json_extract(value, '$.timestamp'),
         json_extract(value, '$.timestamp'),
         json_extract(value, '$.timestamp')
       FROM json_each(?)
       WHERE true
       ON CONFLICT(discord_guild_id) DO UPDATE SET
         name = excluded.name,
         icon = excluded.icon,
         bot_joined_at = COALESCE(guilds.bot_joined_at, excluded.bot_joined_at),
         bot_removed_at = NULL,
         last_seen_at = excluded.last_seen_at,
         updated_at = excluded.updated_at`
    ).bind(asJson(guildRows)),
    db.prepare(
      "DELETE FROM guild_channels WHERE guild_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))"
    ).bind(asJson(internalGuildIdList)),
    db.prepare(
      `INSERT INTO guild_channels (
         id, guild_id, discord_channel_id, name, channel_type, category_id, category_name,
         can_view, can_send, position, updated_at
       )
       SELECT
         json_extract(value, '$.id'),
         json_extract(value, '$.guildId'),
         json_extract(value, '$.discordChannelId'),
         json_extract(value, '$.name'),
         json_extract(value, '$.type'),
         json_extract(value, '$.categoryId'),
         json_extract(value, '$.categoryName'),
         json_extract(value, '$.canView'),
         json_extract(value, '$.canSend'),
         json_extract(value, '$.position'),
         json_extract(value, '$.updatedAt')
       FROM json_each(?)`
    ).bind(asJson(channelRows)),
    db.prepare(
      "DELETE FROM guild_roles WHERE guild_id IN (SELECT CAST(value AS TEXT) FROM json_each(?))"
    ).bind(asJson(internalGuildIdList)),
    db.prepare(
      `INSERT INTO guild_roles (
         id, guild_id, discord_role_id, name, color, position, managed, bot_can_manage, updated_at
       )
       SELECT
         json_extract(value, '$.id'),
         json_extract(value, '$.guildId'),
         json_extract(value, '$.discordRoleId'),
         json_extract(value, '$.name'),
         json_extract(value, '$.color'),
         json_extract(value, '$.position'),
         json_extract(value, '$.managed'),
         json_extract(value, '$.botCanManage'),
         json_extract(value, '$.updatedAt')
       FROM json_each(?)`
    ).bind(asJson(roleRows)),
    db.prepare(
      `INSERT INTO counting_settings (
         guild_id, enabled, channel_id, reset_on_error, delete_wrong_messages,
         milestone_interval, current_number, record_number, total_counts,
         total_failures, last_user_id, sync_status, sync_error, created_at, updated_at
       )
       SELECT
         json_extract(value, '$.guildId'),
         json_extract(value, '$.enabled'),
         json_extract(value, '$.channelId'),
         json_extract(value, '$.resetOnError'),
         json_extract(value, '$.deleteWrongMessages'),
         json_extract(value, '$.milestoneInterval'),
         json_extract(value, '$.currentNumber'),
         json_extract(value, '$.recordNumber'),
         json_extract(value, '$.totalCounts'),
         json_extract(value, '$.totalFailures'),
         json_extract(value, '$.lastUserId'),
         'synced', NULL,
         json_extract(value, '$.timestamp'),
         json_extract(value, '$.timestamp')
       FROM json_each(?)
       WHERE true
       ON CONFLICT(guild_id) DO UPDATE SET
         enabled = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.enabled ELSE excluded.enabled END,
         channel_id = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.channel_id ELSE excluded.channel_id END,
         reset_on_error = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.reset_on_error ELSE excluded.reset_on_error END,
         delete_wrong_messages = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.delete_wrong_messages ELSE excluded.delete_wrong_messages END,
         milestone_interval = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.milestone_interval ELSE excluded.milestone_interval END,
         current_number = excluded.current_number,
         record_number = excluded.record_number,
         total_counts = excluded.total_counts,
         total_failures = excluded.total_failures,
         last_user_id = excluded.last_user_id,
         sync_status = CASE WHEN counting_settings.sync_status = 'pending' THEN 'pending' ELSE 'synced' END,
         sync_error = CASE WHEN counting_settings.sync_status = 'pending' THEN counting_settings.sync_error ELSE NULL END,
         updated_at = excluded.updated_at`
    ).bind(asJson(countingRows)),
    db.prepare(
      `INSERT INTO level_settings (
         guild_id, enabled, announcement_channel_id, role_rewards,
         sync_status, sync_error, created_at, updated_at
       )
       SELECT
         json_extract(value, '$.guildId'),
         json_extract(value, '$.enabled'),
         json_extract(value, '$.announcementChannelId'),
         json_extract(value, '$.roleRewards'),
         'synced', NULL,
         json_extract(value, '$.timestamp'),
         json_extract(value, '$.timestamp')
       FROM json_each(?)
       WHERE true
       ON CONFLICT(guild_id) DO UPDATE SET
         enabled = CASE WHEN level_settings.sync_status = 'pending' THEN level_settings.enabled ELSE excluded.enabled END,
         announcement_channel_id = CASE WHEN level_settings.sync_status = 'pending' THEN level_settings.announcement_channel_id ELSE excluded.announcement_channel_id END,
         role_rewards = CASE WHEN level_settings.sync_status = 'pending' THEN level_settings.role_rewards ELSE excluded.role_rewards END,
         sync_status = CASE WHEN level_settings.sync_status = 'pending' THEN 'pending' ELSE 'synced' END,
         sync_error = CASE WHEN level_settings.sync_status = 'pending' THEN level_settings.sync_error ELSE NULL END,
         updated_at = excluded.updated_at`
    ).bind(asJson(levelRows)),
    db.prepare(
      `INSERT INTO autorole_settings (
         guild_id, enabled, human_role_ids, bot_role_ids, delay_seconds,
         wait_for_screening, sync_status, sync_error, created_at, updated_at
       )
       SELECT
         json_extract(value, '$.guildId'),
         json_extract(value, '$.enabled'),
         json_extract(value, '$.humanRoleIds'),
         json_extract(value, '$.botRoleIds'),
         json_extract(value, '$.delaySeconds'),
         json_extract(value, '$.waitForScreening'),
         'synced', NULL,
         json_extract(value, '$.timestamp'),
         json_extract(value, '$.timestamp')
       FROM json_each(?)
       WHERE true
       ON CONFLICT(guild_id) DO UPDATE SET
         enabled = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.enabled ELSE excluded.enabled END,
         human_role_ids = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.human_role_ids ELSE excluded.human_role_ids END,
         bot_role_ids = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.bot_role_ids ELSE excluded.bot_role_ids END,
         delay_seconds = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.delay_seconds ELSE excluded.delay_seconds END,
         wait_for_screening = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.wait_for_screening ELSE excluded.wait_for_screening END,
         sync_status = CASE WHEN autorole_settings.sync_status = 'pending' THEN 'pending' ELSE 'synced' END,
         sync_error = CASE WHEN autorole_settings.sync_status = 'pending' THEN autorole_settings.sync_error ELSE NULL END,
         updated_at = excluded.updated_at`
    ).bind(asJson(autoroleRows))
  ]);

  await db.prepare(
    `INSERT INTO guild_control_modules (
       guild_id, module, configuration, runtime_state, sync_status, sync_error, created_at, updated_at
     )
     SELECT
       json_extract(value, '$.guildId'),
       json_extract(value, '$.module'),
       json_extract(value, '$.configuration'),
       json_extract(value, '$.runtimeState'),
       'synced', NULL,
       json_extract(value, '$.timestamp'),
       json_extract(value, '$.timestamp')
     FROM json_each(?)
     WHERE true
     ON CONFLICT(guild_id, module) DO UPDATE SET
       configuration = CASE WHEN guild_control_modules.sync_status = 'pending' THEN guild_control_modules.configuration ELSE excluded.configuration END,
       runtime_state = excluded.runtime_state,
       sync_status = CASE WHEN guild_control_modules.sync_status = 'pending' THEN 'pending' ELSE 'synced' END,
       sync_error = CASE WHEN guild_control_modules.sync_status = 'pending' THEN guild_control_modules.sync_error ELSE NULL END,
       updated_at = excluded.updated_at`
  ).bind(asJson(controlRows)).run();

  return json(c, {
    ok: true,
    stored: {
      guilds: guilds.length,
      commands: commands.length,
      channels: channelRows.length,
      roles: roleRows.length,
      counting: countingRows.length,
      levelSettings: levelRows.length,
      autoroleSettings: autoroleRows.length,
      controlModules: controlRows.length
    }
  });
});

app.post("/api/internal/bot/guilds/:guildId/left", async (c) => {
  await signedInternalBody(c);
  const guildId = c.req.param("guildId");
  snowflakeSchema.parse(guildId);
  await c.env.DB.prepare(
    "UPDATE guilds SET bot_joined_at = NULL, bot_removed_at = ?, updated_at = ? WHERE discord_guild_id = ?"
  )
    .bind(nowIso(), nowIso(), guildId)
    .run();
  return json(c, { ok: true });
});

app.get("/api/internal/bot/sync-events", async (c) => {
  await verifyInternalBotRequest(c.req.raw, c.env, "");
  const limit = Math.min(Number(c.req.query("limit") ?? "10") || 10, 25);
  const leaseExpiredAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    `UPDATE sync_events
        SET status = 'pending', updated_at = ?
      WHERE status = 'processing' AND updated_at < ? AND attempts < max_attempts`
  )
    .bind(nowIso(), leaseExpiredAt)
    .run();

  await c.env.DB.prepare(
    `UPDATE sync_events
        SET status = 'failed', last_error = COALESCE(last_error, 'Sync-Lease nach maximalen Versuchen abgelaufen'), updated_at = ?
      WHERE status = 'processing' AND updated_at < ? AND attempts >= max_attempts`
  )
    .bind(nowIso(), leaseExpiredAt)
    .run();

  const rows = await all<Record<string, unknown>>(
    c.env.DB.prepare(
      `SELECT e.id, g.discord_guild_id AS discordGuildId, e.action, e.payload, e.attempts, e.max_attempts AS maxAttempts, e.created_at AS createdAt
         FROM sync_events e
         JOIN guilds g ON g.id = e.guild_id
        WHERE e.status = 'pending' AND e.attempts < e.max_attempts
        ORDER BY e.created_at ASC
        LIMIT ?`
    ).bind(limit)
  );

  for (const row of rows) {
    await c.env.DB.prepare("UPDATE sync_events SET status = 'processing', attempts = attempts + 1, updated_at = ? WHERE id = ?")
      .bind(nowIso(), row.id)
      .run();
  }

  return json(c, {
    events: rows.map((row) => ({
      eventId: row.id,
      guildId: row.discordGuildId,
      action: row.action,
      payload: parseJson(String(row.payload), {}),
      attempt: Number(row.attempts ?? 0) + 1,
      maxAttempts: Number(row.maxAttempts ?? 5),
      createdAt: row.createdAt
    }))
  });
});

app.post("/api/internal/bot/sync-events/:eventId/complete", async (c) => {
  const body = (await signedInternalBody(c)) as { result?: unknown };
  const eventId = c.req.param("eventId");
  const row = await first<{ guild_id: string; action: string; payload: string; discord_guild_id: string }>(
    c.env.DB.prepare(
      `SELECT e.guild_id, e.action, e.payload, g.discord_guild_id
         FROM sync_events e
         JOIN guilds g ON g.id = e.guild_id
        WHERE e.id = ?`
    ).bind(eventId)
  );
  if (!row) throw new HttpError(404, "event_not_found", "Sync-Event nicht gefunden.");
  const eventPayload = parseJson<Record<string, unknown>>(row.payload, {});

  await c.env.DB.prepare(
    "UPDATE sync_events SET status = 'completed', last_error = NULL, completed_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(nowIso(), nowIso(), eventId)
    .run();

  if (row.action === "guild.member_avatar.update") {
    await c.env.DB.prepare(
      "UPDATE guild_settings SET bot_avatar_sync_status = 'synced', bot_avatar_sync_error = NULL, updated_at = ? WHERE guild_id = ?"
    )
      .bind(nowIso(), row.guild_id)
      .run();

    const result = body.result && typeof body.result === "object"
      ? body.result as Record<string, unknown>
      : {};
    const correctedMimeType = String(result.mimeType ?? "");
    const currentAvatarMediaKey = String(eventPayload.mediaKey ?? "");

    if (
      currentAvatarMediaKey
      && new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]).has(correctedMimeType)
    ) {
      await c.env.DB.prepare(
        "UPDATE guild_media SET mime_type = ? WHERE guild_id = ? AND media_key = ?"
      )
        .bind(correctedMimeType, row.guild_id, currentAvatarMediaKey)
        .run();
    }
  }

  if (row.action === "custom_command.upsert") {
    const command = eventPayload.command && typeof eventPayload.command === "object"
      ? eventPayload.command as Record<string, unknown>
      : {};
    const commandId = String(command.id ?? "");

    if (commandId) {
      await c.env.DB.prepare(
        "UPDATE custom_commands SET sync_status = 'synced', sync_error = NULL, updated_at = ? WHERE id = ? AND guild_id = ?"
      )
        .bind(nowIso(), commandId, row.guild_id)
        .run();
    }
  }

  if (row.action === "temp_voice.settings.upsert" || row.action === "temp_voice.panel.send") {
    await ensureTempVoiceStorage(c.env);
    const result = body.result && typeof body.result === "object"
      ? body.result as Record<string, unknown>
      : {};
    const panelChannelId = /^\d{17,20}$/.test(String(result.channelId ?? ""))
      ? String(result.channelId)
      : null;
    const panelMessageId = /^\d{17,20}$/.test(String(result.messageId ?? ""))
      ? String(result.messageId)
      : null;

    if (row.action === "temp_voice.panel.send" && panelChannelId && panelMessageId) {
      await c.env.DB.prepare(
        `UPDATE temp_voice_settings
            SET panel_channel_id = ?, panel_message_id = ?, interface_channel_id = ?,
                sync_status = 'synced', sync_error = NULL, updated_at = ?
          WHERE guild_id = ?`
      )
        .bind(panelChannelId, panelMessageId, panelChannelId, nowIso(), row.guild_id)
        .run();
    } else {
      await c.env.DB.prepare(
        "UPDATE temp_voice_settings SET sync_status = 'synced', sync_error = NULL, updated_at = ? WHERE guild_id = ?"
      )
        .bind(nowIso(), row.guild_id)
        .run();
    }
  }

  if (row.action === "counting.settings.upsert" || row.action === "counting.reset") {
    await ensureCountingStorage(c.env);
    const current = await ensureCountingSettings(c.env, row.guild_id);
    const result = body.result && typeof body.result === "object"
      ? body.result as Record<string, unknown>
      : {};
    const safeNumber = (key: string, fallback: number) => {
      const value = Number(result[key]);
      return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
    };
    const channelId = Object.prototype.hasOwnProperty.call(result, "channelId")
      ? (/^\d{17,20}$/.test(String(result.channelId ?? "")) ? String(result.channelId) : null)
      : current.channelId;
    const lastUserId = Object.prototype.hasOwnProperty.call(result, "lastUserId")
      ? (/^\d{17,20}$/.test(String(result.lastUserId ?? "")) ? String(result.lastUserId) : null)
      : current.lastUserId;

    await c.env.DB.prepare(
      `UPDATE counting_settings
          SET enabled = ?, channel_id = ?, reset_on_error = ?, delete_wrong_messages = ?,
              milestone_interval = ?, current_number = ?, record_number = ?, total_counts = ?,
              total_failures = ?, last_user_id = ?, sync_status = 'synced', sync_error = NULL,
              updated_at = ?
        WHERE guild_id = ?`
    ).bind(
      typeof result.enabled === "boolean" ? (result.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
      channelId,
      typeof result.resetOnError === "boolean" ? (result.resetOnError ? 1 : 0) : (current.resetOnError ? 1 : 0),
      typeof result.deleteWrongMessages === "boolean" ? (result.deleteWrongMessages ? 1 : 0) : (current.deleteWrongMessages ? 1 : 0),
      safeNumber("milestoneInterval", current.milestoneInterval),
      safeNumber("currentNumber", current.currentNumber),
      safeNumber("recordNumber", current.recordNumber),
      safeNumber("totalCounts", current.totalCounts),
      safeNumber("totalFailures", current.totalFailures),
      lastUserId,
      nowIso(),
      row.guild_id
    ).run();
  }

  if (row.action === "level.settings.upsert") {
    await ensureLevelStorage(c.env);
    const current = await ensureLevelSettings(c.env, row.guild_id);
    const result = body.result && typeof body.result === "object"
      ? body.result as Record<string, unknown>
      : {};
    const announcementChannelId = Object.prototype.hasOwnProperty.call(result, "announcementChannelId")
      ? (/^\d{17,20}$/.test(String(result.announcementChannelId ?? "")) ? String(result.announcementChannelId) : null)
      : current.announcementChannelId;
    const parsedRewards = Array.isArray(result.roleRewards)
      ? result.roleRewards
        .filter((reward): reward is Record<string, unknown> => Boolean(reward && typeof reward === "object"))
        .map((reward) => ({ level: Number(reward.level), roleId: String(reward.roleId ?? "") }))
        .filter((reward) => Number.isInteger(reward.level) && reward.level >= 1 && reward.level <= 1000 && /^\d{17,20}$/.test(reward.roleId))
        .sort((a, b) => a.level - b.level)
      : current.roleRewards;

    await c.env.DB.prepare(
      `UPDATE level_settings
          SET enabled = ?, announcement_channel_id = ?, role_rewards = ?,
              sync_status = 'synced', sync_error = NULL, updated_at = ?
        WHERE guild_id = ?`
    ).bind(
      typeof result.enabled === "boolean" ? (result.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
      announcementChannelId,
      asJson(parsedRewards),
      nowIso(),
      row.guild_id
    ).run();
  }

  if (row.action === "autorole.settings.upsert") {
    await ensureAutoroleStorage(c.env);
    const current = await ensureAutoroleSettings(c.env, row.guild_id);
    const result = body.result && typeof body.result === "object"
      ? body.result as Record<string, unknown>
      : {};
    const humanRoleIds = Object.prototype.hasOwnProperty.call(result, "humanRoleIds")
      ? normalizeRoleIds(result.humanRoleIds)
      : current.humanRoleIds;
    const botRoleIds = Object.prototype.hasOwnProperty.call(result, "botRoleIds")
      ? normalizeRoleIds(result.botRoleIds)
      : current.botRoleIds;
    const parsedDelay = Number(result.delaySeconds);
    const delaySeconds = Number.isSafeInteger(parsedDelay)
      ? Math.max(0, Math.min(3600, parsedDelay))
      : current.delaySeconds;

    await c.env.DB.prepare(
      `UPDATE autorole_settings
          SET enabled = ?, human_role_ids = ?, bot_role_ids = ?, delay_seconds = ?,
              wait_for_screening = ?, sync_status = 'synced', sync_error = NULL,
              updated_at = ?
        WHERE guild_id = ?`
    ).bind(
      typeof result.enabled === "boolean" ? (result.enabled ? 1 : 0) : (current.enabled ? 1 : 0),
      asJson(humanRoleIds),
      asJson(botRoleIds),
      delaySeconds,
      typeof result.waitForScreening === "boolean"
        ? (result.waitForScreening ? 1 : 0)
        : (current.waitForScreening ? 1 : 0),
      nowIso(),
      row.guild_id
    ).run();
  }

  const controlModuleByAction: Partial<Record<string, GuildControlModule>> = {
    "security.settings.upsert": "security",
    "raidmode.settings.upsert": "raidmode",
    "ticket.settings.upsert": "tickets",
    "ticket.panel.send": "tickets",
    "backup.action": "backups"
  };
  const controlModule = controlModuleByAction[row.action];
  if (controlModule) {
    await ensureGuildControlStorage(c.env);
    const currentRow = await first<GuildControlModuleRow>(
      c.env.DB.prepare(
        `SELECT guild_id, module, configuration, runtime_state, sync_status, sync_error, updated_at
           FROM guild_control_modules WHERE guild_id = ? AND module = ?`
      ).bind(row.guild_id, controlModule)
    );
    const currentConfiguration = currentRow ? recordValue(parseJson(currentRow.configuration, {})) : DEFAULT_CONTROL_CONFIGURATIONS[controlModule];
    const currentRuntime = currentRow ? recordValue(parseJson(currentRow.runtime_state, {})) : DEFAULT_CONTROL_RUNTIME[controlModule];
    const result = recordValue(body.result);
    const configuration = Object.keys(recordValue(result.configuration)).length
      ? recordValue(result.configuration)
      : currentConfiguration;
    const runtime = Object.keys(recordValue(result.runtime)).length
      ? recordValue(result.runtime)
      : currentRuntime;

    await c.env.DB.prepare(
      `UPDATE guild_control_modules
          SET configuration = ?, runtime_state = ?, sync_status = 'synced', sync_error = NULL, updated_at = ?
        WHERE guild_id = ? AND module = ?`
    ).bind(asJson(configuration), asJson(runtime), nowIso(), row.guild_id, controlModule).run();
  }

  const currentMediaKey = row.action === "guild.member_avatar.update"
    ? String(eventPayload.mediaKey ?? "")
    : row.action === "welcome_settings.upsert"
      ? String(((eventPayload.settings as Record<string, unknown> | undefined)?.embed as Record<string, unknown> | undefined)?.imageMediaKey ?? "")
      : "";
  const previousMediaKey = row.action === "guild.member_avatar.update"
    ? String(eventPayload.previousMediaKey ?? "")
    : row.action === "welcome_settings.upsert"
      ? String(eventPayload.previousImageMediaKey ?? "")
      : "";

  if (
    previousMediaKey
    && previousMediaKey !== currentMediaKey
    && previousMediaKey.startsWith(`guilds/${row.discord_guild_id}/`)
    && !previousMediaKey.includes("..")
  ) {
    try {
      await deleteGuildMedia(c.env, row.guild_id, previousMediaKey);
    } catch (error) {
      console.warn("Altes Guild-Medium konnte nicht automatisch entfernt werden", error);
    }
  }

  return json(c, { ok: true, result: body.result ?? null });
});

app.post("/api/internal/bot/sync-events/:eventId/fail", async (c) => {
  const body = (await signedInternalBody(c)) as { error?: string; retry?: boolean };
  const eventId = c.req.param("eventId");
  const row = await first<{ attempts: number; max_attempts: number; guild_id: string; action: string; payload: string }>(
    c.env.DB.prepare("SELECT attempts, max_attempts, guild_id, action, payload FROM sync_events WHERE id = ?").bind(eventId)
  );
  if (!row) throw new HttpError(404, "event_not_found", "Sync-Event nicht gefunden.");

  const retry = body.retry !== false && Number(row.attempts) < Number(row.max_attempts);
  await c.env.DB.prepare("UPDATE sync_events SET status = ?, last_error = ?, updated_at = ? WHERE id = ?")
    .bind(retry ? "pending" : "failed", String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), eventId)
    .run();

  if (!retry && row.action === "guild.member_avatar.update") {
    await c.env.DB.prepare(
      "UPDATE guild_settings SET bot_avatar_sync_status = 'failed', bot_avatar_sync_error = ?, updated_at = ? WHERE guild_id = ?"
    )
      .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id)
      .run();
  }

  if (!retry && row.action === "custom_command.upsert") {
    const eventPayload = parseJson<Record<string, unknown>>(row.payload, {});
    const command = eventPayload.command && typeof eventPayload.command === "object"
      ? eventPayload.command as Record<string, unknown>
      : {};
    const commandId = String(command.id ?? "");

    if (commandId) {
      await c.env.DB.prepare(
        "UPDATE custom_commands SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE id = ? AND guild_id = ?"
      )
        .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), commandId, row.guild_id)
        .run();
    }
  }

  if (!retry && (row.action === "temp_voice.settings.upsert" || row.action === "temp_voice.panel.send")) {
    await ensureTempVoiceStorage(c.env);
    await c.env.DB.prepare(
      "UPDATE temp_voice_settings SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE guild_id = ?"
    )
      .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id)
      .run();
  }

  if (!retry && (row.action === "counting.settings.upsert" || row.action === "counting.reset")) {
    await ensureCountingStorage(c.env);
    await c.env.DB.prepare(
      "UPDATE counting_settings SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE guild_id = ?"
    )
      .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id)
      .run();
  }

  if (!retry && row.action === "level.settings.upsert") {
    await ensureLevelStorage(c.env);
    await c.env.DB.prepare(
      "UPDATE level_settings SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE guild_id = ?"
    )
      .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id)
      .run();
  }

  if (!retry && row.action === "autorole.settings.upsert") {
    await ensureAutoroleStorage(c.env);
    await c.env.DB.prepare(
      "UPDATE autorole_settings SET sync_status = 'failed', sync_error = ?, updated_at = ? WHERE guild_id = ?"
    )
      .bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id)
      .run();
  }

  const failedControlModuleByAction: Partial<Record<string, GuildControlModule>> = {
    "security.settings.upsert": "security",
    "raidmode.settings.upsert": "raidmode",
    "ticket.settings.upsert": "tickets",
    "ticket.panel.send": "tickets",
    "backup.action": "backups"
  };
  const failedControlModule = failedControlModuleByAction[row.action];
  if (!retry && failedControlModule) {
    await ensureGuildControlStorage(c.env);
    await c.env.DB.prepare(
      `UPDATE guild_control_modules
          SET sync_status = 'failed', sync_error = ?, updated_at = ?
        WHERE guild_id = ? AND module = ?`
    ).bind(String(body.error ?? "Unbekannter Fehler").slice(0, 1000), nowIso(), row.guild_id, failedControlModule).run();
  }

  return json(c, { ok: true, retry });
});

app.get("/api/internal/bot/media", async (c) => {
  await verifyInternalBotRequest(c.req.raw, c.env, "");
  const key = c.req.query("key");
  if (!key || key.includes("..") || !key.startsWith("guilds/")) {
    throw new HttpError(400, "media_key_invalid", "Media-Key ist ungültig.");
  }

  const object = await loadGuildMedia(c.env, key);
  if (!object) throw new HttpError(404, "media_not_found", "Medium nicht gefunden.");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.mimeType,
      "Content-Length": String(object.sizeBytes),
      "Cache-Control": "private, max-age=60"
    }
  });
});

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith("/api/")) {
    return json(c, { error: { code: "not_found", message: "API-Endpunkt nicht gefunden." } }, 404);
  }
  if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
  return new Response("Not found", { status: 404 });
});

async function scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  const timestamp = nowIso();
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(timestamp).run();
  await env.DB.prepare(
    "DELETE FROM sync_events WHERE status = 'completed' AND completed_at IS NOT NULL AND completed_at < datetime('now', '-30 days')"
  ).run();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const redirect = httpsRedirect(request);
    if (redirect) return redirect;

    return withSecurityHeaders(await app.fetch(request, env, ctx));
  },
  scheduled
};

export { app };
