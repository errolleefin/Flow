import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server/app.mjs';
import { normalizeOpenAIEndpoint } from '../server/aiService.mjs';

const TEST_AI_DB_PATH = path.resolve('data/test-ai-flow.sqlite');

function cleanupTestDb() {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = `${TEST_AI_DB_PATH}${suffix}`;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  }
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
  cleanupTestDb();

  // Create a local mock OpenAI-compatible server
  const mockOpenAIServer = http.createServer((req, res) => {
    if (req.url === '/v1/models' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: [{ id: 'gpt-4o-mini' }, { id: 'deepseek-chat' }],
        })
      );
      return;
    }

    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const aiPayload = {
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
            {
              type: 'create_member',
              name: '陆景深',
              role: '海外运营负责人',
              capacity_hours: 40,
            },
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
        };

        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: JSON.stringify(aiPayload),
                },
              },
            ],
          })
        );
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => mockOpenAIServer.listen(0, '127.0.0.1', resolve));
  const mockPort = mockOpenAIServer.address().port;
  const mockBaseUrl = `http://127.0.0.1:${mockPort}/v1`;

  const { app, closeDb } = createApp(TEST_AI_DB_PATH);
  const server = app.listen(0);
  const appPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${appPort}`;

  t.after(() => {
    mockOpenAIServer.close();
    server.close();
    closeDb();
    cleanupTestDb();
  });

  // 1. Save AI settings permanently
  const saveCfgRes = await fetch(`${baseUrl}/api/ai/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_url: mockBaseUrl,
      api_key: 'test-dummy-token-0000',
      model: 'deepseek-chat',
    }),
  });
  assert.equal(saveCfgRes.status, 200);
  const savedCfg = await saveCfgRes.json();
  assert.equal(savedCfg.base_url, mockBaseUrl);
  assert.equal(savedCfg.model, 'deepseek-chat');
  assert.equal(savedCfg.api_key, 'test-dummy-token-0000');

  // 2. Test connection / fetch models
  const modelsRes = await fetch(`${baseUrl}/api/ai/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_url: mockBaseUrl,
      api_key: 'test-dummy-token-0000',
    }),
  });
  assert.equal(modelsRes.status, 200);
  const modelsData = await modelsRes.json();
  assert.deepEqual(modelsData.models, ['gpt-4o-mini', 'deepseek-chat']);

  // 3. Send natural language command to /api/ai/chat and verify DB ingestion
  const chatRes = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message:
        '新建海外增长专项，添加成员陆景深，让陈默负责在10月26日前完成多语种落地页与Stripe支付接入（苏晚晴和陆景深协助）',
    }),
  });
  assert.equal(chatRes.status, 200);
  const chatData = await chatRes.json();
  assert.ok(chatData.assistantMessage.content.includes('海外增长专项'));

  // Verify database state in bootstrap was actually updated!
  const bootData = chatData.bootstrap;
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
