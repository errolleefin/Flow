import crypto from 'node:crypto';
import { openStorage } from './storage.mjs';

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

export function canSeeProject(user, projectId) {
  const visible = user.permissions.visible_project_ids;
  return (
    visible === 'all' || (Array.isArray(visible) && visible.includes(projectId))
  );
}

// A user limited to specific projects must keep seeing the ones they create.
export async function grantProjectVisibility(db, user, projectId) {
  const visible = user.permissions.visible_project_ids;
  if (!Array.isArray(visible) || visible.includes(projectId)) return;
  const nextPerms = {
    ...user.permissions,
    visible_project_ids: [...visible, projectId],
  };
  await db.run(
    'UPDATE users SET permissions = ? WHERE id = ?',
    JSON.stringify(nextPerms),
    user.id
  );
  user.permissions = nextPerms;
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

export async function openDatabase({ dbPath, databaseUrl } = {}) {
  const db = await openStorage({ dbPath, databaseUrl });
  await initSqliteSchema(db);
  await seedDefaults(db);
  return db;
}

async function initSqliteSchema(db) {
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
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
      actor_name TEXT DEFAULT NULL,
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
      user_id TEXT DEFAULT NULL,
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
  const subCols = await db.all('PRAGMA table_info(subtasks)');
  if (!subCols.some((c) => c.name === 'completed_at')) {
    await db.exec('ALTER TABLE subtasks ADD COLUMN completed_at TEXT DEFAULT NULL;');
  }
  const projCols = await db.all('PRAGMA table_info(projects)');
  if (!projCols.some((c) => c.name === 'pinned')) {
    await db.exec('ALTER TABLE projects ADD COLUMN pinned INTEGER DEFAULT 0;');
  }
  const memCols = await db.all('PRAGMA table_info(members)');
  if (!memCols.some((c) => c.name === 'pinned')) {
    await db.exec('ALTER TABLE members ADD COLUMN pinned INTEGER DEFAULT 0;');
  }
  const actCols = await db.all('PRAGMA table_info(activities)');
  if (!actCols.some((c) => c.name === 'actor_name')) {
    await db.exec('ALTER TABLE activities ADD COLUMN actor_name TEXT DEFAULT NULL;');
  }
  const aiMsgCols = await db.all('PRAGMA table_info(ai_messages)');
  if (!aiMsgCols.some((c) => c.name === 'user_id')) {
    await db.exec('ALTER TABLE ai_messages ADD COLUMN user_id TEXT DEFAULT NULL;');
  }
}

async function seedDefaults(db) {
  const aiRow = await db.get('SELECT id FROM ai_settings WHERE id = 1');
  if (!aiRow) {
    await db.run(
      'INSERT INTO ai_settings (id, base_url, api_key, model, temperature, updated_at) VALUES (1, ?, ?, ?, ?, ?)',
      'https://api.openai.com/v1',
      '',
      'gpt-4o-mini',
      0.2,
      new Date().toISOString()
    );
  }
}

// JSON array columns can hold legacy junk such as "null"; treat it as empty.
export function parseJsonArray(raw) {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// One more than the highest number used by any task with this prefix, so keys
// never repeat after deletions, project moves or shared project codes.
// Call inside a transaction: on Postgres the lock serializes concurrent creators.
export async function nextTaskKey(db, code) {
  const prefix = `${code}-`;
  await db.lock(`task_key:${prefix}`);
  const rows = await db.all(
    'SELECT task_key FROM tasks WHERE substr(task_key, 1, ?) = ?',
    prefix.length,
    prefix
  );
  let max = 100;
  for (const { task_key: key } of rows) {
    const n = Number(key.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

// Shared by the REST API and the AI assistant so both clean up the same way.
export async function deleteMemberCascade(db, memberId) {
  await db.run(
    'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?',
    memberId
  );
  await db.run(
    'UPDATE users SET member_id = NULL WHERE member_id = ?',
    memberId
  );
  for (const t of await db.all('SELECT id, collaborator_ids FROM tasks')) {
    const list = parseJsonArray(t.collaborator_ids);
    if (list.includes(memberId)) {
      await db.run(
        'UPDATE tasks SET collaborator_ids = ? WHERE id = ?',
        JSON.stringify(list.filter((id) => id !== memberId)),
        t.id
      );
    }
  }
  for (const g of await db.all('SELECT id, member_ids FROM chat_groups')) {
    const list = parseJsonArray(g.member_ids);
    if (list.includes(memberId)) {
      await db.run(
        'UPDATE chat_groups SET member_ids = ? WHERE id = ?',
        JSON.stringify(list.filter((id) => id !== memberId)),
        g.id
      );
    }
  }
  await db.run('DELETE FROM members WHERE id = ?', memberId);
}

// Tasks (and their subtasks/activities) go with the project via ON DELETE CASCADE.
export async function deleteProjectCascade(db, projectId) {
  await db.run(
    'UPDATE chat_groups SET project_id = NULL WHERE project_id = ?',
    projectId
  );
  await db.run('DELETE FROM projects WHERE id = ?', projectId);
}

export async function clearWorkspaceData(db) {
  await db.exec(
    'DELETE FROM chat_group_messages; DELETE FROM chat_groups; DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members; UPDATE users SET member_id = NULL;'
  );
}

export async function getFullTaskById(db, taskId) {
  const row = await db.get('SELECT * FROM tasks WHERE id = ?', taskId);
  if (!row) return null;
  const subtasks = (
    await db.all(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC',
      taskId
    )
  ).map((s) => ({
    ...s,
    completed: Boolean(s.completed),
    completed_at: s.completed_at || null,
  }));
  const activities = await db.all(
    'SELECT * FROM activities WHERE task_id = ? ORDER BY created_at DESC',
    taskId
  );

  return {
    ...row,
    collaborator_ids: parseJsonArray(row.collaborator_ids),
    tags: parseJsonArray(row.tags),
    subtasks,
    activities,
  };
}

export async function getChatGroups(db, visibleProjectIds = 'all') {
  const groups = await db.all(
    'SELECT * FROM chat_groups ORDER BY created_at ASC'
  );
  const msgStats = await db.all(
    'SELECT group_id, COUNT(*) as cnt, MAX(created_at) as last_at FROM chat_group_messages GROUP BY group_id'
  );
  const statMap = new Map(msgStats.map((s) => [s.group_id, s]));

  const latestMsgRows = await db.all(
    `SELECT m.id, m.group_id, m.sender_member_id, m.sender_name, m.content, m.created_at
     FROM chat_group_messages m
     INNER JOIN (
       SELECT group_id, MAX(created_at) AS max_at
       FROM chat_group_messages
       GROUP BY group_id
     ) latest ON m.group_id = latest.group_id AND m.created_at = latest.max_at`
  );
  const latestMsgMap = new Map(latestMsgRows.map((r) => [r.group_id, r]));

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
      const lastMsg = latestMsgMap.get(g.id);
      return {
        ...g,
        project_id: g.project_id || null,
        member_ids: parseJsonArray(g.member_ids),
        message_count: st ? Number(st.cnt) : 0,
        last_message_at: st ? st.last_at : null,
        last_message_id: lastMsg ? lastMsg.id : null,
        last_message_sender_member_id: lastMsg
          ? lastMsg.sender_member_id || null
          : null,
        last_message_sender: lastMsg ? lastMsg.sender_name : null,
        last_message_content: lastMsg ? lastMsg.content : null,
      };
    });
}

export async function getBootstrapData(db, visibleProjectIds = 'all') {
  const allProjects = (
    await db.all('SELECT * FROM projects ORDER BY pinned DESC, created_at ASC')
  ).map((p) => ({
    ...p,
    pinned: Boolean(p.pinned),
  }));
  const projects =
    visibleProjectIds === 'all' || !Array.isArray(visibleProjectIds)
      ? allProjects
      : allProjects.filter((p) => visibleProjectIds.includes(p.id));

  const allowedProjSet = new Set(projects.map((p) => p.id));

  const members = (
    await db.all('SELECT * FROM members ORDER BY pinned DESC, rowid ASC')
  ).map((m) => ({
    ...m,
    pinned: Boolean(m.pinned),
  }));
  const taskRows = (
    await db.all('SELECT * FROM tasks ORDER BY position ASC, created_at DESC')
  ).filter((t) =>
    visibleProjectIds === 'all' || !Array.isArray(visibleProjectIds)
      ? true
      : allowedProjSet.has(t.project_id)
  );

  const allSubtasks = await db.all(
    'SELECT * FROM subtasks ORDER BY created_at ASC'
  );
  const allActivities = await db.all(
    'SELECT * FROM activities ORDER BY created_at DESC'
  );

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
    collaborator_ids: parseJsonArray(row.collaborator_ids),
    tags: parseJsonArray(row.tags),
    subtasks: subtasksByTask.get(row.id) || [],
    activities: activitiesByTask.get(row.id) || [],
  }));

  const chatGroups = await getChatGroups(db, visibleProjectIds);

  return { projects, members, tasks, chatGroups };
}
