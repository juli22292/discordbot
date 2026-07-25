PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guild_click_counters (
  guild_id TEXT PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  daily_clicks INTEGER NOT NULL DEFAULT 0,
  current_day TEXT,
  best_daily_clicks INTEGER NOT NULL DEFAULT 0,
  best_day TEXT,
  last_clicked_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guild_click_counters_total
  ON guild_click_counters(total_clicks DESC, best_daily_clicks DESC);

CREATE TABLE IF NOT EXISTS guild_click_cooldowns (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  last_clicked_at TEXT NOT NULL,
  PRIMARY KEY (guild_id, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_guild_click_cooldowns_clicked
  ON guild_click_cooldowns(last_clicked_at);
