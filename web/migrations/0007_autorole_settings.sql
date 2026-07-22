CREATE TABLE IF NOT EXISTS autorole_settings (
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
);

CREATE INDEX IF NOT EXISTS idx_autorole_settings_sync
  ON autorole_settings(sync_status, updated_at);
