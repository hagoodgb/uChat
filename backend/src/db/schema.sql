CREATE TABLE IF NOT EXISTS connection_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL,        -- 'openai' | 'openrouter' | 'deepseek' | 'anthropic' | 'custom'
  base_url TEXT,                      -- override; each provider has a sensible default
  api_key_encrypted TEXT,             -- AES-256-GCM, never sent back to client
  extra_headers_json TEXT,            -- for fully custom endpoints
  last_connected_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  settings_json TEXT NOT NULL,        -- { temperature: 0.8, top_p: 1, ... } superset of all providers
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,            -- full SillyTavern-style card fields
  avatar_path TEXT,                   -- relative path under /data/avatars
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lorebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  book_json TEXT NOT NULL,            -- { description, scan_depth, token_budget, recursive_scanning, entries: [...] }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS character_lorebooks (
  character_id TEXT NOT NULL,
  lorebook_id TEXT NOT NULL,
  PRIMARY KEY (character_id, lorebook_id)
);

CREATE TABLE IF NOT EXISTS personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  data_json TEXT NOT NULL,            -- { description }
  avatar_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'single',-- 'single' | 'group' | 'blank'
  character_ids_json TEXT,            -- array of character ids involved
  connection_id TEXT,
  model_map_json TEXT,                -- { characterId: modelId } for group chats
  settings_profile_id TEXT,
  scenario_json TEXT,                 -- custom scenario override, if any
  response_mode TEXT DEFAULT 'auto',  -- 'auto' | 'manual' (group chats)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT NOT NULL,                 -- 'user' | 'assistant' | 'system'
  character_id TEXT,                  -- which character spoke (group chats)
  content TEXT NOT NULL,              -- always mirrors variants[active_variant_index]
  variants_json TEXT,                 -- array of alternate texts (swipes/greetings); NULL = just one variant (content itself)
  active_variant_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
