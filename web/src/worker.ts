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
  discordAvatarUrl,
  discordBotInviteUrl,
  discordGuildIconUrl,
  discordOAuthAuthorizeUrl,
  exchangeDiscordCode,
  fetchDiscordBotGuild,
  fetchDiscordGuilds,
  fetchDiscordUser,
  refreshDiscordToken
} from "./server/discord";
import { canManageGuild, permissionLabel } from "./server/permissions";
import type { ActiveSession, DiscordGuild, Env, GuildAccess, SessionUser, TokenData } from "./server/types";
import {
  assertSameGuild,
  commandConfigSchema,
  customCommandSchema,
  nicknameSchema,
  partialCustomCommandSchema,
  safeRedirectPath,
  settingsSchema,
  snowflakeSchema,
  validationError
} from "./server/validators";

type AppBindings = { Bindings: Env };
const app = new Hono<AppBindings>();

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
    throw new HttpError(400, "invalid_json", "Der Request enthaelt kein gueltiges JSON.");
  }
}

async function signedInternalBody(c: HonoContext): Promise<unknown> {
  const bodyText = await c.req.raw.clone().text();
  await verifyInternalBotRequest(c.req.raw, c.env, bodyText);
  if (!bodyText) return {};

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new HttpError(400, "invalid_json", "Der interne Request enthaelt kein gueltiges JSON.");
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

async function readEncryptedCookieState(c: HonoContext, expectedState: string, expectedKind: OAuthStateData["kind"]): Promise<OAuthStateData> {
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
    stateData.kind !== expectedKind ||
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

async function getFreshGuilds(c: HonoContext, session: ActiveSession): Promise<DiscordGuild[]> {
  try {
    return await fetchDiscordGuilds(session.tokenData);
  } catch (error) {
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

  if (!code || !state) {
    throw new HttpError(400, "oauth_state_invalid", "Discord-Login konnte nicht sicher validiert werden.");
  }

  const stateData = await readEncryptedCookieState(c, state, "login");
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

  const response = c.redirect(stateData.returnTo || "/home");
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
  if (!stateData.guildId) throw new HttpError(400, "invite_state_invalid", "Die Bot-Einladung ist unvollstaendig.");
  const access = await requireGuildManagementAccess(c, stateData.guildId, { requireBot: false });
  const returnTo = stateData.returnTo || `/dashboard/${stateData.guildId}/overview`;

  if (inviteError) {
    const response = c.redirect(addQueryParam(returnTo, "invite", "cancelled"));
    response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
    return response;
  }

  if (!code) {
    throw new HttpError(400, "invite_code_missing", "Discord hat die Bot-Einladung nicht bestaetigt.");
  }

  await markBotInstalled(c.env, access.guild);

  const response = c.redirect(addQueryParam(returnTo, "invite", "done"));
  response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_STATE_COOKIE, c.env));
  return response;
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
    throw new HttpError(503, "r2_not_configured", "R2 ist fuer Avatar-Uploads nicht konfiguriert.");
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
    throw new HttpError(400, "command_name_invalid", "Der Command-Name ist ungueltig.");
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
    throw new HttpError(400, "media_key_invalid", "Media-Key ist ungueltig.");
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
  fetch: app.fetch,
  scheduled
};

export { app };
