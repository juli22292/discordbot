CREATE TABLE IF NOT EXISTS counting_settings (
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
);

CREATE INDEX IF NOT EXISTS idx_counting_settings_sync
  ON counting_settings(sync_status, updated_at);
