import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { normalizeOpenAIEndpoint } from '../server/aiService.mjs';
import { startTestApp, setupAdmin, createUserAndLogin } from './helpers.mjs';

// OpenAI-compatible mock; `reply()` returns the {reply, actions} payload for chat calls.
async function startMockOpenAI(t, reply = () => ({ reply: 'ok', actions: [] })) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization || null,
        body: body ? JSON.parse(body) : null,
      });
      if (req.url === '/v1/models' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'deepseek-chat' }] }));
        return;
      }
      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              { message: { role: 'assistant', content: JSON.stringify(reply()) } },
            ],
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, requests };
}

test('normalizeOpenAIEndpoint handles base URLs with or without /v1 and /chat/completions', () => {
  assert.equal(
    normalizeOpenAIEndpoint('https://api.openai.com', 'chat'),
    'https://api.openai.com/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAIEndpoint('https://api.deepseek.com/v1/', 'chat'),
    'https://api.deepseek.com/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAIEndpoint('http://localhost:11434/v1/chat/completions', 'chat'),
    'http://localhost:11434/v1/chat/completions'
  );
  assert.equal(
    normalizeOpenAIEndpoint('https://api.openai.com/v1', 'models'),
    'https://api.openai.com/v1/models'
  );
});

test('AI settings persist in SQLite and /api/ai/chat organizes natural language into projects, members, tasks, and subtasks from a clean DB', async (t) => {
  const mock = await startMockOpenAI(t, () => ({
    reply:
      '已为您整理会议纪要并录入数据库：新建了「海外增长专项」项目、添加了相关人员「陈默」「苏晚晴」「陆景深」，并创建了任务的详细排期与子任务拆解。',
    actions: [
      {
        type: 'create_project',
        name: '海外增长专项',
        code: 'GLB',
        color: '#8b5cf6',
        description: '海外多语种版本与本地化推广',
      },
      { type: 'create_member', name: '陆景深', role: '海外运营负责人', capacity_hours: 40 },
      {
        type: 'create_task',
        title: '上线多语种落地页与 Stripe 支付接入',
        project_name: '海外增长专项',
        assignee_name: '陈默',
        collaborator_names: ['苏晚晴', '陆景深'],
        due_date: '2026-10-26',
        priority: 'urgent',
        status: 'in_progress',
        estimate_hours: 10,
        tags: ['出海', '支付接入'],
        description: '支持英语、日语版本切换并完成支付回调验证',
        subtasks: ['完成多语言 i18n 词条提取', '联调 Stripe Webhook 签名校验'],
      },
    ],
  }));
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);

  // 1. Save AI settings permanently; the key is stored but never echoed back
  const saveCfgRes = await api('PUT', '/api/ai/settings', {
    token,
    body: { base_url: mock.baseUrl, api_key: 'test-dummy-token-0000', model: 'deepseek-chat' },
  });
  assert.equal(saveCfgRes.status, 200);
  assert.equal(saveCfgRes.data.base_url, mock.baseUrl);
  assert.equal(saveCfgRes.data.model, 'deepseek-chat');
  assert.equal(saveCfgRes.data.api_key, '');
  assert.equal(saveCfgRes.data.has_api_key, true);
  assert.equal(saveCfgRes.data.api_key_masked, 'tes••••0000');

  // 2. Test connection / fetch models
  const modelsRes = await api('POST', '/api/ai/models', {
    token,
    body: { base_url: mock.baseUrl, api_key: 'test-dummy-token-0000' },
  });
  assert.equal(modelsRes.status, 200);
  assert.deepEqual(modelsRes.data.models, ['gpt-4o-mini', 'deepseek-chat']);

  // 3. Send natural language command to /api/ai/chat and verify DB ingestion
  const chatRes = await api('POST', '/api/ai/chat', {
    token,
    body: {
      message:
        '新建海外增长专项，添加成员陆景深，让陈默负责在10月26日前完成多语种落地页与Stripe支付接入（苏晚晴和陆景深协助）',
    },
  });
  assert.equal(chatRes.status, 200);
  assert.ok(chatRes.data.assistantMessage.content.includes('海外增长专项'));
  const chatCall = mock.requests.find((r) => r.url === '/v1/chat/completions');
  assert.equal(chatCall.authorization, 'Bearer test-dummy-token-0000');

  const bootData = chatRes.data.bootstrap;
  const createdProj = bootData.projects.find((p) => p.name === '海外增长专项');
  assert.ok(createdProj, 'New project should be persisted in SQLite');
  const createdMember = bootData.members.find((m) => m.name === '陆景深');
  assert.ok(createdMember, 'New member should be persisted in SQLite');
  const createdTask = bootData.tasks.find(
    (t) => t.title === '上线多语种落地页与 Stripe 支付接入'
  );
  assert.ok(createdTask, 'New task should be persisted in SQLite');
  assert.equal(createdTask.project_id, createdProj.id);
  assert.equal(createdTask.due_date, '2026-10-26');
  assert.equal(createdTask.priority, 'urgent');
  assert.equal(createdTask.subtasks.length, 2);
  assert.ok(createdTask.collaborator_ids.includes(createdMember.id));
});

