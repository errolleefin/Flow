import crypto from 'node:crypto';
import { getTodayISO } from '../src/utils/dateUtils.ts';
import {
  getFullTaskById,
  canSeeProject,
  grantProjectVisibility,
} from './db.mjs';

const AI_CHAT_TIMEOUT_MS = 90 * 1000;
const AI_MODELS_TIMEOUT_MS = 15 * 1000;

const WELCOME_MESSAGE =
  '你好！我是 **Flow AI 智能助理**。你可以先在右上角「接口配置」中永久保存你的 OpenAI 兼容 API（支持 OpenAI、DeepSeek、硅基流动、OpenRouter、阿里云百炼、本地 Ollama 等），然后直接用自然语言向我发送任务指令或粘贴会议纪要，我会自动为你提取 **任务名称、所属项目、截止日期、相关人员（主负责与协作人）、优先级与子任务清单** 并录入数据库！';

// Each action needs the same permission as its REST counterpart.
const ACTION_PERMISSIONS = {
  create_project: 'can_create_project',
  update_project: 'can_edit_project',
  delete_project: 'can_delete_project',
  create_member: 'can_manage_members',
  update_member: 'can_manage_members',
  delete_member: 'can_manage_members',
  create_task: 'can_create_task',
  update_task: 'can_edit_task',
  delete_task: 'can_delete_task',
};

const ACTION_LABELS = {
  create_project: '新建项目',
  update_project: '编辑项目',
  delete_project: '删除项目',
  create_member: '新增成员',
  update_member: '编辑成员',
  delete_member: '删除成员',
  create_task: '创建任务',
  update_task: '更新任务',
  delete_task: '删除任务',
};

const PROJECT_PALETTE = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
];

const AVATAR_PALETTE = [
  'from-indigo-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-cyan-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-violet-600',
];

function escapeLike(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new Error('AI 接口请求超时，请稍后重试或检查接口配置');
    }
    throw err;
  }
}

export function normalizeOpenAIEndpoint(baseUrl, type = 'chat') {
  const raw = String(baseUrl || 'https://api.openai.com/v1')
    .trim()
    .replace(/\/+$/, '');

  if (type === 'chat') {
    if (raw.endsWith('/chat/completions')) return raw;
    if (/\/v\d+$/.test(raw)) return `${raw}/chat/completions`;
    return `${raw}/v1/chat/completions`;
  }

  if (type === 'models') {
    const withoutChat = raw.replace(/\/chat\/completions$/, '');
    if (withoutChat.endsWith('/models')) return withoutChat;
    if (/\/v\d+$/.test(withoutChat)) return `${withoutChat}/models`;
    return `${withoutChat}/v1/models`;
  }

  return raw;
}

export async function getAiSettings(db) {
  return db.get('SELECT * FROM ai_settings WHERE id = 1');
}

export async function updateAiSettings(db, patch) {
  const current = await getAiSettings(db);
  const nextBaseUrl =
    patch.base_url !== undefined
      ? String(patch.base_url).trim()
      : current.base_url;
  const nextApiKey =
    patch.api_key !== undefined ? String(patch.api_key).trim() : current.api_key;
  const nextModel =
    patch.model !== undefined ? String(patch.model).trim() : current.model;
  const nextTemp =
    patch.temperature !== undefined
      ? Number(patch.temperature)
      : current.temperature;
  const nowISO = new Date().toISOString();

  await db.run(
    'UPDATE ai_settings SET base_url = ?, api_key = ?, model = ?, temperature = ?, updated_at = ? WHERE id = 1',
    nextBaseUrl,
    nextApiKey,
    nextModel,
    nextTemp,
    nowISO
  );

  return getAiSettings(db);
}

// History is per account; legacy rows without an owner are shown to admins only.
export async function getAiMessages(db, user) {
  const rows = await db.all(
    'SELECT * FROM ai_messages WHERE user_id = ? OR (user_id IS NULL AND ?) ORDER BY created_at ASC',
    user.id,
    user.role === 'admin'
  );
  if (rows.length === 0) {
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: WELCOME_MESSAGE,
        operations: [],
        created_at: new Date().toISOString(),
      },
    ];
  }
  return rows.map((r) => ({
    ...r,
    operations: JSON.parse(r.operations || '[]'),
  }));
}

