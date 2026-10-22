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
} from './db.mjs';
import {
  getAiSettings,
  updateAiSettings,
  getAiMessages,
  clearAiMessages,
  processAiChat,
  fetchOpenAIModels,
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
  const app = express();

  app.use(cors());
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

  const getCurrentUser = async (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const session = await db.get(
      'SELECT user_id FROM sessions WHERE token = ?',
      token
    );
    if (!session) return null;
    const userRow = await db.get(
      'SELECT * FROM users WHERE id = ?',
      session.user_id
    );
    return serializeUser(userRow);
  };

  // ==========================================
  // 0. Authentication & Account Management API
  // ==========================================
  app.get('/api/auth/status', async (req, res) => {
    try {
      const cntRow = await db.get('SELECT COUNT(*) as cnt FROM users');
      const initialized = Number(cntRow?.cnt || 0) > 0;
      const currentUser = await getCurrentUser(req);
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
      if (!password || String(password).length < 4) {
        return res.status(400).json({ error: '登录密码不能少于 4 位' });
      }

      const cleanUsername = String(username).trim().toLowerCase();
      const cleanDisplay =
        display_name && String(display_name).trim()
          ? String(display_name).trim()
          : String(username).trim();
      const nowISO = new Date().toISOString();

      let boundMemberId = null;
      if (create_member || bind_member_name) {
        const lookupName =
          bind_member_name && String(bind_member_name).trim()
            ? String(bind_member_name).trim()
            : cleanDisplay;
        const existingMem = await db.get(
          'SELECT id FROM members WHERE LOWER(name) = LOWER(?)',
          lookupName
        );
        if (existingMem) {
          boundMemberId = existingMem.id;
        } else if (create_member) {
          boundMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
          await db.run(
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

      const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
      const perms = normalizePermissions('admin', {});
      await db.run(
        'INSERT INTO users (id, username, display_name, password_hash, role, member_id, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        userId,
        cleanUsername,
        cleanDisplay,
        hashPassword(password),
        'admin',
        boundMemberId,
        JSON.stringify(perms),
        nowISO
      );

      const token = crypto.randomBytes(32).toString('hex');
      await db.run(
        'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)',
        token,
        userId,
        nowISO
      );

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
      const userRow = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = ?',
        cleanUsername
      );
      if (!userRow || !verifyPassword(password, userRow.password_hash)) {
        return res.status(401).json({ error: '账号或密码错误' });
      }

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
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        await db.run('DELETE FROM sessions WHERE token = ?', token);
      }
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // List all user accounts
  app.get('/api/users', async (_req, res) => {
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
  app.post('/api/users', async (req, res) => {
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
      if (!password || String(password).length < 4) {
        return res.status(400).json({ error: '密码长度不能少于 4 位' });
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
      const normalizedPerms = normalizePermissions(role, permissions);

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
  app.patch('/api/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该账号' });
      }

      const updates = req.body || {};
      const nextUsername =
        updates.username !== undefined
          ? String(updates.username).trim().toLowerCase()
          : existing.username;
      const nextDisplay =
        updates.display_name !== undefined
          ? String(updates.display_name).trim()
          : existing.display_name;
      const nextRole =
        updates.role !== undefined ? updates.role : existing.role;
      const nextMemberId =
        updates.member_id !== undefined
          ? updates.member_id || null
          : existing.member_id;
      const nextPasswordHash =
        updates.password && String(updates.password).trim().length >= 4
          ? hashPassword(String(updates.password).trim())
          : existing.password_hash;

      let existingPerms = {};
      try {
        existingPerms = JSON.parse(existing.permissions || '{}');
      } catch {
        existingPerms = {};
      }
      const nextPerms = normalizePermissions(
        nextRole,
        updates.permissions !== undefined ? updates.permissions : existingPerms
      );

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
  app.delete('/api/users/:id', async (req, res) => {
    try {
      const userId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM users WHERE id = ?',
        userId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该账号' });
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
      const user = await getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      const payload = await getBootstrapData(db, visibleProjectIds);
      res.json({ ...payload, currentUser: user });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 2. Create a new task
  app.post('/api/tasks', async (req, res) => {
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

      let resolvedProjectId = project_id;
      let project = resolvedProjectId
        ? await db.get('SELECT * FROM projects WHERE id = ?', resolvedProjectId)
        : null;

      if (!project) {
        const firstProj = await db.get(
          'SELECT * FROM projects ORDER BY created_at ASC LIMIT 1'
        );
        if (firstProj) {
          project = firstProj;
          resolvedProjectId = firstProj.id;
        } else {
          const newProjId = `proj-${crypto.randomUUID().slice(0, 8)}`;
          const projName = req.body.project_name
            ? String(req.body.project_name).trim()
            : '默认工作项目';
          const projCode =
            projName
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 3)
              .toUpperCase() || 'FLW';
          const now = new Date().toISOString();
          await db.run(
            'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            newProjId,
            projName,
            projCode,
            '#6366f1',
            '自动创建的初始工作项目',
            now
          );
          project = await db.get(
            'SELECT * FROM projects WHERE id = ?',
            newProjId
          );
          resolvedProjectId = newProjId;
        }
      }

      const codePrefix = project ? project.code : 'FLW';
      const existingCount = await db.get(
        'SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?',
        resolvedProjectId
      );
      const nextNum = 101 + (existingCount?.cnt || 0);
      const taskKey = `${codePrefix}-${nextNum}`;

      const maxPosRow = await db.get(
        'SELECT MAX(position) as maxPos FROM tasks'
      );
      const position = (maxPosRow?.maxPos || 0) + 1;

      const id = `task-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.run(
        `INSERT INTO tasks (
          id, task_key, title, description, project_id, status, priority,
          due_date, assignee_id, collaborator_ids, tags, estimate_hours,
          logged_minutes, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        taskKey,
        String(title).trim(),
        description,
        resolvedProjectId,
        status,
        priority,
        due_date || null,
        assignee_id || null,
        JSON.stringify(Array.isArray(collaborator_ids) ? collaborator_ids : []),
        JSON.stringify(Array.isArray(tags) ? tags : []),
        Number(estimate_hours) || 4,
        0,
        position,
        nowISO,
        nowISO
      );

      await db.run(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        id,
        assignee_id || null,
        'system',
        `创建了任务 [${taskKey}] ${String(title).trim()}`,
        nowISO
      );

      if (Array.isArray(subtasks) && subtasks.length > 0) {
        for (const subTitle of subtasks) {
          if (typeof subTitle === 'string' && subTitle.trim()) {
            await db.run(
              'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
              crypto.randomUUID(),
              id,
              subTitle.trim(),
              0,
              nowISO
            );
          }
        }
      }

      const fullTask = await getFullTaskById(db, id);
      return res.status(201).json(fullTask);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 3. Update task fields
  app.patch('/api/tasks/:id', async (req, res) => {
    try {
      const taskId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM tasks WHERE id = ?',
        taskId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该任务' });
      }

      const updates = req.body || {};
      const nowISO = new Date().toISOString();
      const changes = [];

      const nextTitle =
        updates.title !== undefined
          ? String(updates.title).trim()
          : existing.title;
      const nextDesc =
        updates.description !== undefined
          ? String(updates.description)
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
        changes.push(`迁移至项目「${proj?.name || nextProjectId}」`);
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
        await db.run(
          'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          crypto.randomUUID(),
          taskId,
          nextAssigneeId,
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
  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM tasks WHERE id = ?', req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 5. Subtasks endpoints (with automatic completed_at timestamp!)
  app.post('/api/tasks/:id/subtasks', async (req, res) => {
    try {
      const taskId = req.params.id;
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

  app.patch('/api/subtasks/:subId', async (req, res) => {
    try {
      const subId = req.params.subId;
      const existing = await db.get(
        'SELECT * FROM subtasks WHERE id = ?',
        subId
      );
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

  app.delete('/api/subtasks/:subId', async (req, res) => {
    try {
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
      const { member_id = null, content } = req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '评论内容不能为空' });
      }
      const id = crypto.randomUUID();
      const nowISO = new Date().toISOString();
      await db.run(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        taskId,
        member_id,
        'comment',
        String(content).trim(),
        nowISO
      );

      return res.status(201).json({
        id,
        task_id: taskId,
        member_id,
        type: 'comment',
        content: String(content).trim(),
        created_at: nowISO,
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 7. Create, update, or delete project
  app.post('/api/projects', async (req, res) => {
    try {
      const { name, code, color = '#6366f1', description = '' } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: '项目名称不能为空' });
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

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const projId = req.params.id;
      const existing = await db.get(
        'SELECT * FROM projects WHERE id = ?',
        projId
      );
      if (!existing) {
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

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const projId = req.params.id;
      await db.run(
        'UPDATE chat_groups SET project_id = NULL WHERE project_id = ?',
        projId
      );
      await db.run('DELETE FROM projects WHERE id = ?', projId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 8. Create, update, or delete team member
  app.post('/api/members', async (req, res) => {
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

  app.patch('/api/members/:id', async (req, res) => {
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

  app.delete('/api/members/:id', async (req, res) => {
    try {
      const memId = req.params.id;
      // Safely clear assignee_id on tasks assigned to this member
      await db.run(
        'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?',
        memId
      );
      // Unbind any user accounts linked to this member
      await db.run(
        'UPDATE users SET member_id = NULL WHERE member_id = ?',
        memId
      );
      // Remove member ID from collaborator_ids JSON array on all tasks
      const allTasks = await db.all(
        'SELECT id, collaborator_ids FROM tasks'
      );
      for (const t of allTasks) {
        const list = JSON.parse(t.collaborator_ids || '[]');
        if (Array.isArray(list) && list.includes(memId)) {
          const filtered = list.filter((id) => id !== memId);
          await db.run(
            'UPDATE tasks SET collaborator_ids = ? WHERE id = ?',
            JSON.stringify(filtered),
            t.id
          );
        }
      }
      await db.run('DELETE FROM members WHERE id = ?', memId);
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
      const user = await getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      return res.json({ groups: await getChatGroups(db, visibleProjectIds) });
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
      const user = await getCurrentUser(req);
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
      const existing = await db.get(
        'SELECT * FROM chat_groups WHERE id = ?',
        groupId
      );
      if (!existing) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
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
      await db.run('DELETE FROM chat_groups WHERE id = ?', req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.get('/api/chat-groups/:id/messages', async (req, res) => {
    try {
      const groupId = req.params.id;
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
      const group = await db.get(
        'SELECT * FROM chat_groups WHERE id = ?',
        groupId
      );
      if (!group) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }

      const { content, sender_member_id = null, sender_name = '' } =
        req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '消息内容不能为空' });
      }

      const user = await getCurrentUser(req);
      const effectiveMemberId =
        sender_member_id || (user ? user.member_id : null);
      const member = effectiveMemberId
        ? await db.get(
          'SELECT * FROM members WHERE id = ?',
          effectiveMemberId
        )
        : null;

      const resolvedName =
        (member && member.name) ||
        (user && user.display_name) ||
        (sender_name && String(sender_name).trim()) ||
        '团队成员';
      const resolvedRole =
        (member && member.role) ||
        (user && ROLE_LABELS[user.role]) ||
        '项目成员';
      const resolvedAvatarBg =
        (member && member.avatar_bg) || 'from-indigo-500 to-purple-600';

      const msgId = `gmsg-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      await db.run(
        'INSERT INTO chat_group_messages (id, group_id, sender_user_id, sender_member_id, sender_name, sender_role, avatar_bg, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        msgId,
        groupId,
        user ? user.id : null,
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
  app.post('/api/seed/reset', async (_req, res) => {
    try {
      await clearWorkspaceData(db);
      const payload = await getBootstrapData(db);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 10. Import JSON backup
  app.post('/api/import', async (req, res) => {
    try {
      const { projects, members, tasks } = req.body || {};
      if (
        !Array.isArray(projects) ||
        !Array.isArray(members) ||
        !Array.isArray(tasks)
      ) {
        return res.status(400).json({ error: '导入文件格式不正确' });
      }
      await db.exec(
        'DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members;'
      );

      for (const p of projects) {
        await db.run(
          'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          p.id,
          p.name,
          p.code,
          p.color,
          p.description || '',
          p.created_at || new Date().toISOString()
        );
      }

      for (const m of members) {
        await db.run(
          'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)',
          m.id,
          m.name,
          m.role,
          m.avatar_bg,
          m.email || '',
          m.capacity_hours || 40
        );
      }


      for (const t of tasks) {
        const nowISO = new Date().toISOString();
        await db.run(
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
          t.assignee_id || null,
          JSON.stringify(t.collaborator_ids || []),
          JSON.stringify(t.tags || []),
          t.estimate_hours || 4,
          t.logged_minutes || 0,
          t.position || 0,
          t.created_at || nowISO,
          t.updated_at || nowISO
        );
        for (const s of t.subtasks || []) {
          await db.run(
            'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            s.id || crypto.randomUUID(),
            t.id,
            s.title,
            s.completed ? 1 : 0,
            s.completed ? s.completed_at || nowISO : null,
            s.created_at || nowISO
          );
        }
        for (const a of t.activities || []) {
          await db.run(
            'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            a.id || crypto.randomUUID(),
            t.id,
            a.member_id || null,
            a.type || 'system',
            a.content,
            a.created_at || nowISO
          );
        }
      }

      const payload = await getBootstrapData(db);
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 11. AI Assistant Settings (Permanent SQLite persistence)
  app.get('/api/ai/settings', async (_req, res) => {
    try {
      res.json(await getAiSettings(db));
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.put('/api/ai/settings', async (req, res) => {
    try {
      const updated = await updateAiSettings(db, req.body || {});
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 12. AI Assistant Fetch Models / Test Connection
  app.post('/api/ai/models', async (req, res) => {
    try {
      const saved = await getAiSettings(db);
      const baseUrl = req.body?.base_url || saved.base_url;
      const apiKey =
        req.body?.api_key !== undefined ? req.body.api_key : saved.api_key;
      const models = await fetchOpenAIModels(baseUrl, apiKey);
      res.json({ models });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 13. AI Assistant Chat History & Clear
  app.get('/api/ai/messages', async (_req, res) => {
    try {
      res.json({ messages: await getAiMessages(db) });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/ai/messages', async (_req, res) => {
    try {
      const messages = await clearAiMessages(db);
      res.json({ messages });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 14. AI Assistant Natural Language Command -> Auto DB Ingestion
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message } = req.body || {};
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: '请输入指令或对话内容' });
      }
      const assistantMessage = await processAiChat(db, message);
      const user = await getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      const bootstrap = await getBootstrapData(db, visibleProjectIds);
      const messages = await getAiMessages(db);
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
