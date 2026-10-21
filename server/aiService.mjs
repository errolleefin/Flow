import crypto from 'node:crypto';
import { getTodayISO } from '../src/utils/dateUtils.ts';
import { getFullTaskById } from './db.mjs';

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

export function getAiSettings(db) {
  return db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
}

export function updateAiSettings(db, patch) {
  const current = getAiSettings(db);
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

  db.prepare(
    'UPDATE ai_settings SET base_url = ?, api_key = ?, model = ?, temperature = ?, updated_at = ? WHERE id = 1'
  ).run(nextBaseUrl, nextApiKey, nextModel, nextTemp, nowISO);

  return getAiSettings(db);
}

export function getAiMessages(db) {
  const rows = db
    .prepare('SELECT * FROM ai_messages ORDER BY created_at ASC')
    .all();
  return rows.map((r) => ({
    ...r,
    operations: JSON.parse(r.operations || '[]'),
  }));
}

export function clearAiMessages(db) {
  db.exec('DELETE FROM ai_messages;');
  const nowISO = new Date().toISOString();
  const welcome = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '对话历史已清空。请直接发送新的工作指令或会议纪要，我会自动为您解析并录入数据库！',
    operations: [],
    created_at: nowISO,
  };
  db.prepare(
    'INSERT INTO ai_messages (id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(welcome.id, welcome.role, welcome.content, '[]', welcome.created_at);
  return [welcome];
}