export async function clearAiMessages(db, user) {
  await db.run(
    'DELETE FROM ai_messages WHERE user_id = ? OR (user_id IS NULL AND ?)',
    user.id,
    user.role === 'admin'
  );
  const nowISO = new Date().toISOString();
  const welcome = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '对话历史已清空。请直接发送新的工作指令或会议纪要，我会自动为您解析并录入数据库！',
    operations: [],
    created_at: nowISO,
  };
  await db.run(
    'INSERT INTO ai_messages (id, user_id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    welcome.id,
    user.id,
    welcome.role,
    welcome.content,
    '[]',
    welcome.created_at
  );
  return [welcome];
}

// Only data the user may see is shown to the model.
export async function buildSystemPrompt(db, user) {
  const today = getTodayISO();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const [y, m, d] = today.split('-').map(Number);
  const weekdayLabel = weekDays[new Date(y, m - 1, d).getDay()];

  const projects = (
    await db.all('SELECT id, name, code, description FROM projects')
  ).filter((p) => canSeeProject(user, p.id));
  const members = await db.all(
    'SELECT id, name, role, capacity_hours FROM members'
  );
  const tasks = (
    await db.all(
      'SELECT id, task_key, title, project_id, status, priority, due_date, assignee_id FROM tasks ORDER BY created_at DESC'
    )
  )
    .filter((t) => canSeeProject(user, t.project_id))
    .slice(0, 40);

  const projMap = new Map(projects.map((p) => [p.id, p.name]));
  const memMap = new Map(members.map((mem) => [mem.id, mem.name]));

  const tasksSummary = tasks.map((t) => ({
    task_key: t.task_key,
    title: t.title,
    project: projMap.get(t.project_id) || t.project_id,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    assignee: memMap.get(t.assignee_id) || '未指派',
  }));

  return `你是 Flow 的 AI 数据库管理与工作流助理。
你的核心职责是：理解用户的自然语言指令、会议纪要、待办清单或状态更新要求，整理出结构化的数据库变更动作（actions），并用简洁专业的中文回复用户。

【当前时间基准】
- 今天日期：${today} (${weekdayLabel})
- 请根据今天日期，把用户提到的相对时间（如“今天”、“明天”、“后天”、“本周五”、“下周三”、“3天后”）精确换算为 YYYY-MM-DD 格式的 due_date。

【当前数据库已有项目 (projects)】
${JSON.stringify(projects, null, 2)}

【当前数据库已有相关人员 (members)】
${JSON.stringify(members, null, 2)}

【当前数据库已有任务摘要 (tasks)】
${JSON.stringify(tasksSummary, null, 2)}

【输出格式要求（极其重要）】
你必须且只能输出一个合法的 JSON 对象（不要加任何多余的前后缀文本），结构如下：
{
  "reply": "向用户汇报你理解并已执行录入的事项总结（支持 Markdown）",
  "actions": [
    // 按执行顺序排列的操作数组，如果用户只是提问不涉及修改数据库，actions 传空数组 []
  ]
}

【支持的 action 类型规范】
1. 新建项目 (create_project)：当用户明确要求新建项目，或任务所属的项目不在已有列表中时使用：
{
  "type": "create_project",
  "name": "项目名称",
  "code": "2~4位大写英文前缀，如 GLB、SEC",
  "color": "#6366f1",
  "description": "项目说明"
}

2. 新增团队相关人员 (create_member)：当用户提到新同事姓名且不在已有成员列表中时使用：
{
  "type": "create_member",
  "name": "姓名",
  "role": "角色职位（如 后端工程师、产品经理）",
  "capacity_hours": 40
}

3. 创建任务 (create_task)：提取任务名称、项目名、截止日期、主负责人、协同参与人员、优先级、工时、标签与拆解的子任务：
{
  "type": "create_task",
  "title": "任务名称",
  "description": "任务背景或补充说明",
  "project_name": "所属项目名称（优先匹配已有项目名，或是新项目名）",
  "assignee_name": "主负责人姓名（可为空）",
  "collaborator_names": ["协同人员姓名1", "协同人员姓名2"],
  "due_date": "YYYY-MM-DD 或 null",
  "priority": "urgent | high | medium | low",
  "status": "backlog | todo | in_progress | review | done",
  "estimate_hours": 4,
  "tags": ["标签1", "标签2"],
  "subtasks": ["子任务1", "子任务2"]
}

4. 更新已有任务 (update_task)：通过 task_key（如 "AI-101"）或 title 匹配已有任务并修改其属性：
{
  "type": "update_task",
  "task_key": "AI-101",
  "title": "可选：修改后的标题",
  "status": "可选：backlog | todo | in_progress | review | done",
  "priority": "可选：urgent | high | medium | low",
  "due_date": "可选：YYYY-MM-DD 或 null",
  "project_name": "可选：迁移到的项目名称",
  "assignee_name": "可选：改派的主负责人姓名",
  "collaborator_names": ["可选：更新后的协同人员姓名数组"],
  "estimate_hours": 6
}

5. 删除任务 (delete_task)：
{
  "type": "delete_task",
  "task_key": "AI-101"
}

6. 编辑或删除项目 (update_project / delete_project)：
{
  "type": "update_project",
  "name": "原项目名称",
  "new_name": "新项目名称",
  "code": "新前缀",
  "description": "新说明"
}
{
  "type": "delete_project",
  "name": "要删除的项目名称"
}

7. 编辑或删除成员 (update_member / delete_member)：
{
  "type": "update_member",
  "name": "原成员姓名",
  "new_name": "可选新姓名",
  "role": "可选新职位角色",
  "capacity_hours": 36
}
{
  "type": "delete_member",
  "name": "要删除的成员姓名"
}`;
}

