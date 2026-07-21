CREATE TABLE IF NOT EXISTS guild_media_chunks (
  media_id TEXT NOT NULL REFERENCES guild_media(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_data BLOB NOT NULL,
  PRIMARY KEY (media_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_guild_media_chunks_media
  ON guild_media_chunks(media_id, chunk_index);
