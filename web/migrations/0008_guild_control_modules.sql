CREATE TABLE IF NOT EXISTS guild_control_modules (
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  configuration TEXT NOT NULL DEFAULT '{}',
  runtime_state TEXT NOT NULL DEFAULT '{}',
  sync_status TEXT NOT NULL DEFAULT 'idle',
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, module)
);

CREATE INDEX IF NOT EXISTS idx_guild_control_modules_sync
  ON guild_control_modules(module, sync_status, updated_at);
