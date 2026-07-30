PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guild_panel_access (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('user', 'role')),
  principal_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL CHECK (access_level IN ('administrator', 'moderator', 'supporter', 'viewer')),
  capabilities TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by_discord_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, principal_type, principal_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_panel_access_principal
  ON guild_panel_access(principal_type, principal_id, enabled);

CREATE INDEX IF NOT EXISTS idx_guild_panel_access_guild
  ON guild_panel_access(guild_id, enabled, access_level);

CREATE TABLE IF NOT EXISTS moderation_cases (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  case_number INTEGER NOT NULL,
  target_discord_user_id TEXT NOT NULL,
  target_display_name TEXT NOT NULL DEFAULT '',
  actor_discord_user_id TEXT NOT NULL,
  actor_display_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  reason TEXT NOT NULL,
  duration_seconds INTEGER,
  delete_message_seconds INTEGER NOT NULL DEFAULT 0,
  sync_event_id TEXT REFERENCES sync_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(guild_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_guild_created
  ON moderation_cases(guild_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_sync_event
  ON moderation_cases(sync_event_id);

CREATE TABLE IF NOT EXISTS audit_reverts (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  audit_log_id TEXT NOT NULL REFERENCES audit_logs(id) ON DELETE CASCADE,
  actor_discord_user_id TEXT NOT NULL,
  sync_event_id TEXT REFERENCES sync_events(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(guild_id, audit_log_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_reverts_guild_created
  ON audit_reverts(guild_id, created_at DESC);
