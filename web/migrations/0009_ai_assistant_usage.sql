CREATE TABLE IF NOT EXISTS ai_assistant_usage (
  user_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_assistant_usage_updated_at
  ON ai_assistant_usage(updated_at);
