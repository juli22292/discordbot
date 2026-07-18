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
import { PANEL_OWNER_DISCORD_USER_ID, canManageGuild, canUsePanel, permissionLabel } from "./server/permissions";
import type { ActiveSession, DiscordGuild, Env, GuildAccess, SessionUser, TokenData } from "./server/types";
import {
  assertSameGuild,
  adminRoleUpdateSchema,
  botAdminActionSchema,
  commandConfigSchema,
  customCommandSchema,
  guildModuleSettingsSchema,
  inviteCreateSchema,
  logCategories,
  loggingSettingsSchema,
  loggingTestSchema,
  nicknameSchema,
  partialCustomCommandSchema,
  pterodactylPowerSchema,
  presenceSchema,
  safeRedirectPath,
  settingsSchema,
  snowflakeSchema,
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
  if (!canUsePanel(session.user.discordUserId)) {
    throw new HttpError(403, "panel_forbidden", "Dieses Webpanel ist nur für den freigeschalteten Bot-Owner verfügbar.");
  }
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

function mediaPreviewUrl(discordGuildId: string, mediaKey: string): string {
  return `/api/guilds/${discordGuildId}/media?key=${encodeURIComponent(mediaKey)}`;
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
    if (!allowedIds.has(session.user.discordUserId)) {
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
  return json(c, { user: publicUser(session), expiresAt: session.expiresAt });
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
  if (!canUsePanel(user.id)) {
    const response = c.redirect("/login?error=not_allowed");
    response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
    response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE, c.env));
    return response;
  }

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
  if (!c.env.GUILD_MEDIA) {
    throw new HttpError(503, "r2_not_configured", "R2 ist für Avatar-Uploads nicht konfiguriert.");
  }

  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const form = await c.req.formData();
  const file = form.get("avatar");

  if (!(file instanceof File)) {
    throw new HttpError(400, "avatar_missing", "Bitte lade eine Bilddatei hoch.");
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new HttpError(400, "avatar_type_invalid", "Erlaubt sind PNG, JPEG, GIF und WebP.");
  }

  const maxBytes = 512 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(400, "avatar_too_large", "Das Bild darf maximal 512 KiB gross sein.");
  }

  const mediaId = newId("med");
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
  const mediaKey = `guilds/${access.guild.discordGuildId}/bot-avatar/${mediaId}.${extension}`;
  const bytes = await file.arrayBuffer();

  await c.env.GUILD_MEDIA.put(mediaKey, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { guildId: access.guild.discordGuildId }
  });

  await c.env.DB.prepare(
    `INSERT INTO guild_media (id, guild_id, media_key, mime_type, size_bytes, created_by_discord_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(mediaId, access.guild.id, mediaKey, file.type, file.size, access.session.user.discordUserId, nowIso())
    .run();

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
    mimeType: file.type
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "profile.avatar.update", "bot_avatar", null, { mediaKey, mimeType: file.type, sizeBytes: file.size });
  return json(c, { ok: true, eventId, mediaKey });
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
  if (!c.env.GUILD_MEDIA) {
    throw new HttpError(503, "r2_not_configured", "R2 ist nicht konfiguriert.");
  }

  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const key = c.req.query("key");

  if (!key || key.includes("..") || !key.startsWith(`guilds/${access.guild.discordGuildId}/`)) {
    throw new HttpError(400, "media_key_invalid", "Media-Key ist ungültig.");
  }

  await assertGuildMedia(c.env, access.guild.id, key);
  const object = await c.env.GUILD_MEDIA.get(key);
  if (!object) throw new HttpError(404, "media_not_found", "Medium nicht gefunden.");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
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
    settings: saved
  });

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "welcome.update", "welcome_settings", oldValue, saved);
  return json(c, { ok: true, eventId, welcome: saved });
});

app.post("/api/guilds/:guildId/welcome/image", async (c) => {
  if (!c.env.GUILD_MEDIA) {
    throw new HttpError(503, "r2_not_configured", "R2 ist für Begrüßungsbilder nicht konfiguriert.");
  }

  const access = await requireGuildManagementAccess(c, c.req.param("guildId"));
  const form = await c.req.formData();
  const file = form.get("image");

  if (!(file instanceof File)) {
    throw new HttpError(400, "welcome_image_missing", "Bitte lade eine Bilddatei hoch.");
  }

  const allowedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new HttpError(400, "welcome_image_type_invalid", "Erlaubt sind PNG, JPEG, GIF und WebP.");
  }

  const maxBytes = 4 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new HttpError(400, "welcome_image_too_large", "Das Bild darf maximal 4 MiB groß sein.");
  }

  const mediaId = newId("med");
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "img";
  const mediaKey = `guilds/${access.guild.discordGuildId}/welcome/${mediaId}.${extension}`;
  const bytes = await file.arrayBuffer();

  await c.env.GUILD_MEDIA.put(mediaKey, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { guildId: access.guild.discordGuildId, kind: "welcome" }
  });

  await c.env.DB.prepare(
    `INSERT INTO guild_media (id, guild_id, media_key, mime_type, size_bytes, created_by_discord_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(mediaId, access.guild.id, mediaKey, file.type, file.size, access.session.user.discordUserId, nowIso())
    .run();

  await audit(c.env, access.guild.id, access.session.user.discordUserId, "welcome.image.upload", "guild_media", null, {
    mediaKey,
    mimeType: file.type,
    sizeBytes: file.size
  });

  return json(c, {
    ok: true,
    mediaKey,
    mediaUrl: mediaPreviewUrl(access.guild.discordGuildId, mediaKey),
    mimeType: file.type,
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
  const body = signedInternalBody(c);
  const payload = (await body) as {
    guilds?: Array<{
      id: string;
      name: string;
      icon?: string | null;
      channels?: Array<Record<string, unknown>>;
      roles?: Array<Record<string, unknown>>;
    }>;
    commands?: Array<{ name: string; description?: string; type?: string }>;
  };
  const timestamp = nowIso();

  for (const command of payload.commands ?? []) {
    if (!command.name || !/^[a-z0-9 _-]{1,80}$/.test(command.name)) continue;
    await c.env.DB.prepare(
      `INSERT INTO bot_commands (id, command_name, description, command_type, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(command_name) DO UPDATE SET
         description = excluded.description,
         command_type = excluded.command_type,
         updated_at = excluded.updated_at`
    )
      .bind(newId("bc"), command.name, command.description ?? "", command.type ?? "slash", timestamp)
      .run();
  }

  for (const guild of payload.guilds ?? []) {
    if (!/^\d{17,20}$/.test(guild.id)) continue;
    const existing = await first<{ id: string }>(
      c.env.DB.prepare("SELECT id FROM guilds WHERE discord_guild_id = ?").bind(guild.id)
    );
    const internalGuildId = existing?.id ?? newId("gld");

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE guilds
            SET name = ?, icon = ?, bot_joined_at = COALESCE(bot_joined_at, ?),
                bot_removed_at = NULL, last_seen_at = ?, updated_at = ?
          WHERE id = ?`
      )
        .bind(guild.name, guild.icon ?? null, timestamp, timestamp, timestamp, internalGuildId)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO guilds (id, discord_guild_id, name, icon, bot_joined_at, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(internalGuildId, guild.id, guild.name, guild.icon ?? null, timestamp, timestamp, timestamp, timestamp)
        .run();
    }

    await c.env.DB.prepare("DELETE FROM guild_channels WHERE guild_id = ?").bind(internalGuildId).run();
    for (const channel of guild.channels ?? []) {
      const channelId = String(channel.id ?? "");
      if (!/^\d{17,20}$/.test(channelId)) continue;
      await c.env.DB.prepare(
        `INSERT INTO guild_channels (
           id, guild_id, discord_channel_id, name, channel_type, category_id, category_name,
           can_view, can_send, position, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId("chn"),
          internalGuildId,
          channelId,
          String(channel.name ?? "Unbenannt"),
          String(channel.type ?? "unknown"),
          channel.categoryId ? String(channel.categoryId) : null,
          channel.categoryName ? String(channel.categoryName) : null,
          channel.canView ? 1 : 0,
          channel.canSend ? 1 : 0,
          Number(channel.position ?? 0),
          timestamp
        )
        .run();
    }

    await c.env.DB.prepare("DELETE FROM guild_roles WHERE guild_id = ?").bind(internalGuildId).run();
    for (const role of guild.roles ?? []) {
      const roleId = String(role.id ?? "");
      if (!/^\d{17,20}$/.test(roleId)) continue;
      await c.env.DB.prepare(
        `INSERT INTO guild_roles (
           id, guild_id, discord_role_id, name, color, position, managed, bot_can_manage, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          newId("rol"),
          internalGuildId,
          roleId,
          String(role.name ?? "Unbenannt"),
          Number(role.color ?? 0),
          Number(role.position ?? 0),
          role.managed ? 1 : 0,
          role.botCanManage ? 1 : 0,
          timestamp
        )
        .run();
    }
  }

  return json(c, { ok: true });
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
  const row = await first<{ guild_id: string; action: string }>(
    c.env.DB.prepare("SELECT guild_id, action FROM sync_events WHERE id = ?").bind(eventId)
  );
  if (!row) throw new HttpError(404, "event_not_found", "Sync-Event nicht gefunden.");

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
  }

  return json(c, { ok: true, result: body.result ?? null });
});

app.post("/api/internal/bot/sync-events/:eventId/fail", async (c) => {
  const body = (await signedInternalBody(c)) as { error?: string; retry?: boolean };
  const eventId = c.req.param("eventId");
  const row = await first<{ attempts: number; max_attempts: number; guild_id: string; action: string }>(
    c.env.DB.prepare("SELECT attempts, max_attempts, guild_id, action FROM sync_events WHERE id = ?").bind(eventId)
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

  return json(c, { ok: true, retry });
});

app.get("/api/internal/bot/media", async (c) => {
  await verifyInternalBotRequest(c.req.raw, c.env, "");
  if (!c.env.GUILD_MEDIA) throw new HttpError(503, "r2_not_configured", "R2 ist nicht konfiguriert.");
  const key = c.req.query("key");
  if (!key || key.includes("..") || !key.startsWith("guilds/")) {
    throw new HttpError(400, "media_key_invalid", "Media-Key ist ungültig.");
  }

  const object = await c.env.GUILD_MEDIA.get(key);
  if (!object) throw new HttpError(404, "media_not_found", "Medium nicht gefunden.");

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
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
