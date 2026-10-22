import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  openDatabase,
  clearWorkspaceData,
  getBootstrapData,
  getFullTaskById,
  getChatGroups,
  hashPassword,
  verifyPassword,
  serializeUser,
  normalizePermissions,
  canSeeProject,
  grantProjectVisibility,
  nextTaskKey,
  deleteMemberCascade,
  deleteProjectCascade,
  DEFAULT_ROLE_PERMISSIONS,
} from './db.mjs';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  isIsoDate,
  isHexColor,
  isStringArray,
  isNonNegativeNumber,
} from './validation.mjs';
import {
  getAiSettings,
  updateAiSettings,
  getAiMessages,
  clearAiMessages,
  processAiChat,
  fetchOpenAIModels,
  normalizeOpenAIEndpoint,
} from './aiService.mjs';

const STATUS_LABELS = {
  backlog: '待规划',
  todo: '待处理',
  in_progress: '进行中',
  review: '审核/阻塞',
  done: '已完成',
};

const PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高优',
  medium: '普通',
  low: '较低',
};

const ROLE_LABELS = {
  admin: '管理员',
  boss: '老板',
  director: '项目主管',
  lead: '组长',
  member: '成员',
};

// Routes reachable without a session; everything else under /api needs one.
const PUBLIC_API_ROUTES = new Set([
  'GET /api/auth/status',
  'POST /api/auth/setup',
  'POST /api/auth/login',
  'POST /api/auth/logout',
]);

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const MIN_PASSWORD_LENGTH = 4;
const ACCOUNT_ROLES = Object.keys(DEFAULT_ROLE_PERMISSIONS);

function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

// Returns an error message for the first invalid task field that is present.
function validateTaskFields(fields) {
  if (fields.status !== undefined && !TASK_STATUSES.includes(fields.status)) {
    return '无效的任务状态';
  }
  if (
    fields.priority !== undefined &&
    !TASK_PRIORITIES.includes(fields.priority)
  ) {
    return '无效的优先级';
  }
  if (
    fields.due_date !== undefined &&
    fields.due_date !== null &&
    fields.due_date !== '' &&
    !isIsoDate(fields.due_date)
  ) {
    return '截止日期格式应为 YYYY-MM-DD';
  }
  for (const key of ['collaborator_ids', 'tags']) {
    if (fields[key] !== undefined && !isStringArray(fields[key])) {
      return `${key} 必须是字符串数组`;
    }
  }
  for (const key of ['estimate_hours', 'logged_minutes', 'position']) {
    if (fields[key] !== undefined && !isNonNegativeNumber(fields[key])) {
      return `${key} 必须是非负数字`;
    }
  }
  return null;
}

// Checks a JSON backup before anything is deleted; returns the first problem.
function validateBackup({ projects, members, tasks }) {
  if (
    !Array.isArray(projects) ||
    !Array.isArray(members) ||
    !Array.isArray(tasks)
  ) {
    return '缺少 projects / members / tasks 数组';
  }
  const isText = (v) => typeof v === 'string' && v.trim() !== '';
  const projectIds = new Set();
  for (const [i, p] of projects.entries()) {
    if (!p || !isText(p.id) || !isText(p.name) || !isText(p.code)) {
      return `第 ${i + 1} 个项目缺少 id、名称或编号前缀`;
    }
    if (!isHexColor(p.color)) return `项目「${p.name}」的颜色格式无效`;
    if (projectIds.has(p.id)) return `项目 ID 重复：${p.id}`;
    projectIds.add(p.id);
  }
  const memberIds = new Set();
  for (const [i, m] of members.entries()) {
    if (!m || !isText(m.id) || !isText(m.name)) {
      return `第 ${i + 1} 个成员缺少 id 或姓名`;
    }
    if (memberIds.has(m.id)) return `成员 ID 重复：${m.id}`;
    memberIds.add(m.id);
  }
  const taskIds = new Set();
  for (const [i, t] of tasks.entries()) {
    if (!t || !isText(t.id) || !isText(t.task_key) || !isText(t.title)) {
      return `第 ${i + 1} 个任务缺少 id、编号或名称`;
    }
    if (!projectIds.has(t.project_id)) {
      return `任务「${t.title}」所属的项目不在备份中`;
    }
    if (taskIds.has(t.id)) return `任务 ID 重复：${t.id}`;
    taskIds.add(t.id);
    const invalid = validateTaskFields({
      status: t.status ?? undefined,
      priority: t.priority ?? undefined,
      due_date: t.due_date ?? undefined,
      collaborator_ids: t.collaborator_ids ?? undefined,
      tags: t.tags ?? undefined,
      estimate_hours: t.estimate_hours ?? undefined,
      logged_minutes: t.logged_minutes ?? undefined,
      position: t.position ?? undefined,
    });
    if (invalid) return `任务「${t.title}」：${invalid}`;
    const subtasks = t.subtasks ?? [];
    if (!Array.isArray(subtasks) || subtasks.some((s) => !s || !isText(s.title))) {
      return `任务「${t.title}」包含无效的子任务`;
    }
    const activities = t.activities ?? [];
    if (
      !Array.isArray(activities) ||
      activities.some((a) => !a || typeof a.content !== 'string')
    ) {
      return `任务「${t.title}」包含无效的动态记录`;
    }
  }
  return null;
}

// Never send the stored API key back to the browser.
function toPublicAiSettings(settings) {
  return {
    ...settings,
    api_key: '',
    has_api_key: Boolean(settings.api_key),
    api_key_masked: maskApiKey(settings.api_key),
  };
}

