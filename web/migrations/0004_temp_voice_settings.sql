CREATE TABLE IF NOT EXISTS temp_voice_settings (
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
);

CREATE INDEX IF NOT EXISTS idx_temp_voice_settings_sync
  ON temp_voice_settings(sync_status, updated_at);
