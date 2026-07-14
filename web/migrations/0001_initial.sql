PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_token_data TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_expires ON sessions(user_id, expires_at);

CREATE TABLE guilds (
  id TEXT PRIMARY KEY,
  discord_guild_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  bot_joined_at TEXT,
  bot_removed_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guild_settings (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL UNIQUE REFERENCES guilds(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'de',
  timezone TEXT,
  bot_nickname TEXT,
  bot_avatar_media_key TEXT,
  bot_avatar_sync_status TEXT NOT NULL DEFAULT 'idle',
  bot_avatar_sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bot_commands (
  id TEXT PRIMARY KEY,
  command_name TEXT NOT NULL UNIQUE,
  description TEXT,
  command_type TEXT NOT NULL DEFAULT 'slash',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE command_configurations (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  command_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  ephemeral INTEGER NOT NULL DEFAULT 1,
  administrator_only INTEGER NOT NULL DEFAULT 0,
  moderator_only INTEGER NOT NULL DEFAULT 0,
  allowed_channel_ids TEXT NOT NULL DEFAULT '[]',
  denied_channel_ids TEXT NOT NULL DEFAULT '[]',
  allowed_role_ids TEXT NOT NULL DEFAULT '[]',
  denied_role_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, command_name)
);

CREATE TABLE custom_commands (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_command_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  response_type TEXT NOT NULL DEFAULT 'message',
  response_content TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  ephemeral INTEGER NOT NULL DEFAULT 0,
  cooldown_seconds INTEGER NOT NULL DEFAULT 0,
  allowed_channel_ids TEXT NOT NULL DEFAULT '[]',
  denied_channel_ids TEXT NOT NULL DEFAULT '[]',
  allowed_role_ids TEXT NOT NULL DEFAULT '[]',
  denied_role_ids TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_by_discord_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, name)
);

CREATE TABLE welcome_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  channel_id TEXT,
  message TEXT,
  embed_configuration TEXT NOT NULL DEFAULT '{}',
  auto_role_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goodbye_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0,
  channel_id TEXT,
  message TEXT,
  embed_configuration TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE logging_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  enabled_events TEXT NOT NULL DEFAULT '[]',
  channel_mappings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guild_channels (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_channel_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  category_id TEXT,
  category_name TEXT,
  can_view INTEGER NOT NULL DEFAULT 0,
  can_send INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, discord_channel_id)
);

CREATE INDEX idx_guild_channels_guild ON guild_channels(guild_id, position);

CREATE TABLE guild_roles (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  discord_role_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  managed INTEGER NOT NULL DEFAULT 0,
  bot_can_manage INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, discord_role_id)
);

CREATE INDEX idx_guild_roles_guild ON guild_roles(guild_id, position DESC);

CREATE TABLE guild_media (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  media_key TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_by_discord_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  actor_discord_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_guild_created ON audit_logs(guild_id, created_at DESC);

CREATE TABLE sync_events (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX idx_sync_events_status_created ON sync_events(status, created_at);
