-- ============================================================================
-- Flow — Supabase (PostgreSQL) Database Schema Migration Script
-- Run this in your Supabase SQL Editor when deploying with Vercel + Supabase
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '团队成员',
  avatar_bg TEXT NOT NULL DEFAULT 'from-indigo-500 to-purple-600',
  email TEXT DEFAULT '',
  capacity_hours INTEGER NOT NULL DEFAULT 40
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  assignee_id TEXT,
  collaborator_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimate_hours NUMERIC NOT NULL DEFAULT 4,
  logged_minutes INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  member_id TEXT,
  type TEXT NOT NULL DEFAULT 'system',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
  api_key TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  temperature NUMERIC NOT NULL DEFAULT 0.2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_settings (id, base_url, api_key, model, temperature)
VALUES (1, 'https://api.openai.com/v1', '', 'gpt-4o-mini', 0.2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
