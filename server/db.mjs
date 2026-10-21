import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    visible_project_ids: 'all',
    can_create_project: true,
    can_edit_project: true,
    can_delete_project: true,
    can_create_task: true,
    can_edit_task: true,
    can_delete_task: true,
    can_manage_members: true,
    can_manage_accounts: true,
  },
  boss: {
    visible_project_ids: 'all',
    can_create_project: true,
    can_edit_project: true,
    can_delete_project: true,
    can_create_task: true,
    can_edit_task: true,
    can_delete_task: true,
    can_manage_members: true,
    can_manage_accounts: false,
  },
  director: {
    visible_project_ids: 'all',
    can_create_project: true,
    can_edit_project: true,
    can_delete_project: false,
    can_create_task: true,
    can_edit_task: true,
    can_delete_task: true,
    can_manage_members: true,
    can_manage_accounts: false,
  },
  lead: {
    visible_project_ids: 'all',
    can_create_project: false,
    can_edit_project: true,
    can_delete_project: false,
    can_create_task: true,
    can_edit_task: true,
    can_delete_task: false,
    can_manage_members: false,
    can_manage_accounts: false,
  },
  member: {
    visible_project_ids: 'all',
    can_create_project: false,
    can_edit_project: false,
    can_delete_project: false,
    can_create_task: true,
    can_edit_task: true,
    can_delete_task: false,
    can_manage_members: false,
    can_manage_accounts: false,
  },
};

export function getDefaultPermissionsForRole(role = 'member') {
  const base = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.member;
  return { ...base };
}

export function normalizePermissions(role, customPerms) {
  const defaults = getDefaultPermissionsForRole(role);
  if (!customPerms || typeof customPerms !== 'object') {
    return defaults;
  }
  const visible =
    customPerms.visible_project_ids === 'all' ||
    Array.isArray(customPerms.visible_project_ids)
      ? customPerms.visible_project_ids
      : defaults.visible_project_ids;

  return {
    visible_project_ids: role === 'admin' ? 'all' : visible,
    can_create_project:
      role === 'admin'
        ? true
        : customPerms.can_create_project !== undefined
        ? Boolean(customPerms.can_create_project)
        : defaults.can_create_project,
    can_edit_project:
      role === 'admin'
        ? true
        : customPerms.can_edit_project !== undefined
        ? Boolean(customPerms.can_edit_project)
        : defaults.can_edit_project,
    can_delete_project:
      role === 'admin'
        ? true
        : customPerms.can_delete_project !== undefined
        ? Boolean(customPerms.can_delete_project)
        : defaults.can_delete_project,
    can_create_task:
      role === 'admin'
        ? true
        : customPerms.can_create_task !== undefined
        ? Boolean(customPerms.can_create_task)
        : defaults.can_create_task,
    can_edit_task:
      role === 'admin'
        ? true
        : customPerms.can_edit_task !== undefined
        ? Boolean(customPerms.can_edit_task)
        : defaults.can_edit_task,
    can_delete_task:
      role === 'admin'
        ? true
        : customPerms.can_delete_task !== undefined
        ? Boolean(customPerms.can_delete_task)
        : defaults.can_delete_task,
    can_manage_members:
      role === 'admin'
        ? true
        : customPerms.can_manage_members !== undefined
        ? Boolean(customPerms.can_manage_members)
        : defaults.can_manage_members,
    can_manage_accounts:
      role === 'admin'
        ? true
        : customPerms.can_manage_accounts !== undefined
        ? Boolean(customPerms.can_manage_accounts)
        : defaults.can_manage_accounts,
  };
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(key, 'hex'),
    Buffer.from(derived, 'hex')
  );
}

