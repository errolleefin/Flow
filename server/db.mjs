import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function initDatabase(dbPath = path.resolve('data/flow.sqlite')) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_bg TEXT NOT NULL,
      email TEXT DEFAULT '',
      capacity_hours INTEGER DEFAULT 40
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_key TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      project_id TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      assignee_id TEXT,
      collaborator_ids TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      estimate_hours REAL DEFAULT 4,
      logged_minutes INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      member_id TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      base_url TEXT DEFAULT 'https://api.openai.com/v1',
      api_key TEXT DEFAULT '',
      model TEXT DEFAULT 'gpt-4o-mini',
      temperature REAL DEFAULT 0.2,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      operations TEXT DEFAULT '[]',
      created_at TEXT NOT NULL
    );
  `);

  const aiRow = db.prepare('SELECT id FROM ai_settings WHERE id = 1').get();
  if (!aiRow) {
    db.prepare(
      'INSERT INTO ai_settings (id, base_url, api_key, model, temperature, updated_at) VALUES (1, ?, ?, ?, ?, ?)'
    ).run(
      'https://api.openai.com/v1',
      '',
      'gpt-4o-mini',
      0.2,
      new Date().toISOString()
    );
  }

  const msgCountRow = db
    .prepare('SELECT COUNT(*) as cnt FROM ai_messages')
    .get();
  if (!msgCountRow || msgCountRow.cnt === 0) {
    db.prepare(
      'INSERT INTO ai_messages (id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      'assistant',
      '你好！我是 **Flow AI 智能助理**。你可以先在右上角「接口配置」中永久保存你的 OpenAI 兼容 API（支持 OpenAI、DeepSeek、硅基流动、OpenRouter、阿里云百炼、本地 Ollama 等），然后直接用自然语言向我发送任务指令或粘贴会议纪要，我会自动为你提取 **任务名称、所属项目、截止日期、相关人员（主负责与协作人）、优先级与子任务清单** 并录入数据库！',
      '[]',
      new Date().toISOString()
    );
  }

  return db;
}

export function clearWorkspaceData(db) {
  db.exec(
    'DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members;'
  );
}

export function getFullTaskById(db, taskId) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!row) return null;
  const subtasks = db
    .prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC')
    .all(taskId)
    .map((s) => ({
      ...s,
      completed: Boolean(s.completed),
    }));
  const activities = db
    .prepare(
      'SELECT * FROM activities WHERE task_id = ? ORDER BY created_at DESC'
    )
    .all(taskId);

  return {
    ...row,
    collaborator_ids: JSON.parse(row.collaborator_ids || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    subtasks,
    activities,
  };
}

export function getBootstrapData(db) {
  const projects = db
    .prepare('SELECT * FROM projects ORDER BY created_at ASC')
    .all();
  const members = db.prepare('SELECT * FROM members ORDER BY rowid ASC').all();
  const taskRows = db
    .prepare('SELECT * FROM tasks ORDER BY position ASC, created_at DESC')
    .all();
  const allSubtasks = db
    .prepare('SELECT * FROM subtasks ORDER BY created_at ASC')
    .all();
  const allActivities = db
    .prepare('SELECT * FROM activities ORDER BY created_at DESC')
    .all();

  const subtasksByTask = new Map();
  for (const s of allSubtasks) {
    const list = subtasksByTask.get(s.task_id) || [];
    list.push({ ...s, completed: Boolean(s.completed) });
    subtasksByTask.set(s.task_id, list);
  }

  const activitiesByTask = new Map();
  for (const a of allActivities) {
    const list = activitiesByTask.get(a.task_id) || [];
    list.push(a);
    activitiesByTask.set(a.task_id, list);
  }

  const tasks = taskRows.map((row) => ({
    ...row,
    collaborator_ids: JSON.parse(row.collaborator_ids || '[]'),
    tags: JSON.parse(row.tags || '[]'),
    subtasks: subtasksByTask.get(row.id) || [],
    activities: activitiesByTask.get(row.id) || [],
  }));

  return { projects, members, tasks };
}
