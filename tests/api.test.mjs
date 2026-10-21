import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/app.mjs';

const TEST_DB_PATH = path.resolve('data/test-flow.sqlite');

function cleanupTestDb() {
  for (const suffix of ['', '-shm', '-wal']) {
    const p = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore lock during teardown
      }
    }
  }
}

test('SQLite database initializes clean (zero mock data) and supports full CRUD across projects, members, tasks, subtasks, and activities', async (t) => {
  cleanupTestDb();
  const { app, closeDb } = createApp(TEST_DB_PATH);
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    closeDb();
    cleanupTestDb();
  });

  // 1. Bootstrap endpoint starts completely clean with 0 mock data
  const bootRes = await fetch(`${baseUrl}/api/bootstrap`);
  assert.equal(bootRes.status, 200);
  const bootData = await bootRes.json();

  assert.deepEqual(bootData.projects, [], 'Should start with 0 mock projects');
  assert.deepEqual(bootData.members, [], 'Should start with 0 mock members');
  assert.deepEqual(bootData.tasks, [], 'Should start with 0 mock tasks');

  // 2. Create two projects and two members
  const proj1Res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Flow 核心引擎',
      code: 'FLW',
      color: '#6366f1',
      description: '多维看板与 AI 助理架构',
    }),
  });
  assert.equal(proj1Res.status, 201);
  const targetProject = await proj1Res.json();

  const proj2Res = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '移动端适配',
      code: 'APP',
      color: '#10b981',
    }),
  });
  const secondProject = await proj2Res.json();

  const mem1Res = await fetch(`${baseUrl}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '张明',
      role: '前端架构师',
      capacity_hours: 40,
    }),
  });
  const targetAssignee = await mem1Res.json();

  const mem2Res = await fetch(`${baseUrl}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '李薇',
      role: '产品设计师',
      capacity_hours: 36,
    }),
  });
  const targetCollab = await mem2Res.json();

  // 3. Create a new task with core fields & verify auto task_key generation
  const createRes = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '完成多维看板拖拽联动自动化验证',
      description: '验证状态、项目、人员、截止日期跨列拖拽自动同步落盘',
      project_id: targetProject.id,
      status: 'todo',
      priority: 'urgent',
      due_date: '2026-10-25',
      assignee_id: targetAssignee.id,
      collaborator_ids: [targetCollab.id],
      tags: ['核心体验', '自动化测试'],
      estimate_hours: 6,
    }),
  });
  assert.equal(createRes.status, 201);
  const createdTask = await createRes.json();
  assert.equal(createdTask.title, '完成多维看板拖拽联动自动化验证');
  assert.equal(createdTask.task_key, 'FLW-101');
  assert.equal(createdTask.project_id, targetProject.id);
  assert.equal(createdTask.assignee_id, targetAssignee.id);
  assert.deepEqual(createdTask.collaborator_ids, [targetCollab.id]);
  assert.equal(createdTask.due_date, '2026-10-25');

  // 4. Patch task across boards (status, project_id, assignee_id, due_date, logged_minutes)
  const patchRes = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'in_progress',
      project_id: secondProject.id,
      assignee_id: targetCollab.id,
      due_date: '2026-10-22',
      logged_minutes: 50,
    }),
  });
  assert.equal(patchRes.status, 200);
  const patchedTask = await patchRes.json();
  assert.equal(patchedTask.status, 'in_progress');
  assert.equal(patchedTask.project_id, secondProject.id);
  assert.equal(patchedTask.assignee_id, targetCollab.id);
  assert.equal(patchedTask.due_date, '2026-10-22');
  assert.equal(patchedTask.logged_minutes, 50);
  assert.ok(patchedTask.activities.length >= 2, 'Should record system activity logs on changes');

  // 5. Add & toggle subtask
  const subRes = await fetch(`${baseUrl}/api/tasks/${createdTask.id}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '编写 SQLite 持久化断言' }),
  });
  assert.equal(subRes.status, 201);
  const subtask = await subRes.json();
  assert.equal(subtask.completed, false);

  const toggleRes = await fetch(`${baseUrl}/api/subtasks/${subtask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(toggleRes.status, 200);
  const toggledSub = await toggleRes.json();
  assert.equal(toggledSub.completed, true);

  // 6. Add a comment activity
  const commentRes = await fetch(`${baseUrl}/api/tasks/${createdTask.id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      member_id: targetAssignee.id,
      content: '接口响应速度非常快，已完成联调！',
    }),
  });
  assert.equal(commentRes.status, 201);
  const comment = await commentRes.json();
  assert.equal(comment.type, 'comment');
  assert.equal(comment.content, '接口响应速度非常快，已完成联调！');
});
