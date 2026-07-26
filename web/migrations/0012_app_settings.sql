CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by_discord_user_id TEXT,
  updated_at TEXT NOT NULL
);
