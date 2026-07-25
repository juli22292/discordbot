CREATE TABLE IF NOT EXISTS counting_user_stats (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  correct_counts INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_counting_user_stats_score
  ON counting_user_stats(correct_counts DESC, failures ASC);

CREATE INDEX IF NOT EXISTS idx_counting_user_stats_user
  ON counting_user_stats(user_id);
