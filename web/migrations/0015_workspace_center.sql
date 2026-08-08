CREATE TABLE IF NOT EXISTS guild_workspace_items (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  owner_discord_user_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('draft', 'template')),
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspace_items_owner
  ON guild_workspace_items(guild_id, owner_discord_user_id, item_type, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_panel_preferences (
  discord_user_id TEXT PRIMARY KEY,
  density TEXT NOT NULL DEFAULT 'comfortable',
  sidebar_compact INTEGER NOT NULL DEFAULT 0,
  reduce_motion INTEGER NOT NULL DEFAULT 0,
  default_guild_id TEXT,
  default_section TEXT NOT NULL DEFAULT 'overview',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
