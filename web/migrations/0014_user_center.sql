CREATE TABLE IF NOT EXISTS user_center_preferences (
  discord_user_id TEXT PRIMARY KEY,
  favorites TEXT NOT NULL DEFAULT '[]',
  reminders TEXT NOT NULL DEFAULT '[]',
  ai_history TEXT NOT NULL DEFAULT '[]',
  roadmap_votes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_center_activity (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  guild_id TEXT,
  guild_name TEXT,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'info',
  target_path TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_center_activity_user
  ON user_center_activity(discord_user_id, created_at DESC);