export function serializeUser(row) {
  if (!row) return null;
  let parsedPerms;
  try {
    parsedPerms = JSON.parse(row.permissions || '{}');
  } catch {
    parsedPerms = {};
  }
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    role: row.role,
    member_id: row.member_id || null,
    permissions: normalizePermissions(row.role, parsedPerms),
    created_at: row.created_at,
  };
}

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
      pinned INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar_bg TEXT NOT NULL,
      email TEXT DEFAULT '',
      capacity_hours INTEGER DEFAULT 40,
      pinned INTEGER DEFAULT 0
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
      completed_at TEXT DEFAULT NULL,
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

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      member_id TEXT DEFAULT NULL,
      permissions TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      project_id TEXT DEFAULT NULL,
      member_ids TEXT DEFAULT '[]',
      created_by TEXT DEFAULT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      sender_user_id TEXT DEFAULT NULL,
      sender_member_id TEXT DEFAULT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT DEFAULT '',
      avatar_bg TEXT DEFAULT 'from-indigo-500 to-purple-600',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE
    );
  `);

  // Safe migration for existing databases missing subtasks.completed_at or pinned columns
  const subCols = db.prepare('PRAGMA table_info(subtasks)').all();
  if (!subCols.some((c) => c.name === 'completed_at')) {
    db.exec('ALTER TABLE subtasks ADD COLUMN completed_at TEXT DEFAULT NULL;');
  }
  const projCols = db.prepare('PRAGMA table_info(projects)').all();
  if (!projCols.some((c) => c.name === 'pinned')) {
    db.exec('ALTER TABLE projects ADD COLUMN pinned INTEGER DEFAULT 0;');
  }
  const memCols = db.prepare('PRAGMA table_info(members)').all();
  if (!memCols.some((c) => c.name === 'pinned')) {
    db.exec('ALTER TABLE members ADD COLUMN pinned INTEGER DEFAULT 0;');
  }

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
    'DELETE FROM chat_group_messages; DELETE FROM chat_groups; DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members; UPDATE users SET member_id = NULL;'
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
      completed_at: s.completed_at || null,
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

export function getChatGroups(db, visibleProjectIds = 'all') {
  const groups = db
    .prepare('SELECT * FROM chat_groups ORDER BY created_at ASC')
    .all();
  const msgStats = db
    .prepare(
      'SELECT group_id, COUNT(*) as cnt, MAX(created_at) as last_at FROM chat_group_messages GROUP BY group_id'
    )
    .all();
  const statMap = new Map(msgStats.map((s) => [s.group_id, s]));

  return groups
    .filter((g) => {
      if (visibleProjectIds === 'all' || !Array.isArray(visibleProjectIds)) {
        return true;
      }
      if (!g.project_id) return true;
      return visibleProjectIds.includes(g.project_id);
    })
    .map((g) => {
      const st = statMap.get(g.id);
      return {
        ...g,
        project_id: g.project_id || null,
        member_ids: JSON.parse(g.member_ids || '[]'),
        message_count: st ? Number(st.cnt) : 0,
        last_message_at: st ? st.last_at : null,
      };
    });
}

export function getBootstrapData(db, visibleProjectIds = 'all') {
  const allProjects = db
    .prepare('SELECT * FROM projects ORDER BY pinned DESC, created_at ASC')
    .all()
    .map((p) => ({
      ...p,
      pinned: Boolean(p.pinned),
    }));
  const projects =
    visibleProjectIds === 'all' || !Array.isArray(visibleProjectIds)
      ? allProjects
      : allProjects.filter((p) => visibleProjectIds.includes(p.id));

  const allowedProjSet = new Set(projects.map((p) => p.id));

  const members = db
    .prepare('SELECT * FROM members ORDER BY pinned DESC, rowid ASC')
    .all()
    .map((m) => ({
      ...m,
      pinned: Boolean(m.pinned),
    }));
  const taskRows = db
    .prepare('SELECT * FROM tasks ORDER BY position ASC, created_at DESC')
    .all()
    .filter((t) =>
      visibleProjectIds === 'all' || !Array.isArray(visibleProjectIds)
        ? true
        : allowedProjSet.has(t.project_id)
    );

  const allSubtasks = db
    .prepare('SELECT * FROM subtasks ORDER BY created_at ASC')
    .all();
  const allActivities = db
    .prepare('SELECT * FROM activities ORDER BY created_at DESC')
    .all();

  const subtasksByTask = new Map();
  for (const s of allSubtasks) {
    const list = subtasksByTask.get(s.task_id) || [];
    list.push({
      ...s,
      completed: Boolean(s.completed),
      completed_at: s.completed_at || null,
    });
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

  const chatGroups = getChatGroups(db, visibleProjectIds);

  return { projects, members, tasks, chatGroups };
}