export function createApp(options = {}) {
  const {
    dbPath = path.resolve('data/flow.sqlite'),
    databaseUrl = undefined,
  } = typeof options === 'string' ? { dbPath: options } : options;
  // Assigned once the storage backend is ready; every /api route awaits it first.
  let db = null;
  const ready = openDatabase({ dbPath, databaseUrl }).then((opened) => {
    db = opened;
    return opened;
  });
  ready.catch(() => {});
  const sessionTtlMs =
    (Number(process.env.FLOW_SESSION_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;
  const app = express();

  // Same-origin by default (Vite proxies /api in dev); opt in for other origins.
  const corsOrigins = (process.env.FLOW_CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.use(cors({ origin: corsOrigins }));
  }
  app.use(express.json({ limit: '5mb' }));
  app.use('/api', async (_req, res, next) => {
    try {
      await ready;
      next();
    } catch (err) {
      res
        .status(503)
        .json({ error: `数据库初始化失败：${String(err.message || err)}` });
    }
  });

  const getBearerToken = (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7).trim() || null;
  };

  const getCurrentUser = async (req) => {
    const token = getBearerToken(req);
    if (!token) return null;
    const session = await db.get(
      'SELECT user_id, created_at FROM sessions WHERE token = ?',
      token
    );
    if (!session) return null;
    if (Date.now() - Date.parse(session.created_at) > sessionTtlMs) {
      await db.run('DELETE FROM sessions WHERE token = ?', token);
      return null;
    }
    const userRow = await db.get(
      'SELECT * FROM users WHERE id = ?',
      session.user_id
    );
    return serializeUser(userRow);
  };

  app.use('/api', async (req, res, next) => {
    try {
      req.user = await getCurrentUser(req);
      req.authToken = req.user ? getBearerToken(req) : null;
      const route = `${req.method} ${req.baseUrl}${req.path}`;
      if (req.user || PUBLIC_API_ROUTES.has(route)) {
        return next();
      }
      return res.status(401).json({ error: '请先登录' });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  const forbid = (res, message = '当前账号无此操作权限') =>
    res.status(403).json({ error: message });
  const requirePerm = (perm) => (req, res, next) =>
    req.user.permissions[perm] ? next() : forbid(res);
  const requireAdmin = (req, res, next) =>
    req.user.role === 'admin'
      ? next()
      : forbid(res, '仅超级管理员可执行此操作');

  const getVisibleTask = async (user, taskId) => {
    const task = await db.get('SELECT * FROM tasks WHERE id = ?', taskId);
    return task && canSeeProject(user, task.project_id) ? task : null;
  };

  const getVisibleSubtask = async (user, subId) => {
    const sub = await db.get('SELECT * FROM subtasks WHERE id = ?', subId);
    return sub && (await getVisibleTask(user, sub.task_id)) ? sub : null;
  };

  const getVisibleChatGroup = async (user, groupId) => {
    const group = await db.get(
      'SELECT * FROM chat_groups WHERE id = ?',
      groupId
    );
    if (!group) return null;
    return !group.project_id || canSeeProject(user, group.project_id)
      ? group
      : null;
  };

  const canManageChatGroup = (user, group) =>
    group.created_by === user.id || user.permissions.can_manage_members;

  // Activities record who actually made the change (not the assignee).
  const insertActivity = async (
    conn,
    taskId,
    user,
    type,
    content,
    createdAt
  ) => {
    const id = crypto.randomUUID();
    await conn.run(
      'INSERT INTO activities (id, task_id, member_id, actor_name, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      taskId,
      user?.member_id || null,
      user?.display_name || null,
      type,
      content,
      createdAt
    );
    return id;
  };

  // In-memory brute-force guard, keyed by client IP + username.
  const loginFailures = new Map();
  const dummyPasswordHash = hashPassword(
    crypto.randomBytes(16).toString('hex')
  );
  const isLoginBlocked = (key) => {
    const entry = loginFailures.get(key);
    if (!entry) return false;
    if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
      loginFailures.delete(key);
      return false;
    }
    return entry.count >= LOGIN_MAX_FAILURES;
  };
  const recordLoginFailure = (key) => {
    const now = Date.now();
    if (loginFailures.size > 10000) {
      for (const [k, v] of loginFailures) {
        if (now - v.first > LOGIN_WINDOW_MS) loginFailures.delete(k);
      }
    }
    const entry = loginFailures.get(key);
    if (!entry || now - entry.first > LOGIN_WINDOW_MS) {
      loginFailures.set(key, { count: 1, first: now });
    } else {
      entry.count += 1;
    }
  };

  // ==========================================
  // 0. Authentication & Account Management API
  // ==========================================
  app.get('/api/auth/status', async (req, res) => {
    try {
      const cntRow = await db.get('SELECT COUNT(*) as cnt FROM users');
      const initialized = Number(cntRow?.cnt || 0) > 0;
      const currentUser = req.user;
      return res.json({ initialized, currentUser, user: currentUser });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // First-time deployment Super Admin setup
  app.post('/api/auth/setup', async (req, res) => {
    try {
      const cntRow = await db.get('SELECT COUNT(*) as cnt FROM users');
      if (Number(cntRow?.cnt || 0) > 0) {
        return res
          .status(400)
          .json({ error: '系统已完成初始化设置，请直接登录' });
      }

      const {
        username,
        display_name,
        password,
        bind_member_name,
        create_member = true,
      } = req.body || {};

      if (!username || !String(username).trim()) {
        return res.status(400).json({ error: '管理员登录账号不能为空' });
      }
      if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: '登录密码不能少于 4 位' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const cleanDisplay =
        display_name && String(display_name).trim()
          ? String(display_name).trim()
          : String(username).trim();
      const nowISO = new Date().toISOString();
      const passwordHash = hashPassword(password);

      // Re-check inside a locked transaction so two concurrent setups cannot both win.
      const created = await db.transaction(async (tx) => {
        await tx.lock('flow:setup');
        const existingUsers = await tx.get('SELECT COUNT(*) as cnt FROM users');
        if (Number(existingUsers?.cnt || 0) > 0) return null;

        let boundMemberId = null;
        if (create_member || bind_member_name) {
          const lookupName =
            bind_member_name && String(bind_member_name).trim()
              ? String(bind_member_name).trim()
              : cleanDisplay;
          const existingMem = await tx.get(
            'SELECT id FROM members WHERE LOWER(name) = LOWER(?)',
            lookupName
          );
          if (existingMem) {
            boundMemberId = existingMem.id;
          } else if (create_member) {
            boundMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
            await tx.run(
              'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)',
              boundMemberId,
              lookupName,
              '超级管理员',
              'from-indigo-500 to-purple-600',
              '',
              40
            );
          }
        }

        const newUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;
        const perms = normalizePermissions('admin', {});
        await tx.run(
          'INSERT INTO users (id, username, display_name, password_hash, role, member_id, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          newUserId,
          cleanUsername,
          cleanDisplay,
          passwordHash,
          'admin',
          boundMemberId,
          JSON.stringify(perms),
          nowISO
        );

        const newToken = crypto.randomBytes(32).toString('hex');
        await tx.run(
          'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
          newToken,
          newUserId,
          nowISO
        );
        return { userId: newUserId, token: newToken };
      });
      if (!created) {
        return res
          .status(400)
          .json({ error: '系统已完成初始化设置，请直接登录' });
      }
      const { userId, token } = created;

      const userRow = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      return res.status(201).json({
        token,
        user: serializeUser(userRow),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: '请输入账号和密码' });
      }
      const cleanUsername = String(username).trim().toLowerCase();
      const limiterKey = `${req.ip}|${cleanUsername}`;
      if (isLoginBlocked(limiterKey)) {
        return res
          .status(429)
          .json({ error: '登录失败次数过多，请 15 分钟后再试' });
      }
      const userRow = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = ?',
        cleanUsername
      );
      // Hash even for unknown usernames so response time does not reveal them.
      const passwordOk = verifyPassword(
        password,
        userRow ? userRow.password_hash : dummyPasswordHash
      );
      if (!userRow || !passwordOk) {
        recordLoginFailure(limiterKey);
        return res.status(401).json({ error: '账号或密码错误' });
      }
      loginFailures.delete(limiterKey);

      const token = crypto.randomBytes(32).toString('hex');
      const nowISO = new Date().toISOString();
      await db.run(
        'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
        token,
        userRow.id,
        nowISO
      );

      return res.json({
        token,
        user: serializeUser(userRow),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      const token = getBearerToken(req);
      if (token) {
        await db.run('DELETE FROM sessions WHERE token = ?', token);
      }
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // List all user accounts
  app.get('/api/users', requirePerm('can_manage_accounts'), async (_req, res) => {
    try {
      const rows = await db.all(
        'SELECT * FROM users ORDER BY created_at ASC'
      );
      return res.json({ users: rows.map(serializeUser) });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Create user account (Admin)
  app.post('/api/users', requirePerm('can_manage_accounts'), async (req, res) => {
    try {
      const {
        username,
        display_name,
        password,
        role = 'member',
        member_id = null,
        auto_create_member = false,
        permissions = {},
      } = req.body || {};

      if (!username || !String(username).trim()) {
        return res.status(400).json({ error: '登录账号不能为空' });
      }
      if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: '密码长度不能少于 4 位' });
      }
      if (!ACCOUNT_ROLES.includes(role)) {
        return res.status(400).json({ error: '无效的账号角色' });
      }
      const normalizedPerms = normalizePermissions(role, permissions);
      if (req.user.role !== 'admin') {
        if (role === 'admin') {
          return forbid(res, '仅超级管理员可创建管理员账号');
        }
        if (normalizedPerms.can_manage_accounts) {
          return forbid(res, '仅超级管理员可授予账号管理权限');
        }
      }
      if (
        member_id &&
        !(await db.get('SELECT id FROM members WHERE id = ?', member_id))
      ) {
        return res.status(400).json({ error: '绑定的人员不存在' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const dup = await db.get(
        'SELECT id FROM users WHERE LOWER(username) = ?',
        cleanUsername
      );
      if (dup) {
        return res.status(400).json({ error: '该登录账号已存在' });
      }

      const cleanDisplay =
        display_name && String(display_name).trim()
          ? String(display_name).trim()
          : String(username).trim();

      let resolvedMemberId = member_id || null;
      if (!resolvedMemberId && auto_create_member) {
        const existingMem = await db.get(
          'SELECT id FROM members WHERE LOWER(name) = LOWER(?)',
          cleanDisplay
        );
        if (existingMem) {
          resolvedMemberId = existingMem.id;
        } else {
          resolvedMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
          await db.run(
            'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)',
            resolvedMemberId,
            cleanDisplay,
            ROLE_LABELS[role] || '团队成员',
            'from-indigo-500 to-purple-600',
            '',
            40
          );
        }
      }

      const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.run(
        'INSERT INTO users (id, username, display_name, password_hash, role, member_id, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        userId,
        cleanUsername,
        cleanDisplay,
        hashPassword(password),
        role,
        resolvedMemberId,
        JSON.stringify(normalizedPerms),
        nowISO
      );

      const createdRow = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      return res.status(201).json(serializeUser(createdRow));
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Update user account (Admin)
  app.patch('/api/users/:id', requirePerm('can_manage_accounts'), async (req, res) => {
    try {
      const userId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该账号' });
      }
      const actorIsAdmin = req.user.role === 'admin';
      const isSelf = existing.id === req.user.id;
      if (existing.role === 'admin' && !actorIsAdmin) {
        return forbid(res, '仅超级管理员可修改管理员账号');
      }

      const updates = req.body || {};
      const nextUsername =
        updates.username !== undefined
          ? String(updates.username).trim().toLowerCase()
          : existing.username;
      if (!nextUsername) {
        return res.status(400).json({ error: '登录账号不能为空' });
      }
      if (nextUsername !== existing.username) {
        const dup = await db.get(
          'SELECT id FROM users WHERE LOWER(username) = ? AND id <> ?',
          nextUsername,
          userId
        );
        if (dup) {
          return res.status(400).json({ error: '该登录账号已存在' });
        }
      }
      const nextDisplay =
        updates.display_name !== undefined
          ? String(updates.display_name).trim()
          : existing.display_name;
      const nextRole =
        updates.role !== undefined ? updates.role : existing.role;
      if (!ACCOUNT_ROLES.includes(nextRole)) {
        return res.status(400).json({ error: '无效的账号角色' });
      }
      if (nextRole === 'admin' && !actorIsAdmin) {
        return forbid(res, '仅超级管理员可授予管理员角色');
      }
      if (isSelf && nextRole !== existing.role) {
        return forbid(res, '不能修改自己的角色');
      }
      const nextMemberId =
        updates.member_id !== undefined
          ? updates.member_id || null
          : existing.member_id;
      if (
        nextMemberId &&
        nextMemberId !== existing.member_id &&
        !(await db.get('SELECT id FROM members WHERE id = ?', nextMemberId))
      ) {
        return res.status(400).json({ error: '绑定的人员不存在' });
      }

      // An empty or missing password keeps the current one; never trim it,
      // so it matches exactly what the user types at login.
      let nextPasswordHash = existing.password_hash;
      const passwordChanged =
        updates.password !== undefined &&
        updates.password !== null &&
        updates.password !== '';
      if (passwordChanged) {
        if (String(updates.password).length < MIN_PASSWORD_LENGTH) {
          return res.status(400).json({ error: '密码长度不能少于 4 位' });
        }
        nextPasswordHash = hashPassword(String(updates.password));
      }

      let existingPerms = {};
      try {
        existingPerms = JSON.parse(existing.permissions || '{}');
      } catch {
        existingPerms = {};
      }
      const currentPerms = normalizePermissions(existing.role, existingPerms);
      const nextPerms = normalizePermissions(
        nextRole,
        updates.permissions !== undefined ? updates.permissions : existingPerms
      );
      if (!actorIsAdmin) {
        if (nextPerms.can_manage_accounts && !currentPerms.can_manage_accounts) {
          return forbid(res, '仅超级管理员可授予账号管理权限');
        }
        if (isSelf && JSON.stringify(nextPerms) !== JSON.stringify(currentPerms)) {
          return forbid(res, '不能修改自己的权限');
        }
      }

      // Ensure at least one admin remains if downgrading role
      if (existing.role === 'admin' && nextRole !== 'admin') {
        const adminCnt = await db.get(
          "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'"
        );
        if (Number(adminCnt?.cnt || 0) <= 1) {
          return res
            .status(400)
            .json({ error: '系统至少需要保留一个超级管理员账号' });
        }
      }

      await db.run(
        'UPDATE users SET username = ?, display_name = ?, password_hash = ?, role = ?, member_id = ?, permissions = ? WHERE id = ?',
        nextUsername,
        nextDisplay || nextUsername,
        nextPasswordHash,
        nextRole,
        nextMemberId,
        JSON.stringify(nextPerms),
        userId
      );
      if (passwordChanged) {
        // Sign the account out everywhere except the session making this change.
        await db.run(
          'DELETE FROM sessions WHERE user_id = ? AND token <> ?',
          userId,
          req.authToken || ''
        );
      }

      const updatedRow = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      return res.json(serializeUser(updatedRow));
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Delete user account (Admin)
  app.delete('/api/users/:id', requirePerm('can_manage_accounts'), async (req, res) => {
    try {
      const userId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该账号' });
      }
      if (existing.role === 'admin' && req.user.role !== 'admin') {
        return forbid(res, '仅超级管理员可删除管理员账号');
      }
      if (existing.role === 'admin') {
        const adminCnt = await db.get(
          "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'"
        );
        if (Number(adminCnt?.cnt || 0) <= 1) {
          return res
            .status(400)
            .json({ error: '不能删除系统唯一的超级管理员账号' });
        }
      }
      await db.run('DELETE FROM users WHERE id = ?', userId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // ==========================================
  // 1. Bootstrap all state (filtered by user project visibility)
  // ==========================================
  app.get('/api/bootstrap', async (req, res) => {
    try {
      const payload = await getBootstrapData(
        db,
        req.user.permissions.visible_project_ids
      );
      res.json({ ...payload, currentUser: req.user });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 2. Create a new task
  app.post('/api/tasks', requirePerm('can_create_task'), async (req, res) => {
    try {
      const {
        title,
        description = '',
        project_id,
        status = 'todo',
        priority = 'medium',
        due_date = null,
        assignee_id = null,
        collaborator_ids = [],
        tags = [],
        estimate_hours = 4,
        subtasks = [],
      } = req.body || {};

      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: '任务名称不能为空' });
      }
      const invalid = validateTaskFields({
        status,
        priority,
        due_date,
        collaborator_ids,
        tags,
        estimate_hours,
      });
      if (invalid) {
        return res.status(400).json({ error: invalid });
      }
      if (
        assignee_id &&
        !(await db.get('SELECT id FROM members WHERE id = ?', assignee_id))
      ) {
        return res.status(400).json({ error: '负责人不存在' });
      }

      let project = project_id
        ? await db.get('SELECT * FROM projects WHERE id = ?', project_id)
        : null;
      if (project && !canSeeProject(req.user, project.id)) {
        return res.status(404).json({ error: '未找到该项目' });
      }
      if (!project) {
        project =
          (await db.all('SELECT * FROM projects ORDER BY created_at ASC')).find(
            (p) => canSeeProject(req.user, p.id)
          ) || null;
      }
      if (!project && !req.user.permissions.can_create_project) {
        return res
          .status(400)
          .json({ error: '当前没有可用的项目，请联系管理员创建项目' });
      }

      const id = `task-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.transaction(async (tx) => {
        if (!project) {
          const newProjId = `proj-${crypto.randomUUID().slice(0, 8)}`;
          const projName = req.body.project_name
            ? String(req.body.project_name).trim()
            : '默认工作项目';
          const projCode =
            projName
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 3)
              .toUpperCase() || 'FLW';
          await tx.run(
            'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            newProjId,
            projName,
            projCode,
            '#6366f1',
            '自动创建的初始工作项目',
            nowISO
          );
          await grantProjectVisibility(tx, req.user, newProjId);
          project = await tx.get('SELECT * FROM projects WHERE id = ?', newProjId);
        }

        const taskKey = await nextTaskKey(tx, project.code);
        const maxPosRow = await tx.get(
          'SELECT MAX(position) as maxPos FROM tasks'
        );
        const position = (Number(maxPosRow?.maxPos) || 0) + 1;

        await tx.run(
          `INSERT INTO tasks (
            id, task_key, title, description, project_id, status, priority,
            due_date, assignee_id, collaborator_ids, tags, estimate_hours,
            logged_minutes, position, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          taskKey,
          String(title).trim(),
          String(description ?? ''),
          project.id,
          status,
          priority,
          due_date || null,
          assignee_id || null,
          JSON.stringify(collaborator_ids),
          JSON.stringify(tags),
          Number(estimate_hours) || 4,
          0,
          position,
          nowISO,
          nowISO
        );

        await insertActivity(
          tx,
          id,
          req.user,
          'system',
          `创建了任务 [${taskKey}] ${String(title).trim()}`,
          nowISO
        );

        if (Array.isArray(subtasks)) {
          for (const subTitle of subtasks) {
            if (typeof subTitle === 'string' && subTitle.trim()) {
              await tx.run(
                'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, FALSE, NULL, ?)',
                crypto.randomUUID(),
                id,
                subTitle.trim(),
                nowISO
              );
            }
          }
        }
      });

      const fullTask = await getFullTaskById(db, id);
      return res.status(201).json(fullTask);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 3. Update task fields
  app.patch('/api/tasks/:id', requirePerm('can_edit_task'), async (req, res) => {
    try {
      const taskId = req.params.id;
      const existing = await getVisibleTask(req.user, taskId);
      if (!existing) {
        return res.status(404).json({ error: '未找到该任务' });
      }

      const updates = req.body || {};
      const invalid = validateTaskFields(updates);
      if (invalid) {
        return res.status(400).json({ error: invalid });
      }
      if (updates.title !== undefined && !String(updates.title).trim()) {
        return res.status(400).json({ error: '任务名称不能为空' });
      }
      if (
        updates.assignee_id &&
        updates.assignee_id !== existing.assignee_id &&
        !(await db.get('SELECT id FROM members WHERE id = ?', updates.assignee_id))
      ) {
        return res.status(400).json({ error: '负责人不存在' });
      }
      const nowISO = new Date().toISOString();
      const changes = [];

      const nextTitle =
        updates.title !== undefined
          ? String(updates.title).trim()
          : existing.title;
      const nextDesc =
        updates.description !== undefined
          ? String(updates.description ?? '')
          : existing.description;
      const nextProjectId =
        updates.project_id !== undefined
          ? updates.project_id
          : existing.project_id;
      const nextStatus =
        updates.status !== undefined ? updates.status : existing.status;
      const nextPriority =
        updates.priority !== undefined ? updates.priority : existing.priority;
      const nextDueDate =
        updates.due_date !== undefined
          ? updates.due_date || null
          : existing.due_date;
      const nextAssigneeId =
        updates.assignee_id !== undefined
          ? updates.assignee_id || null
          : existing.assignee_id;
      const nextCollaborators =
        updates.collaborator_ids !== undefined
          ? JSON.stringify(updates.collaborator_ids)
          : existing.collaborator_ids;
      const nextTags =
        updates.tags !== undefined ? JSON.stringify(updates.tags) : existing.tags;
      const nextEstimate =
        updates.estimate_hours !== undefined
          ? Number(updates.estimate_hours)
          : existing.estimate_hours;
      const nextLogged =
        updates.logged_minutes !== undefined
          ? Number(updates.logged_minutes)
          : existing.logged_minutes;
      const nextPosition =
        updates.position !== undefined
          ? Number(updates.position)
          : existing.position;

      if (nextStatus !== existing.status) {
        changes.push(`状态变更为「${STATUS_LABELS[nextStatus] || nextStatus}」`);
      }
      if (nextProjectId !== existing.project_id) {
        const proj = await db.get(
          'SELECT name FROM projects WHERE id = ?',
          nextProjectId
        );
        if (!proj || !canSeeProject(req.user, nextProjectId)) {
          return res.status(404).json({ error: '未找到目标项目' });
        }
        changes.push(`迁移至项目「${proj.name}」`);
      }
      if (nextAssigneeId !== existing.assignee_id) {
        const mem = nextAssigneeId
          ? await db.get(
              'SELECT name FROM members WHERE id = ?',
              nextAssigneeId
            )
          : null;
        changes.push(`负责人调整为「${mem?.name || '未指派'}」`);
      }
      if (nextDueDate !== existing.due_date) {
        changes.push(`截止日期更新为「${nextDueDate || '未排期'}」`);
      }
      if (nextPriority !== existing.priority) {
        changes.push(
          `优先级调整为「${PRIORITY_LABELS[nextPriority] || nextPriority}」`
        );
      }
      if (nextLogged !== existing.logged_minutes) {
        const delta = nextLogged - existing.logged_minutes;
        if (delta > 0) {
          changes.push(`记录了 ${delta} 分钟专注投入`);
        }
      }

      await db.run(
        `UPDATE tasks SET
          title = ?,
          description = ?,
          project_id = ?,
          status = ?,
          priority = ?,
          due_date = ?,
          assignee_id = ?,
          collaborator_ids = ?,
          tags = ?,
          estimate_hours = ?,
          logged_minutes = ?,
          position = ?,
          updated_at = ?
        WHERE id = ?`,
        nextTitle,
        nextDesc,
        nextProjectId,
        nextStatus,
        nextPriority,
        nextDueDate,
        nextAssigneeId,
        nextCollaborators,
        nextTags,
        nextEstimate,
        nextLogged,
        nextPosition,
        nowISO,
        taskId
      );

      if (changes.length > 0) {
        await insertActivity(
          db,
          taskId,
          req.user,
          'system',
          changes.join('；'),
          nowISO
        );
      }

      const fullTask = await getFullTaskById(db, taskId);
      return res.json(fullTask);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 4. Delete task
  app.delete('/api/tasks/:id', requirePerm('can_delete_task'), async (req, res) => {
    try {
      if (!(await getVisibleTask(req.user, req.params.id))) {
        return res.status(404).json({ error: '未找到该任务' });
      }
      await db.run('DELETE FROM tasks WHERE id = ?', req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 5. Subtasks endpoints (with automatic completed_at timestamp!)
  app.post('/api/tasks/:id/subtasks', requirePerm('can_edit_task'), async (req, res) => {
    try {
      const taskId = req.params.id;
      if (!(await getVisibleTask(req.user, taskId))) {
        return res.status(404).json({ error: '未找到该任务' });
      }
      const { title } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: '子任务标题不能为空' });
      }
      const id = crypto.randomUUID();
      const nowISO = new Date().toISOString();
      await db.run(
        'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, FALSE, NULL, ?)',
        id,
        taskId,
        String(title).trim(),
        nowISO
      );

      return res.status(201).json({
        id,
        task_id: taskId,
        title: String(title).trim(),
        completed: false,
        completed_at: null,
        created_at: nowISO,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.patch('/api/subtasks/:subId', requirePerm('can_edit_task'), async (req, res) => {
    try {
      const subId = req.params.subId;
      const existing = await getVisibleSubtask(req.user, subId);
      if (!existing) {
        return res.status(404).json({ error: '子任务不存在' });
      }
      const nextCompleted =
        req.body.completed !== undefined
          ? req.body.completed
            ? 1
            : 0
          : existing.completed;
      const nextTitle =
        req.body.title !== undefined
          ? String(req.body.title).trim()
          : existing.title;

      let nextCompletedAt = existing.completed_at || null;
      if (req.body.completed !== undefined) {
        nextCompletedAt = nextCompleted
          ? new Date().toISOString()
          : null;
      }

      await db.run(
        'UPDATE subtasks SET completed = ?, completed_at = ?, title = ? WHERE id = ?',
        nextCompleted,
        nextCompletedAt,
        nextTitle,
        subId
      );

      return res.json({
        ...existing,
        title: nextTitle,
        completed: Boolean(nextCompleted),
        completed_at: nextCompletedAt,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/subtasks/:subId', requirePerm('can_edit_task'), async (req, res) => {
    try {
      if (!(await getVisibleSubtask(req.user, req.params.subId))) {
        return res.status(404).json({ error: '子任务不存在' });
      }
      await db.run('DELETE FROM subtasks WHERE id = ?', req.params.subId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 6. Add task comment
  app.post('/api/tasks/:id/comments', async (req, res) => {
    try {
      const taskId = req.params.id;
      // The author is always the signed-in user; any member_id in the body is ignored.
      const { content } = req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '评论内容不能为空' });
      }
      if (!(await getVisibleTask(req.user, taskId))) {
        return res.status(404).json({ error: '未找到该任务' });
      }
      const commentId = await insertActivity(
        db,
        taskId,
        req.user,
        'comment',
        String(content).trim(),
        new Date().toISOString()
      );
      const comment = await db.get(
        'SELECT * FROM activities WHERE id = ?',
        commentId
      );
      return res.status(201).json(comment);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 7. Create, update, or delete project
  app.post('/api/projects', requirePerm('can_create_project'), async (req, res) => {
    try {
      const { name, code, color = '#6366f1', description = '' } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: '项目名称不能为空' });
      }
      if (!isHexColor(color)) {
        return res.status(400).json({ error: '项目颜色格式应为 #RRGGBB' });
      }
      const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
      const cleanCode =
        (code && String(code).trim().toUpperCase()) ||
        String(name).trim().slice(0, 3).toUpperCase();
      const nowISO = new Date().toISOString();

      await db.run(
        'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        String(name).trim(),
        cleanCode,
        color,
        description,
        nowISO
      );
      await grantProjectVisibility(db, req.user, id);

      return res.status(201).json({
        id,
        name: String(name).trim(),
        code: cleanCode,
        color,
        description,
        created_at: nowISO,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.patch('/api/projects/:id', requirePerm('can_edit_project'), async (req, res) => {
    try {
      const projId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM projects WHERE id = ?',
        projId
      );
      if (!existing || !canSeeProject(req.user, projId)) {
        return res.status(404).json({ error: '未找到该项目' });
      }
      const nextName =
        req.body.name !== undefined
          ? String(req.body.name).trim()
          : existing.name;
      const nextCode =
        req.body.code !== undefined
          ? String(req.body.code).trim().toUpperCase()
          : existing.code;
      const nextColor =
        req.body.color !== undefined
          ? String(req.body.color).trim()
          : existing.color;
      const nextDesc =
        req.body.description !== undefined
          ? String(req.body.description)
          : existing.description;
      const nextPinned =
        req.body.pinned !== undefined
          ? req.body.pinned
            ? 1
            : 0
          : existing.pinned || 0;

      if (!nextName) {
        return res.status(400).json({ error: '项目名称不能为空' });
      }
      if (req.body.color !== undefined && !isHexColor(nextColor)) {
        return res.status(400).json({ error: '项目颜色格式应为 #RRGGBB' });
      }

      await db.run(
        'UPDATE projects SET name = ?, code = ?, color = ?, description = ?, pinned = ? WHERE id = ?',
        nextName,
        nextCode || 'PRJ',
        nextColor,
        nextDesc,
        nextPinned,
        projId
      );

      const updated = await db.get(
        'SELECT * FROM projects WHERE id = ?',
        projId
      );
      return res.json({
        ...updated,
        pinned: Boolean(updated.pinned),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/projects/:id', requirePerm('can_delete_project'), async (req, res) => {
    try {
      const projId = req.params.id;
      if (!canSeeProject(req.user, projId)) {
        return res.status(404).json({ error: '未找到该项目' });
      }
      await db.transaction((tx) => deleteProjectCascade(tx, projId));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 8. Create, update, or delete team member
  app.post('/api/members', requirePerm('can_manage_members'), async (req, res) => {
    try {
      const {
        name,
        role = '团队成员',
        avatar_bg = 'from-indigo-500 to-purple-600',
        email = '',
        capacity_hours = 40,
      } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: '成员姓名不能为空' });
      }
      const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
      await db.run(
        'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        String(name).trim(),
        role,
        avatar_bg,
        email,
        Number(capacity_hours) || 40
      );

      return res.status(201).json({
        id,
        name: String(name).trim(),
        role,
        avatar_bg,
        email,
        capacity_hours: Number(capacity_hours) || 40,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.patch('/api/members/:id', requirePerm('can_manage_members'), async (req, res) => {
    try {
      const memId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM members WHERE id = ?',
        memId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该成员' });
      }
      const nextName =
        req.body.name !== undefined
          ? String(req.body.name).trim()
          : existing.name;
      const nextRole =
        req.body.role !== undefined
          ? String(req.body.role).trim()
          : existing.role;
      const nextAvatarBg =
        req.body.avatar_bg !== undefined
          ? String(req.body.avatar_bg)
          : existing.avatar_bg;
      const nextEmail =
        req.body.email !== undefined
          ? String(req.body.email).trim()
          : existing.email;
      const nextCapacity =
        req.body.capacity_hours !== undefined
          ? Number(req.body.capacity_hours) || 40
          : existing.capacity_hours;
      const nextPinned =
        req.body.pinned !== undefined
          ? req.body.pinned
            ? 1
            : 0
          : existing.pinned || 0;

      if (!nextName) {
        return res.status(400).json({ error: '成员姓名不能为空' });
      }

      await db.run(
        'UPDATE members SET name = ?, role = ?, avatar_bg = ?, email = ?, capacity_hours = ?, pinned = ? WHERE id = ?',
        nextName,
        nextRole,
        nextAvatarBg,
        nextEmail,
        nextCapacity,
        nextPinned,
        memId
      );

      const updated = await db.get(
        'SELECT * FROM members WHERE id = ?',
        memId
      );
      return res.json({
        ...updated,
        pinned: Boolean(updated.pinned),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/members/:id', requirePerm('can_manage_members'), async (req, res) => {
    try {
      const memId = req.params.id;
      // Unassigns tasks, unbinds accounts and chat groups, then deletes the member
      await db.transaction((tx) => deleteMemberCascade(tx, memId));
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // ==========================================
  // 8b. Custom Project Communication Group Chats
  // ==========================================
  app.get('/api/chat-groups', async (req, res) => {
    try {
      return res.json({
        groups: await getChatGroups(db, req.user.permissions.visible_project_ids),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/chat-groups', async (req, res) => {
    try {
      const {
        name,
        description = '',
        project_id = null,
        member_ids = [],
      } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: '群聊名称不能为空' });
      }
      const user = req.user;
      if (
        project_id &&
        (!canSeeProject(user, project_id) ||
          !(await db.get('SELECT id FROM projects WHERE id = ?', project_id)))
      ) {
        return res.status(404).json({ error: '未找到该项目' });
      }
      const id = `grp-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.run(
        'INSERT INTO chat_groups (id, name, description, project_id, member_ids, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        String(name).trim(),
        String(description).trim(),
        project_id || null,
        JSON.stringify(Array.isArray(member_ids) ? member_ids : []),
        user ? user.id : null,
        nowISO
      );

      return res.status(201).json({
        id,
        name: String(name).trim(),
        description: String(description).trim(),
        project_id: project_id || null,
        member_ids: Array.isArray(member_ids) ? member_ids : [],
        created_by: user ? user.id : null,
        created_at: nowISO,
        message_count: 0,
        last_message_at: null,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.patch('/api/chat-groups/:id', async (req, res) => {
    try {
      const groupId = req.params.id;
      const existing = await getVisibleChatGroup(req.user, groupId);
      if (!existing) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }
      if (!canManageChatGroup(req.user, existing)) {
        return forbid(res, '仅群聊创建者或人员管理者可修改群聊');
      }
      const nextName =
        req.body.name !== undefined
          ? String(req.body.name).trim()
          : existing.name;
      const nextDesc =
        req.body.description !== undefined
          ? String(req.body.description).trim()
          : existing.description;
      const nextProjId =
        req.body.project_id !== undefined
          ? req.body.project_id || null
          : existing.project_id;
      const nextMemIds =
        req.body.member_ids !== undefined
          ? JSON.stringify(
              Array.isArray(req.body.member_ids) ? req.body.member_ids : []
            )
          : existing.member_ids;

      if (!nextName) {
        return res.status(400).json({ error: '群聊名称不能为空' });
      }
      if (
        nextProjId &&
        nextProjId !== existing.project_id &&
        (!canSeeProject(req.user, nextProjId) ||
          !(await db.get('SELECT id FROM projects WHERE id = ?', nextProjId)))
      ) {
        return res.status(404).json({ error: '未找到该项目' });
      }

      await db.run(
        'UPDATE chat_groups SET name = ?, description = ?, project_id = ?, member_ids = ? WHERE id = ?',
        nextName,
        nextDesc,
        nextProjId,
        nextMemIds,
        groupId
      );

      const groups = await getChatGroups(db, 'all');
      const updated = groups.find((g) => g.id === groupId);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/chat-groups/:id', async (req, res) => {
    try {
      const group = await getVisibleChatGroup(req.user, req.params.id);
      if (!group) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }
      if (!canManageChatGroup(req.user, group)) {
        return forbid(res, '仅群聊创建者或人员管理者可删除群聊');
      }
      await db.run('DELETE FROM chat_groups WHERE id = ?', req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.get('/api/chat-groups/:id/messages', async (req, res) => {
    try {
      const groupId = req.params.id;
      if (!(await getVisibleChatGroup(req.user, groupId))) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }
      const messages = await db.all(
        'SELECT * FROM chat_group_messages WHERE group_id = ? ORDER BY created_at ASC',
        groupId
      );
      return res.json({ messages });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/chat-groups/:id/messages', async (req, res) => {
    try {
      const groupId = req.params.id;
      const group = await getVisibleChatGroup(req.user, groupId);
      if (!group) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }

      // The sender is always the signed-in user; sender fields in the body are ignored.
      const { content } = req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '消息内容不能为空' });
      }

      const user = req.user;
      const member = user.member_id
        ? await db.get('SELECT * FROM members WHERE id = ?', user.member_id)
        : null;
      const effectiveMemberId = member ? member.id : null;

      const resolvedName = (member && member.name) || user.display_name;
      const resolvedRole =
        (member && member.role) || ROLE_LABELS[user.role] || '项目成员';
      const resolvedAvatarBg =
        (member && member.avatar_bg) || 'from-indigo-500 to-purple-600';

      const msgId = `gmsg-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.run(
        'INSERT INTO chat_group_messages (id, group_id, sender_user_id, sender_member_id, sender_name, sender_role, avatar_bg, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        msgId,
        groupId,
        user.id,
        effectiveMemberId,
        resolvedName,
        resolvedRole,
        resolvedAvatarBg,
        String(content).trim(),
        nowISO
      );

      const created = await db.get(
        'SELECT * FROM chat_group_messages WHERE id = ?',
        msgId
      );
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/chat-groups/:groupId/messages/:msgId', async (req, res) => {
    try {
      if (!(await getVisibleChatGroup(req.user, req.params.groupId))) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }
      const message = await db.get(
        'SELECT sender_user_id FROM chat_group_messages WHERE id = ? AND group_id = ?',
        req.params.msgId,
        req.params.groupId
      );
      if (!message) {
        return res.status(404).json({ error: '消息不存在' });
      }
      if (
        message.sender_user_id !== req.user.id &&
        !req.user.permissions.can_manage_members
      ) {
        return forbid(res, '只能删除自己发送的消息');
      }
      await db.run(
        'DELETE FROM chat_group_messages WHERE id = ? AND group_id = ?',
        req.params.msgId,
        req.params.groupId
      );
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 9. Clear workspace data
  app.post('/api/seed/reset', requireAdmin, async (_req, res) => {
    try {
      await db.transaction((tx) => clearWorkspaceData(tx));
      const payload = await getBootstrapData(db);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 10. Import JSON backup (validated first, then replaced atomically)
  app.post('/api/import', requireAdmin, async (req, res) => {
    try {
      const backup = req.body || {};
      const problem = validateBackup(backup);
      if (problem) {
        return res.status(400).json({ error: `导入文件格式不正确：${problem}` });
      }
      const { projects, members, tasks } = backup;
      const memberIds = new Set(members.map((m) => m.id));
      const nowISO = new Date().toISOString();

      await db.transaction(async (tx) => {
        await tx.exec(
          'DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members;'
        );

        for (const p of projects) {
          await tx.run(
            'INSERT INTO projects (id, name, code, color, description, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            p.id,
            p.name,
            p.code,
            p.color,
            p.description || '',
            p.pinned ? 1 : 0,
            p.created_at || nowISO
          );
        }

        for (const m of members) {
          await tx.run(
            'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)',
            m.id,
            m.name,
            m.role || '团队成员',
            m.avatar_bg || 'from-indigo-500 to-purple-600',
            m.email || '',
            Number(m.capacity_hours) || 40,
            m.pinned ? 1 : 0
          );
        }

        for (const t of tasks) {
          await tx.run(
            `INSERT INTO tasks (
              id, task_key, title, description, project_id, status, priority,
              due_date, assignee_id, collaborator_ids, tags, estimate_hours,
              logged_minutes, position, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            t.id,
            t.task_key,
            t.title,
            t.description || '',
            t.project_id,
            t.status || 'todo',
            t.priority || 'medium',
            t.due_date || null,
            memberIds.has(t.assignee_id) ? t.assignee_id : null,
            JSON.stringify(
              (t.collaborator_ids || []).filter((id) => memberIds.has(id))
            ),
            JSON.stringify(t.tags || []),
            Number(t.estimate_hours) || 4,
            Number(t.logged_minutes) || 0,
            Number(t.position) || 0,
            t.created_at || nowISO,
            t.updated_at || nowISO
          );
          for (const sub of t.subtasks || []) {
            await tx.run(
              'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              sub.id || crypto.randomUUID(),
              t.id,
              sub.title,
              sub.completed ? 1 : 0,
              sub.completed ? sub.completed_at || nowISO : null,
              sub.created_at || nowISO
            );
          }
          for (const a of t.activities || []) {
            await tx.run(
              'INSERT INTO activities (id, task_id, member_id, actor_name, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              a.id || crypto.randomUUID(),
              t.id,
              a.member_id || null,
              a.actor_name || null,
              a.type === 'comment' ? 'comment' : 'system',
              a.content,
              a.created_at || nowISO
            );
          }
        }

        // Drop references to members/projects that the backup replaced.
        await tx.run(
          'UPDATE users SET member_id = NULL WHERE member_id IS NOT NULL AND member_id NOT IN (SELECT id FROM members)'
        );
        await tx.run(
          'UPDATE chat_groups SET project_id = NULL WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects)'
        );
      });

      const payload = await getBootstrapData(db);
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 11. AI Assistant Settings (Permanent SQLite persistence)
  app.get('/api/ai/settings', async (_req, res) => {
    try {
      res.json(toPublicAiSettings(await getAiSettings(db)));
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.put('/api/ai/settings', requireAdmin, async (req, res) => {
    try {
      const updated = await updateAiSettings(db, req.body || {});
      res.json(toPublicAiSettings(updated));
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 12. AI Assistant Fetch Models / Test Connection
  app.post('/api/ai/models', requireAdmin, async (req, res) => {
    try {
      const saved = await getAiSettings(db);
      const baseUrl = req.body?.base_url || saved.base_url;
      // Only reuse the stored key for the endpoint it was saved for, so it is
      // never sent to a different host.
      const sameEndpoint =
        normalizeOpenAIEndpoint(baseUrl, 'models') ===
        normalizeOpenAIEndpoint(saved.base_url, 'models');
      const apiKey = req.body?.api_key
        ? req.body.api_key
        : sameEndpoint
          ? saved.api_key
          : '';
      const models = await fetchOpenAIModels(baseUrl, apiKey);
      res.json({ models });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 13. AI Assistant Chat History & Clear
  app.get('/api/ai/messages', async (req, res) => {
    try {
      res.json({ messages: await getAiMessages(db, req.user) });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/ai/messages', async (req, res) => {
    try {
      const messages = await clearAiMessages(db, req.user);
      res.json({ messages });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 14. AI Assistant Natural Language Command -> Auto DB Ingestion
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, client_today: clientToday } = req.body || {};
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: '请输入指令或对话内容' });
      }
      const assistantMessage = await processAiChat(
        db,
        message,
        req.user,
        clientToday
      );
      const bootstrap = await getBootstrapData(
        db,
        req.user.permissions.visible_project_ids
      );
      const messages = await getAiMessages(db, req.user);
      return res.json({
        assistantMessage,
        messages,
        bootstrap,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Serve static frontend in production if dist/ exists
  const distPath = path.resolve('dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return {
    app,
    ready,
    closeDb: async () => {
      try {
        await (await ready).close();
      } catch {
        // ignore
      }
    },
  };
}