export function parseAiJsonResponse(rawContent) {
  const text = String(rawContent || '').trim();
  if (!text) {
    return { reply: '未收到有效回复', actions: [] };
  }

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return {
        reply: String(parsed.reply || '已完成操作。'),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    // Try extracting from ```json ... ``` or first { ... }
  }

  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      return {
        reply: String(parsed.reply || '已完成操作。'),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    } catch {
      // ignore
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
      return {
        reply: String(parsed.reply || '已完成操作。'),
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    } catch {
      // ignore
    }
  }

  return {
    reply: text,
    actions: [],
  };
}

// Matches only projects the user can see, and creates one only when the user
// may create projects; returns null otherwise.
async function findOrCreateProjectByName(db, projectName, operations, user) {
  const allProjects = await db.all('SELECT * FROM projects');
  const visibleProjects = allProjects.filter((p) => canSeeProject(user, p.id));
  const hasName = Boolean(projectName && String(projectName).trim());
  if (!hasName && visibleProjects.length > 0) {
    return visibleProjects[0];
  }
  const clean = hasName ? String(projectName).trim() : '默认工作项目';
  if (hasName) {
    const exact = visibleProjects.find(
      (p) =>
        p.name.toLowerCase() === clean.toLowerCase() ||
        p.code.toLowerCase() === clean.toLowerCase()
    );
    if (exact) return exact;

    const partial = visibleProjects.find(
      (p) =>
        p.name.toLowerCase().includes(clean.toLowerCase()) ||
        clean.toLowerCase().includes(p.name.toLowerCase())
    );
    if (partial) return partial;
  }
  if (!user.permissions.can_create_project) return null;

  // Auto-create project if not found
  const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
  const code =
    clean
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRJ';
  const color = PROJECT_PALETTE[allProjects.length % PROJECT_PALETTE.length];
  const nowISO = new Date().toISOString();

  await db.run(
    'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    clean,
    code,
    color,
    `由 AI 助理自动创建的项目「${clean}」`,
    nowISO
  );
  await grantProjectVisibility(db, user, id);

  const created = await db.get('SELECT * FROM projects WHERE id = ?', id);
  operations.push({
    kind: 'project_created',
    id: created.id,
    title: created.name,
    summary: `新建项目 [${created.code}] ${created.name}`,
  });
  return created;
}

