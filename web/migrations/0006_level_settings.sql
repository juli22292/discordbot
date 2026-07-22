CREATE TABLE IF NOT EXISTS level_settings (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  announcement_channel_id TEXT,
  role_rewards TEXT NOT NULL DEFAULT '[]',
  sync_status TEXT NOT NULL DEFAULT 'idle',
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_level_settings_sync
  ON level_settings(sync_status, updated_at);
