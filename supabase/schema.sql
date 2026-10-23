-- Flow Workspace — Supabase / PostgreSQL schema
-- Flow applies this automatically on startup when DATABASE_URL is set; you can
-- also run it once in the Supabase SQL Editor. Safe to re-run.
-- Source of truth: server/pgSchema.mjs (kept in sync by tests/schema.test.mjs).

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '团队成员',
  avatar_bg TEXT NOT NULL DEFAULT 'from-indigo-500 to-purple-600',
  email TEXT DEFAULT '',
  capacity_hours INTEGER NOT NULL DEFAULT 40,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  assignee_id TEXT,
  collaborator_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimate_hours NUMERIC(6,2) NOT NULL DEFAULT 4,
  logged_minutes INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  member_id TEXT,
  actor_name TEXT DEFAULT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_settings (id, base_url, api_key, model, temperature, updated_at)
VALUES (1, 'https://api.openai.com/v1', '', 'gpt-4o-mini', 0.2, NOW())
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  member_id TEXT DEFAULT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id TEXT DEFAULT NULL,
  member_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_user_id TEXT DEFAULT NULL,
  sender_member_id TEXT DEFAULT NULL,
  sender_name TEXT NOT NULL,
  sender_role TEXT DEFAULT '',
  avatar_bg TEXT DEFAULT 'from-indigo-500 to-purple-600',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns added after the first schema release
ALTER TABLE members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();
ALTER TABLE activities ADD COLUMN IF NOT EXISTS actor_name TEXT DEFAULT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_activities_task_id ON activities(task_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_group_messages(group_id);

-- Flow connects as the table owner, which bypasses row level security.
-- Enabling RLS without policies keeps Supabase's Data API (anon /
-- authenticated keys) from reading these tables, which hold password
-- hashes, session tokens and the AI API key.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_messages ENABLE ROW LEVEL SECURITY;
