import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  initDatabase,
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

export function createApp(dbPath = path.resolve('data/flow.sqlite')) {
  const db = initDatabase(dbPath);
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  const getCurrentUser = (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const session = db
      .prepare('SELECT user_id FROM sessions WHERE token = ?')
      .get(token);
    if (!session) return null;
    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(session.user_id);
    return serializeUser(userRow);
  };

  // ==========================================
  // 0. Authentication & Account Management API
  // ==========================================
  app.get('/api/auth/status', (req, res) => {
    try {
      const cntRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
      const initialized = Number(cntRow?.cnt || 0) > 0;
      const currentUser = getCurrentUser(req);
      return res.json({ initialized, currentUser, user: currentUser });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // First-time deployment Super Admin setup
  app.post('/api/auth/setup', (req, res) => {
    try {
      const cntRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
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
        const existingMem = db
          .prepare('SELECT id FROM members WHERE LOWER(name) = LOWER(?)')
          .get(lookupName);
        if (existingMem) {
          boundMemberId = existingMem.id;
        } else if (create_member) {
          boundMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(
            'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
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
      db.prepare(
        'INSERT INTO users (id, username, display_name, password_hash, role, member_id, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
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
      db.prepare(
        'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'
      ).run(token, userId, nowISO);

      const userRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);
      return res.status(201).json({
        token,
        user: serializeUser(userRow),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: '请输入账号和密码' });
      }
      const cleanUsername = String(username).trim().toLowerCase();
      const userRow = db
        .prepare('SELECT * FROM users WHERE LOWER(username) = ?')
        .get(cleanUsername);
      if (!userRow || !verifyPassword(password, userRow.password_hash)) {
        return res.status(401).json({ error: '账号或密码错误' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const nowISO = new Date().toISOString();
      db.prepare(
        'INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)'
      ).run(token, userRow.id, nowISO);

      return res.json({
        token,
        user: serializeUser(userRow),
      });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      }
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // List all user accounts
  app.get('/api/users', (_req, res) => {
    try {
      const rows = db
        .prepare('SELECT * FROM users ORDER BY created_at ASC')
        .all();
      return res.json({ users: rows.map(serializeUser) });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Create user account (Admin)
  app.post('/api/users', (req, res) => {
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
      const dup = db
        .prepare('SELECT id FROM users WHERE LOWER(username) = ?')
        .get(cleanUsername);
      if (dup) {
        return res.status(400).json({ error: '该登录账号已存在' });
      }

      const cleanDisplay =
        display_name && String(display_name).trim()
          ? String(display_name).trim()
          : String(username).trim();

      let resolvedMemberId = member_id || null;
      if (!resolvedMemberId && auto_create_member) {
        const existingMem = db
          .prepare('SELECT id FROM members WHERE LOWER(name) = LOWER(?)')
          .get(cleanDisplay);
        if (existingMem) {
          resolvedMemberId = existingMem.id;
        } else {
          resolvedMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(
            'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
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

      db.prepare(
        'INSERT INTO users (id, username, display_name, password_hash, role, member_id, permissions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId,
        cleanUsername,
        cleanDisplay,
        hashPassword(password),
        role,
        resolvedMemberId,
        JSON.stringify(normalizedPerms),
        nowISO
      );

      const createdRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);
      return res.status(201).json(serializeUser(createdRow));
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Update user account (Admin)
  app.patch('/api/users/:id', (req, res) => {
    try {
      const userId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);
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
        const adminCnt = db
          .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
          .get();
        if (Number(adminCnt?.cnt || 0) <= 1) {
          return res
            .status(400)
            .json({ error: '系统至少需要保留一个超级管理员账号' });
        }
      }

      db.prepare(
        'UPDATE users SET username = ?, display_name = ?, password_hash = ?, role = ?, member_id = ?, permissions = ? WHERE id = ?'
      ).run(
        nextUsername,
        nextDisplay || nextUsername,
        nextPasswordHash,
        nextRole,
        nextMemberId,
        JSON.stringify(nextPerms),
        userId
      );

      const updatedRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);
      return res.json(serializeUser(updatedRow));
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // Delete user account (Admin)
  app.delete('/api/users/:id', (req, res) => {
    try {
      const userId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userId);
      if (!existing) {
        return res.status(404).json({ error: '未找到该账号' });
      }
      if (existing.role === 'admin') {
        const adminCnt = db
          .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'")
          .get();
        if (Number(adminCnt?.cnt || 0) <= 1) {
          return res
            .status(400)
            .json({ error: '不能删除系统唯一的超级管理员账号' });
        }
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // ==========================================
  // 1. Bootstrap all state (filtered by user project visibility)
  // ==========================================
  app.get('/api/bootstrap', (req, res) => {
    try {
      const user = getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      const payload = getBootstrapData(db, visibleProjectIds);
      res.json({ ...payload, currentUser: user });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 2. Create a new task
  app.post('/api/tasks', (req, res) => {
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
        ? db.prepare('SELECT * FROM projects WHERE id = ?').get(resolvedProjectId)
        : null;

      if (!project) {
        const firstProj = db
          .prepare('SELECT * FROM projects ORDER BY created_at ASC LIMIT 1')
          .get();
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
          db.prepare(
            'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(
            newProjId,
            projName,
            projCode,
            '#6366f1',
            '自动创建的初始工作项目',
            now
          );
          project = db
            .prepare('SELECT * FROM projects WHERE id = ?')
            .get(newProjId);
          resolvedProjectId = newProjId;
        }
      }

      const codePrefix = project ? project.code : 'FLW';
      const existingCount = db
        .prepare('SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?')
        .get(resolvedProjectId);
      const nextNum = 101 + (existingCount?.cnt || 0);
      const taskKey = `${codePrefix}-${nextNum}`;

      const maxPosRow = db
        .prepare('SELECT MAX(position) as maxPos FROM tasks')
        .get();
      const position = (maxPosRow?.maxPos || 0) + 1;

      const id = `task-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      db.prepare(`
        INSERT INTO tasks (
          id, task_key, title, description, project_id, status, priority,
          due_date, assignee_id, collaborator_ids, tags, estimate_hours,
          logged_minutes, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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

      db.prepare(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        id,
        assignee_id || null,
        'system',
        `创建了任务 [${taskKey}] ${String(title).trim()}`,
        nowISO
      );

      if (Array.isArray(subtasks) && subtasks.length > 0) {
        const insertSub = db.prepare(
          'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)'
        );
        for (const subTitle of subtasks) {
          if (typeof subTitle === 'string' && subTitle.trim()) {
            insertSub.run(crypto.randomUUID(), id, subTitle.trim(), 0, nowISO);
          }
        }
      }

      const fullTask = getFullTaskById(db, id);
      return res.status(201).json(fullTask);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 3. Update task fields
  app.patch('/api/tasks/:id', (req, res) => {
    try {
      const taskId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(taskId);
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
        const proj = db
          .prepare('SELECT name FROM projects WHERE id = ?')
          .get(nextProjectId);
        changes.push(`迁移至项目「${proj?.name || nextProjectId}」`);
      }
      if (nextAssigneeId !== existing.assignee_id) {
        const mem = nextAssigneeId
          ? db
              .prepare('SELECT name FROM members WHERE id = ?')
              .get(nextAssigneeId)
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

      db.prepare(`
        UPDATE tasks SET
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
        WHERE id = ?
      `).run(
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
        db.prepare(
          'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          taskId,
          nextAssigneeId,
          'system',
          changes.join('；'),
          nowISO
        );
      }

      const fullTask = getFullTaskById(db, taskId);
      return res.json(fullTask);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 4. Delete task
  app.delete('/api/tasks/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 5. Subtasks endpoints (with automatic completed_at timestamp!)
  app.post('/api/tasks/:id/subtasks', (req, res) => {
    try {
      const taskId = req.params.id;
      const { title } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ error: '子任务标题不能为空' });
      }
      const id = crypto.randomUUID();
      const nowISO = new Date().toISOString();
      db.prepare(
        'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, 0, NULL, ?)'
      ).run(id, taskId, String(title).trim(), nowISO);

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

  app.patch('/api/subtasks/:subId', (req, res) => {
    try {
      const subId = req.params.subId;
      const existing = db
        .prepare('SELECT * FROM subtasks WHERE id = ?')
        .get(subId);
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

      db.prepare(
        'UPDATE subtasks SET completed = ?, completed_at = ?, title = ? WHERE id = ?'
      ).run(nextCompleted, nextCompletedAt, nextTitle, subId);

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

  app.delete('/api/subtasks/:subId', (req, res) => {
    try {
      db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.subId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 6. Add task comment
  app.post('/api/tasks/:id/comments', (req, res) => {
    try {
      const taskId = req.params.id;
      const { member_id = null, content } = req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '评论内容不能为空' });
      }
      const id = crypto.randomUUID();
      const nowISO = new Date().toISOString();
      db.prepare(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, taskId, member_id, 'comment', String(content).trim(), nowISO);

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
  app.post('/api/projects', (req, res) => {
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

      db.prepare(
        'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, String(name).trim(), cleanCode, color, description, nowISO);

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

  app.patch('/api/projects/:id', (req, res) => {
    try {
      const projId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .get(projId);
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

      if (!nextName) {
        return res.status(400).json({ error: '项目名称不能为空' });
      }

      db.prepare(
        'UPDATE projects SET name = ?, code = ?, color = ?, description = ? WHERE id = ?'
      ).run(nextName, nextCode || 'PRJ', nextColor, nextDesc, projId);

      const updated = db
        .prepare('SELECT * FROM projects WHERE id = ?')
        .get(projId);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/projects/:id', (req, res) => {
    try {
      const projId = req.params.id;
      db.prepare(
        'UPDATE chat_groups SET project_id = NULL WHERE project_id = ?'
      ).run(projId);
      db.prepare('DELETE FROM projects WHERE id = ?').run(projId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 8. Create, update, or delete team member
  app.post('/api/members', (req, res) => {
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
      db.prepare(
        'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
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

  app.patch('/api/members/:id', (req, res) => {
    try {
      const memId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM members WHERE id = ?')
        .get(memId);
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

      if (!nextName) {
        return res.status(400).json({ error: '成员姓名不能为空' });
      }

      db.prepare(
        'UPDATE members SET name = ?, role = ?, avatar_bg = ?, email = ?, capacity_hours = ? WHERE id = ?'
      ).run(nextName, nextRole, nextAvatarBg, nextEmail, nextCapacity, memId);

      const updated = db
        .prepare('SELECT * FROM members WHERE id = ?')
        .get(memId);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/members/:id', (req, res) => {
    try {
      const memId = req.params.id;
      // Safely clear assignee_id on tasks assigned to this member
      db.prepare('UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?').run(
        memId
      );
      // Unbind any user accounts linked to this member
      db.prepare('UPDATE users SET member_id = NULL WHERE member_id = ?').run(
        memId
      );
      // Remove member ID from collaborator_ids JSON array on all tasks
      const allTasks = db
        .prepare('SELECT id, collaborator_ids FROM tasks')
        .all();
      const updateCollab = db.prepare(
        'UPDATE tasks SET collaborator_ids = ? WHERE id = ?,'
          .replace(',', '')
      );
      for (const t of allTasks) {
        const list = JSON.parse(t.collaborator_ids || '[]');
        if (Array.isArray(list) && list.includes(memId)) {
          const filtered = list.filter((id) => id !== memId);
          updateCollab.run(JSON.stringify(filtered), t.id);
        }
      }
      db.prepare('DELETE FROM members WHERE id = ?').run(memId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // ==========================================
  // 8b. Custom Project Communication Group Chats
  // ==========================================
  app.get('/api/chat-groups', (req, res) => {
    try {
      const user = getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      return res.json({ groups: getChatGroups(db, visibleProjectIds) });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/chat-groups', (req, res) => {
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
      const user = getCurrentUser(req);
      const id = `grp-${crypto.randomUUID().slice(0, 8)}`;
      const nowISO = new Date().toISOString();

      db.prepare(
        'INSERT INTO chat_groups (id, name, description, project_id, member_ids, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
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

  app.patch('/api/chat-groups/:id', (req, res) => {
    try {
      const groupId = req.params.id;
      const existing = db
        .prepare('SELECT * FROM chat_groups WHERE id = ?')
        .get(groupId);
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

      db.prepare(
        'UPDATE chat_groups SET name = ?, description = ?, project_id = ?, member_ids = ? WHERE id = ?'
      ).run(nextName, nextDesc, nextProjId, nextMemIds, groupId);

      const groups = getChatGroups(db, 'all');
      const updated = groups.find((g) => g.id === groupId);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/chat-groups/:id', (req, res) => {
    try {
      db.prepare('DELETE FROM chat_groups WHERE id = ?').run(req.params.id);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.get('/api/chat-groups/:id/messages', (req, res) => {
    try {
      const groupId = req.params.id;
      const messages = db
        .prepare(
          'SELECT * FROM chat_group_messages WHERE group_id = ? ORDER BY created_at ASC'
        )
        .all(groupId);
      return res.json({ messages });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.post('/api/chat-groups/:id/messages', (req, res) => {
    try {
      const groupId = req.params.id;
      const group = db
        .prepare('SELECT * FROM chat_groups WHERE id = ?')
        .get(groupId);
      if (!group) {
        return res.status(404).json({ error: '未找到该沟通群聊' });
      }

      const { content, sender_member_id = null, sender_name = '' } =
        req.body || {};
      if (!content || !String(content).trim()) {
        return res.status(400).json({ error: '消息内容不能为空' });
      }

      const user = getCurrentUser(req);
      const effectiveMemberId =
        sender_member_id || (user ? user.member_id : null);
      const member = effectiveMemberId
        ? db
            .prepare('SELECT * FROM members WHERE id = ?')
            .get(effectiveMemberId)
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

      db.prepare(
        'INSERT INTO chat_group_messages (id, group_id, sender_user_id, sender_member_id, sender_name, sender_role, avatar_bg, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
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

      const created = db
        .prepare('SELECT * FROM chat_group_messages WHERE id = ?')
        .get(msgId);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/chat-groups/:groupId/messages/:msgId', (req, res) => {
    try {
      db.prepare(
        'DELETE FROM chat_group_messages WHERE id = ? AND group_id = ?'
      ).run(req.params.msgId, req.params.groupId);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 9. Clear workspace data
  app.post('/api/seed/reset', (_req, res) => {
    try {
      clearWorkspaceData(db);
      const payload = getBootstrapData(db);
      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 10. Import JSON backup
  app.post('/api/import', (req, res) => {
    try {
      const { projects, members, tasks } = req.body || {};
      if (
        !Array.isArray(projects) ||
        !Array.isArray(members) ||
        !Array.isArray(tasks)
      ) {
        return res.status(400).json({ error: '导入文件格式不正确' });
      }
      db.exec(
        'DELETE FROM activities; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM members;'
      );

      const insProj = db.prepare(
        'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const p of projects) {
        insProj.run(
          p.id,
          p.name,
          p.code,
          p.color,
          p.description || '',
          p.created_at || new Date().toISOString()
        );
      }

      const insMem = db.prepare(
        'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const m of members) {
        insMem.run(
          m.id,
          m.name,
          m.role,
          m.avatar_bg,
          m.email || '',
          m.capacity_hours || 40
        );
      }

      const insTask = db.prepare(`
        INSERT INTO tasks (
          id, task_key, title, description, project_id, status, priority,
          due_date, assignee_id, collaborator_ids, tags, estimate_hours,
          logged_minutes, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insSub = db.prepare(
        'INSERT INTO subtasks (id, task_id, title, completed, completed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const insAct = db.prepare(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (const t of tasks) {
        const nowISO = new Date().toISOString();
        insTask.run(
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
          insSub.run(
            s.id || crypto.randomUUID(),
            t.id,
            s.title,
            s.completed ? 1 : 0,
            s.completed ? s.completed_at || nowISO : null,
            s.created_at || nowISO
          );
        }
        for (const a of t.activities || []) {
          insAct.run(
            a.id || crypto.randomUUID(),
            t.id,
            a.member_id || null,
            a.type || 'system',
            a.content,
            a.created_at || nowISO
          );
        }
      }

      const payload = getBootstrapData(db);
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 11. AI Assistant Settings (Permanent SQLite persistence)
  app.get('/api/ai/settings', (_req, res) => {
    try {
      res.json(getAiSettings(db));
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.put('/api/ai/settings', (req, res) => {
    try {
      const updated = updateAiSettings(db, req.body || {});
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  // 12. AI Assistant Fetch Models / Test Connection
  app.post('/api/ai/models', async (req, res) => {
    try {
      const saved = getAiSettings(db);
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
  app.get('/api/ai/messages', (_req, res) => {
    try {
      res.json({ messages: getAiMessages(db) });
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) });
    }
  });

  app.delete('/api/ai/messages', (_req, res) => {
    try {
      const messages = clearAiMessages(db);
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
      const user = getCurrentUser(req);
      const visibleProjectIds = user
        ? user.permissions.visible_project_ids
        : 'all';
      const bootstrap = getBootstrapData(db, visibleProjectIds);
      const messages = getAiMessages(db);
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
    db,
    closeDb: () => {
      try {
        db.close();
      } catch {
        // ignore
      }
    },
  };
}