async function findOrCreateMemberByName(
  db,
  memberName,
  roleHint,
  operations,
  allowCreate
) {
  if (!memberName || !String(memberName).trim()) return null;
  const clean = String(memberName).trim();
  const allMembers = await db.all('SELECT * FROM members');
  const found = allMembers.find(
    (m) =>
      m.name.toLowerCase() === clean.toLowerCase() ||
      m.name.toLowerCase().includes(clean.toLowerCase())
  );
  if (found) return found;
  if (!allowCreate) return null;

  const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const avatarBg = AVATAR_PALETTE[allMembers.length % AVATAR_PALETTE.length];
  const role = roleHint || '项目协作成员';

  await db.run(
    'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    clean,
    role,
    avatarBg,
    '',
    40
  );

  const created = await db.get('SELECT * FROM members WHERE id = ?', id);
  operations.push({
    kind: 'member_created',
    id: created.id,
    title: created.name,
    summary: `新增相关人员：${created.name} (${created.role})`,
  });
  return created;
}

// Applies model-proposed actions with the requesting user's permissions and
// project visibility; anything not allowed is reported in `skipped`.
export async function executeAiActions(db, actions, user) {
  const operations = [];
  const skipped = [];
  if (!Array.isArray(actions)) return { operations, skipped };
  const canCreateMembers = Boolean(user.permissions.can_manage_members);
  const skip = (act, reason) => {
    const target = act.title || act.name || act.task_key;
    skipped.push(
      `${ACTION_LABELS[act.type]}${target ? `「${target}」` : ''}：${reason}`
    );
  };

  for (const act of actions) {
    if (!act || typeof act !== 'object') continue;
    const type = act.type;
    const nowISO = new Date().toISOString();
    if (!ACTION_PERMISSIONS[type]) continue;
    if (!user.permissions[ACTION_PERMISSIONS[type]]) {
      skip(act, '当前账号无此操作权限');
      continue;
    }

    if (type === 'create_project' && act.name) {
      const existing = await db.get(
        'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)',
        String(act.name).trim()
      );
      if (!existing) {
        const count = Number(
          (await db.get('SELECT COUNT(*) as cnt FROM projects')).cnt
        );
        const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
        const code =
          (act.code && String(act.code).trim().toUpperCase()) ||
          String(act.name).trim().slice(0, 3).toUpperCase();
        const color = act.color || PROJECT_PALETTE[count % PROJECT_PALETTE.length];
        await db.run(
          'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          id,
          String(act.name).trim(),
          code,
          color,
          act.description || '',
          nowISO
        );
        await grantProjectVisibility(db, user, id);
        operations.push({
          kind: 'project_created',
          id,
          title: String(act.name).trim(),
          summary: `新建项目 [${code}] ${String(act.name).trim()}`,
        });
      }
    } else if (type === 'create_member' && act.name) {
      await findOrCreateMemberByName(db, act.name, act.role, operations, true);
    } else if (type === 'create_task' && act.title) {
      const proj = await findOrCreateProjectByName(
        db,
        act.project_name || act.project,
        operations,
        user
      );
      if (!proj) {
        skip(act, '没有可用的项目');
        continue;
      }
      const assignee = act.assignee_name
        ? await findOrCreateMemberByName(
            db,
            act.assignee_name,
            null,
            operations,
            canCreateMembers
          )
        : null;

      const collabIds = [];
      if (Array.isArray(act.collaborator_names)) {
        for (const cName of act.collaborator_names) {
          const mem = await findOrCreateMemberByName(
            db,
            cName,
            null,
            operations,
            canCreateMembers
          );
          if (mem && !collabIds.includes(mem.id)) {
            collabIds.push(mem.id);
          }
        }
      }

      const existingCount = await db.get(
        'SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?',
        proj.id
      );
      const nextNum =
        101 + (Number(existingCount?.cnt) || 0) + operations.length;
      const taskKey = `${proj.code}-${nextNum}`;
      const maxPosRow = await db.get(
        'SELECT MAX(position) as maxPos FROM tasks'
      );
      const position = (Number(maxPosRow?.maxPos) || 0) + 1;
      const taskId = `task-${crypto.randomUUID().slice(0, 8)}`;

      const status = ['backlog', 'todo', 'in_progress', 'review', 'done'].includes(
        act.status
      )
        ? act.status
        : 'todo';
      const priority = ['urgent', 'high', 'medium', 'low'].includes(act.priority)
        ? act.priority
        : 'medium';
      const dueDate =
        act.due_date && String(act.due_date).trim() !== 'null'
          ? String(act.due_date).trim()
          : null;
      const tags = Array.isArray(act.tags) ? act.tags.map(String) : ['AI录入'];
      const estimateHours = Number(act.estimate_hours) || 4;

      await db.run(
        `INSERT INTO tasks (
          id, task_key, title, description, project_id, status, priority,
          due_date, assignee_id, collaborator_ids, tags, estimate_hours,
          logged_minutes, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
        taskId,
        taskKey,
        String(act.title).trim(),
        act.description || '',
        proj.id,
        status,
        priority,
        dueDate,
        assignee ? assignee.id : null,
        JSON.stringify(collabIds),
        JSON.stringify(tags),
        estimateHours,
        position,
        nowISO,
        nowISO
      );

      await db.run(
        'INSERT INTO activities (id, task_id, member_id, actor_name, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        taskId,
        user.member_id || null,
        user.display_name,
        'system',
        `由 AI 智能助理整理录入任务 [${taskKey}]`,
        nowISO
      );

      let subCount = 0;
      if (Array.isArray(act.subtasks)) {
        for (const subTitle of act.subtasks) {
          if (subTitle && String(subTitle).trim()) {
            await db.run(
              'INSERT INTO subtasks (id, task_id, title, completed, created_at) VALUES (?, ?, ?, FALSE, ?)',
              crypto.randomUUID(),
              taskId,
              String(subTitle).trim(),
              nowISO
            );
            subCount++;
          }
        }
      }

      operations.push({
        kind: 'task_created',
        id: taskId,
        task_key: taskKey,
        title: String(act.title).trim(),
        project_name: proj.name,
        assignee_name: assignee ? assignee.name : '未指派',
        due_date: dueDate || '未排期',
        subtask_count: subCount,
        summary: `录入任务 [${taskKey}] ${String(act.title).trim()}（项目：${proj.name}，负责人：${assignee ? assignee.name : '未指派'}，截止：${dueDate || '未排期'}）`,
      });
    } else if (type === 'update_task') {
      let existing = null;
      if (act.task_key) {
        existing = await db.get(
          'SELECT * FROM tasks WHERE UPPER(task_key) = UPPER(?)',
          String(act.task_key).trim()
        );
      }
      if (!existing && act.title) {
        existing = await db.get(
          "SELECT * FROM tasks WHERE LOWER(title) LIKE ? ESCAPE '\\'",
          `%${escapeLike(String(act.title).trim().toLowerCase())}%`
        );
      }
      if (existing && !canSeeProject(user, existing.project_id)) {
        existing = null;
      }
      if (!existing) {
        skip(act, '未找到该任务');
        continue;
      }
      const nextTitle = act.new_title || existing.title;
      const nextStatus = act.status || existing.status;
      const nextPriority = act.priority || existing.priority;
      const nextDueDate =
        act.due_date !== undefined ? act.due_date : existing.due_date;
      const nextProject = act.project_name
        ? await findOrCreateProjectByName(
            db,
            act.project_name,
            operations,
            user
          )
        : null;
      if (act.project_name && !nextProject) {
        skip(act, '没有可用的目标项目');
        continue;
      }
      const nextAssignee = act.assignee_name
        ? await findOrCreateMemberByName(
            db,
            act.assignee_name,
            null,
            operations,
            canCreateMembers
          )
        : null;

      let nextCollabJson = existing.collaborator_ids;
      if (Array.isArray(act.collaborator_names)) {
        const ids = [];
        for (const cn of act.collaborator_names) {
          const m = await findOrCreateMemberByName(
            db,
            cn,
            null,
            operations,
            canCreateMembers
          );
          if (m) ids.push(m.id);
        }
        nextCollabJson = JSON.stringify(ids);
      }

      await db.run(
        `UPDATE tasks SET
          title = ?,
          status = ?,
          priority = ?,
          due_date = ?,
          project_id = ?,
          assignee_id = ?,
          collaborator_ids = ?,
          updated_at = ?
        WHERE id = ?`,
        nextTitle,
        nextStatus,
        nextPriority,
        nextDueDate,
        nextProject ? nextProject.id : existing.project_id,
        nextAssignee ? nextAssignee.id : existing.assignee_id,
        nextCollabJson,
        nowISO,
        existing.id
      );

      await db.run(
        'INSERT INTO activities (id, task_id, member_id, actor_name, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        crypto.randomUUID(),
        existing.id,
        user.member_id || null,
        user.display_name,
        'system',
        `AI 助理更新了任务属性 (状态: ${nextStatus}, 截止: ${nextDueDate || '未排期'})`,
        nowISO
      );

      const updatedFull = await getFullTaskById(db, existing.id);
      operations.push({
        kind: 'task_updated',
        id: existing.id,
        task_key: existing.task_key,
        title: updatedFull.title,
        due_date: updatedFull.due_date || '未排期',
        summary: `更新任务 [${existing.task_key}] ${updatedFull.title} -> 状态: ${updatedFull.status}`,
      });
    } else if (type === 'delete_task' && act.task_key) {
      const existing = await db.get(
        'SELECT * FROM tasks WHERE UPPER(task_key) = UPPER(?)',
        String(act.task_key).trim()
      );
      if (!existing || !canSeeProject(user, existing.project_id)) {
        skip(act, '未找到该任务');
        continue;
      }
      await db.run('DELETE FROM tasks WHERE id = ?', existing.id);
      operations.push({
        kind: 'task_deleted',
        id: existing.id,
        task_key: existing.task_key,
        title: existing.title,
        summary: `删除任务 [${existing.task_key}] ${existing.title}`,
      });
    } else if (type === 'update_project' && act.name) {
      const existing = await db.get(
        'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)',
        String(act.name).trim()
      );
      if (!existing || !canSeeProject(user, existing.id)) {
        skip(act, '未找到该项目');
        continue;
      }
      const nextName = act.new_name ? String(act.new_name).trim() : existing.name;
      const nextCode = act.code ? String(act.code).trim().toUpperCase() : existing.code;
      const nextDesc = act.description !== undefined ? String(act.description) : existing.description;
      await db.run(
        'UPDATE projects SET name = ?, code = ?, description = ? WHERE id = ?',
        nextName,
        nextCode,
        nextDesc,
        existing.id
      );
      operations.push({
        kind: 'project_created',
        id: existing.id,
        title: nextName,
        summary: `已更新项目 [${nextCode}] ${nextName}`,
      });
    } else if (type === 'delete_project' && act.name) {
      const existing = await db.get(
        'SELECT * FROM projects WHERE LOWER(name) = LOWER(?)',
        String(act.name).trim()
      );
      if (!existing || !canSeeProject(user, existing.id)) {
        skip(act, '未找到该项目');
        continue;
      }
      await db.run('DELETE FROM projects WHERE id = ?', existing.id);
      operations.push({
        kind: 'task_deleted',
        id: existing.id,
        title: existing.name,
        summary: `已删除项目「${existing.name}」`,
      });
    } else if (type === 'update_member' && act.name) {
      const existing = await db.get(
        'SELECT * FROM members WHERE LOWER(name) = LOWER(?)',
        String(act.name).trim()
      );
      if (existing) {
        const nextName = act.new_name ? String(act.new_name).trim() : existing.name;
        const nextRole = act.role ? String(act.role).trim() : existing.role;
        const nextCap = act.capacity_hours ? Number(act.capacity_hours) : existing.capacity_hours;
        await db.run(
          'UPDATE members SET name = ?, role = ?, capacity_hours = ? WHERE id = ?',
          nextName,
          nextRole,
          nextCap,
          existing.id
        );
        operations.push({
          kind: 'member_created',
          id: existing.id,
          title: nextName,
          summary: `已更新成员：${nextName} (${nextRole}, ${nextCap}h/周)`,
        });
      }
    } else if (type === 'delete_member' && act.name) {
      const existing = await db.get(
        'SELECT * FROM members WHERE LOWER(name) = LOWER(?)',
        String(act.name).trim()
      );
      if (existing) {
        await db.run(
          'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = ?',
          existing.id
        );
        const allTasks = await db.all('SELECT id, collaborator_ids FROM tasks');
        for (const t of allTasks) {
          const list = JSON.parse(t.collaborator_ids || '[]');
          if (Array.isArray(list) && list.includes(existing.id)) {
            await db.run(
              'UPDATE tasks SET collaborator_ids = ? WHERE id = ?',
              JSON.stringify(list.filter((id) => id !== existing.id)),
              t.id
            );
          }
        }
        await db.run('DELETE FROM members WHERE id = ?', existing.id);
        operations.push({
          kind: 'task_deleted',
          id: existing.id,
          title: existing.name,
          summary: `已移除团队成员「${existing.name}」`,
        });
      }
    }
  }

  return { operations, skipped };
}

export async function processAiChat(db, userMessage, user) {
  const settings = await getAiSettings(db);
  if (!settings.base_url || !settings.model) {
    throw new Error('请先在 AI 助理配置中填写 Base URL 与模型名称 (Model)');
  }

  const nowISO = new Date().toISOString();
  const userMsgId = crypto.randomUUID();
  await db.run(
    'INSERT INTO ai_messages (id, user_id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    userMsgId,
    user.id,
    'user',
    String(userMessage).trim(),
    '[]',
    nowISO
  );

  const recentMessages = (
    await db.all(
      'SELECT role, content FROM ai_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 8',
      user.id
    )
  ).reverse();

  const endpoint = normalizeOpenAIEndpoint(settings.base_url, 'chat');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (settings.api_key && settings.api_key.trim()) {
    headers['Authorization'] = `Bearer ${settings.api_key.trim()}`;
  }

  const apiMessages = [
    { role: 'system', content: await buildSystemPrompt(db, user) },
    ...recentMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: settings.model,
        messages: apiMessages,
        temperature: Number(settings.temperature ?? 0.2),
      }),
    },
    AI_CHAT_TIMEOUT_MS
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `AI 接口请求失败 (HTTP ${response.status}): ${errText.slice(0, 240) || response.statusText}`
    );
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content || '';
  const parsed = parseAiJsonResponse(rawContent);
  const { operations, skipped } = await db.transaction((tx) =>
    executeAiActions(tx, parsed.actions, user)
  );
  const reply =
    skipped.length > 0
      ? `${parsed.reply}\n\n⚠️ 以下操作未执行：\n${skipped
          .map((item) => `- ${item}`)
          .join('\n')}`
      : parsed.reply;

  const assistantMsg = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: reply,
    operations,
    created_at: new Date().toISOString(),
  };

  await db.run(
    'INSERT INTO ai_messages (id, user_id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    assistantMsg.id,
    user.id,
    assistantMsg.role,
    assistantMsg.content,
    JSON.stringify(operations),
    assistantMsg.created_at
  );

  return assistantMsg;
}

export async function fetchOpenAIModels(baseUrl, apiKey) {
  const endpoint = normalizeOpenAIEndpoint(baseUrl, 'models');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey && String(apiKey).trim()) {
    headers['Authorization'] = `Bearer ${String(apiKey).trim()}`;
  }

  const res = await fetchWithTimeout(
    endpoint,
    { method: 'GET', headers },
    AI_MODELS_TIMEOUT_MS
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `连接失败 (HTTP ${res.status}): ${errText.slice(0, 180) || res.statusText}`
    );
  }

  const data = await res.json();
  const list = Array.isArray(data?.data)
    ? data.data.map((m) => m.id).filter(Boolean)
    : [];
  return list;
}