export function buildSystemPrompt(db) {
  const today = getTodayISO();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const [y, m, d] = today.split('-').map(Number);
  const weekdayLabel = weekDays[new Date(y, m - 1, d).getDay()];

  const projects = db
    .prepare('SELECT id, name, code, description FROM projects')
    .all();
  const members = db
    .prepare('SELECT id, name, role, capacity_hours FROM members')
    .all();
  const tasks = db
    .prepare(
      'SELECT id, task_key, title, project_id, status, priority, due_date, assignee_id FROM tasks ORDER BY created_at DESC LIMIT 40'
    )
    .all();

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

function findOrCreateProjectByName(db, projectName, operations) {
  const allProjects = db.prepare('SELECT * FROM projects').all();
  if (!projectName || !String(projectName).trim()) {
    return allProjects[0];
  }
  const clean = String(projectName).trim();
  const exact = allProjects.find(
    (p) =>
      p.name.toLowerCase() === clean.toLowerCase() ||
      p.code.toLowerCase() === clean.toLowerCase()
  );
  if (exact) return exact;

  const partial = allProjects.find(
    (p) =>
      p.name.toLowerCase().includes(clean.toLowerCase()) ||
      clean.toLowerCase().includes(p.name.toLowerCase())
  );
  if (partial) return partial;

  // Auto-create project if not found
  const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
  const code =
    clean
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'PRJ';
  const color = PROJECT_PALETTE[allProjects.length % PROJECT_PALETTE.length];
  const nowISO = new Date().toISOString();

  db.prepare(
    'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, clean, code, color, `由 AI 助理自动创建的项目「${clean}」`, nowISO);

  const created = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  operations.push({
    kind: 'project_created',
    id: created.id,
    title: created.name,
    summary: `新建项目 [${created.code}] ${created.name}`,
  });
  return created;
}

function findOrCreateMemberByName(db, memberName, roleHint, operations) {
  if (!memberName || !String(memberName).trim()) return null;
  const clean = String(memberName).trim();
  const allMembers = db.prepare('SELECT * FROM members').all();
  const found = allMembers.find(
    (m) =>
      m.name.toLowerCase() === clean.toLowerCase() ||
      m.name.toLowerCase().includes(clean.toLowerCase())
  );
  if (found) return found;

  const id = `mem-${crypto.randomUUID().slice(0, 8)}`;
  const avatarBg = AVATAR_PALETTE[allMembers.length % AVATAR_PALETTE.length];
  const role = roleHint || '项目协作成员';

  db.prepare(
    'INSERT INTO members (id, name, role, avatar_bg, email, capacity_hours) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, clean, role, avatarBg, '', 40);

  const created = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  operations.push({
    kind: 'member_created',
    id: created.id,
    title: created.name,
    summary: `新增相关人员：${created.name} (${created.role})`,
  });
  return created;
}

export function executeAiActions(db, actions) {
  const operations = [];
  if (!Array.isArray(actions)) return operations;

  for (const act of actions) {
    if (!act || typeof act !== 'object') continue;
    const type = act.type;
    const nowISO = new Date().toISOString();

    if (type === 'create_project' && act.name) {
      const existing = db
        .prepare('SELECT * FROM projects WHERE LOWER(name) = LOWER(?)')
        .get(String(act.name).trim());
      if (!existing) {
        const count = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
        const id = `proj-${crypto.randomUUID().slice(0, 8)}`;
        const code =
          (act.code && String(act.code).trim().toUpperCase()) ||
          String(act.name).trim().slice(0, 3).toUpperCase();
        const color = act.color || PROJECT_PALETTE[count % PROJECT_PALETTE.length];
        db.prepare(
          'INSERT INTO projects (id, name, code, color, description, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          id,
          String(act.name).trim(),
          code,
          color,
          act.description || '',
          nowISO
        );
        operations.push({
          kind: 'project_created',
          id,
          title: String(act.name).trim(),
          summary: `新建项目 [${code}] ${String(act.name).trim()}`,
        });
      }
    } else if (type === 'create_member' && act.name) {
      findOrCreateMemberByName(db, act.name, act.role, operations);
    } else if (type === 'create_task' && act.title) {
      const proj = findOrCreateProjectByName(
        db,
        act.project_name || act.project,
        operations
      );
      const assignee = act.assignee_name
        ? findOrCreateMemberByName(db, act.assignee_name, null, operations)
        : null;

      const collabIds = [];
      if (Array.isArray(act.collaborator_names)) {
        for (const cName of act.collaborator_names) {
          const mem = findOrCreateMemberByName(db, cName, null, operations);
          if (mem && !collabIds.includes(mem.id)) {
            collabIds.push(mem.id);
          }
        }
      }

      const existingCount = db
        .prepare('SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?')
        .get(proj.id);
      const nextNum = 101 + (existingCount?.cnt || 0) + operations.length;
      const taskKey = `${proj.code}-${nextNum}`;
      const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM tasks').get();
      const position = (maxPosRow?.maxPos || 0) + 1;
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

      db.prepare(`
        INSERT INTO tasks (
          id, task_key, title, description, project_id, status, priority,
          due_date, assignee_id, collaborator_ids, tags, estimate_hours,
          logged_minutes, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
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

      db.prepare(
        'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        taskId,
        assignee ? assignee.id : null,
        'system',
        `由 AI 智能助理整理录入任务 [${taskKey}]`,
        nowISO
      );

      let subCount = 0;
      if (Array.isArray(act.subtasks)) {
        const insSub = db.prepare(
          'INSERT INTO subtasks (id, task_id, title, completed, created_at) VALUES (?, ?, ?, 0, ?)'
        );
        for (const subTitle of act.subtasks) {
          if (subTitle && String(subTitle).trim()) {
            insSub.run(crypto.randomUUID(), taskId, String(subTitle).trim(), nowISO);
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
        existing = db
          .prepare('SELECT * FROM tasks WHERE UPPER(task_key) = UPPER(?)')
          .get(String(act.task_key).trim());
      }
      if (!existing && act.title) {
        existing = db
          .prepare('SELECT * FROM tasks WHERE title LIKE ?')
          .get(`%${String(act.title).trim()}%`);
      }
      if (existing) {
        const nextTitle = act.new_title || existing.title;
        const nextStatus = act.status || existing.status;
        const nextPriority = act.priority || existing.priority;
        const nextDueDate =
          act.due_date !== undefined ? act.due_date : existing.due_date;
        const nextProject = act.project_name
          ? findOrCreateProjectByName(db, act.project_name, operations)
          : null;
        const nextAssignee = act.assignee_name
          ? findOrCreateMemberByName(db, act.assignee_name, null, operations)
          : null;

        let nextCollabJson = existing.collaborator_ids;
        if (Array.isArray(act.collaborator_names)) {
          const ids = [];
          for (const cn of act.collaborator_names) {
            const m = findOrCreateMemberByName(db, cn, null, operations);
            if (m) ids.push(m.id);
          }
          nextCollabJson = JSON.stringify(ids);
        }

        db.prepare(`
          UPDATE tasks SET
            title = ?,
            status = ?,
            priority = ?,
            due_date = ?,
            project_id = ?,
            assignee_id = ?,
            collaborator_ids = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
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

        db.prepare(
          'INSERT INTO activities (id, task_id, member_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          existing.id,
          existing.assignee_id,
          'system',
          `AI 助理更新了任务属性 (状态: ${nextStatus}, 截止: ${nextDueDate || '未排期'})`,
          nowISO
        );

        const updatedFull = getFullTaskById(db, existing.id);
        operations.push({
          kind: 'task_updated',
          id: existing.id,
          task_key: existing.task_key,
          title: updatedFull.title,
          due_date: updatedFull.due_date || '未排期',
          summary: `更新任务 [${existing.task_key}] ${updatedFull.title} -> 状态: ${updatedFull.status}`,
        });
      }
    } else if (type === 'delete_task' && act.task_key) {
      const existing = db
        .prepare('SELECT * FROM tasks WHERE UPPER(task_key) = UPPER(?)')
        .get(String(act.task_key).trim());
      if (existing) {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(existing.id);
        operations.push({
          kind: 'task_deleted',
          id: existing.id,
          task_key: existing.task_key,
          title: existing.title,
          summary: `删除任务 [${existing.task_key}] ${existing.title}`,
        });
      }
    }
  }

  return operations;
}

export async function processAiChat(db, userMessage) {
  const settings = getAiSettings(db);
  if (!settings.base_url || !settings.model) {
    throw new Error('请先在 AI 助理配置中填写 Base URL 与模型名称 (Model)');
  }

  const nowISO = new Date().toISOString();
  const userMsgId = crypto.randomUUID();
  db.prepare(
    'INSERT INTO ai_messages (id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(userMsgId, 'user', String(userMessage).trim(), '[]', nowISO);

  const recentMessages = db
    .prepare(
      'SELECT role, content FROM ai_messages ORDER BY created_at DESC LIMIT 8'
    )
    .all()
    .reverse();

  const endpoint = normalizeOpenAIEndpoint(settings.base_url, 'chat');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (settings.api_key && settings.api_key.trim()) {
    headers['Authorization'] = `Bearer ${settings.api_key.trim()}`;
  }

  const apiMessages = [
    { role: 'system', content: buildSystemPrompt(db) },
    ...recentMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: settings.model,
      messages: apiMessages,
      temperature: Number(settings.temperature ?? 0.2),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `AI 接口请求失败 (HTTP ${response.status}): ${errText.slice(0, 240) || response.statusText}`
    );
  }

  const data = await response.json();
  const rawContent = data?.choices?.[0]?.message?.content || '';
  const parsed = parseAiJsonResponse(rawContent);
  const operations = executeAiActions(db, parsed.actions);

  const assistantMsg = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: parsed.reply,
    operations,
    created_at: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO ai_messages (id, role, content, operations, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(
    assistantMsg.id,
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

  const res = await fetch(endpoint, {
    method: 'GET',
    headers,
  });

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