test('AI actions run with the requesting user\'s permissions and only see their projects', async (t) => {
  let nextReply = { reply: 'ok', actions: [] };
  const mock = await startMockOpenAI(t, () => nextReply);
  const { api } = await startTestApp(t);
  const { token: adminToken } = await setupAdmin(api);
  await api('PUT', '/api/ai/settings', {
    token: adminToken,
    body: { base_url: mock.baseUrl, api_key: 'sk-test-key-1234', model: 'gpt-4o-mini' },
  });

  const open = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: '公开项目', code: 'PUB', color: '#6366f1' },
  })).data;
  const secret = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: '机密收购项目', code: 'SEC', color: '#f43f5e' },
  })).data;

  const { token: memberToken } = await createUserAndLogin(api, adminToken, {
    username: 'member1',
    role: 'member',
    permissions: { visible_project_ids: [open.id] },
  });

  nextReply = {
    reply: '已处理',
    actions: [
      { type: 'delete_project', name: '公开项目' },
      { type: 'create_task', title: '偷偷建到机密项目', project_name: '机密收购项目' },
      { type: 'create_task', title: '正常任务', project_name: '公开项目' },
    ],
  };
  const chatRes = await api('POST', '/api/ai/chat', {
    token: memberToken,
    body: { message: '删除公开项目，并在机密收购项目里建任务' },
  });
  assert.equal(chatRes.status, 200);
  assert.match(chatRes.data.assistantMessage.content, /以下操作未执行/);

  // The model never saw the hidden project
  const prompt = mock.requests.at(-1).body.messages[0].content;
  assert.ok(prompt.includes('公开项目'));
  assert.ok(!prompt.includes('机密收购项目'));

  const adminBoot = (await api('GET', '/api/bootstrap', { token: adminToken })).data;
  assert.ok(adminBoot.projects.some((p) => p.id === open.id), 'member cannot delete projects via AI');
  assert.equal(adminBoot.projects.length, 2, 'member cannot create projects via AI');
  assert.ok(!adminBoot.tasks.some((tk) => tk.project_id === secret.id));
  assert.ok(adminBoot.tasks.some((tk) => tk.title === '正常任务' && tk.project_id === open.id));

  // Chat history is private to each account
  const memberHistory = (await api('GET', '/api/ai/messages', { token: memberToken })).data.messages;
  assert.ok(memberHistory.some((m) => m.content.includes('删除公开项目')));
  const adminHistory = (await api('GET', '/api/ai/messages', { token: adminToken })).data.messages;
  assert.ok(!adminHistory.some((m) => m.content.includes('删除公开项目')));
});

test('stored API key is only sent to the endpoint it was saved for', async (t) => {
  const saved = await startMockOpenAI(t);
  const other = await startMockOpenAI(t);
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  await api('PUT', '/api/ai/settings', {
    token,
    body: { base_url: saved.baseUrl, api_key: 'sk-saved-secret', model: 'gpt-4o-mini' },
  });

  const toOther = await api('POST', '/api/ai/models', {
    token,
    body: { base_url: other.baseUrl },
  });
  assert.equal(toOther.status, 200);
  assert.equal(other.requests.at(-1).authorization, null);

  const toSaved = await api('POST', '/api/ai/models', { token, body: {} });
  assert.equal(toSaved.status, 200);
  assert.equal(saved.requests.at(-1).authorization, 'Bearer sk-saved-secret');
});
