import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, setupAdmin, createUserAndLogin } from './helpers.mjs';

test('task keys stay unique after deletions and across projects sharing a code', async (t) => {
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  const p1 = (await api('POST', '/api/projects', {
    token,
    body: { name: 'Alpha', code: 'ABC', color: '#6366f1' },
  })).data;
  const p2 = (await api('POST', '/api/projects', {
    token,
    body: { name: 'Alpha Two', code: 'ABC', color: '#10b981' },
  })).data;
  const create = async (title, projectId) =>
    (await api('POST', '/api/tasks', { token, body: { title, project_id: projectId } })).data;

  const a = await create('A', p1.id);
  const b = await create('B', p1.id);
  assert.equal(a.task_key, 'ABC-101');
  assert.equal(b.task_key, 'ABC-102');
  await api('DELETE', `/api/tasks/${a.id}`, { token });
  const c = await create('C', p1.id);
  const d = await create('D', p2.id);

  const keys = (await api('GET', '/api/bootstrap', { token })).data.tasks.map(
    (task) => task.task_key
  );
  assert.equal(new Set(keys).size, keys.length, `duplicate keys: ${keys}`);
  assert.equal(c.task_key, 'ABC-103');
  assert.equal(d.task_key, 'ABC-104');
});

test('import validates the backup first and never leaves a half-wiped workspace', async (t) => {
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  const project = (await api('POST', '/api/projects', {
    token,
    body: { name: '现有项目', code: 'OLD', color: '#6366f1' },
  })).data;
  await api('POST', '/api/tasks', {
    token,
    body: { title: '现有任务', project_id: project.id },
  });

  const broken = await api('POST', '/api/import', {
    token,
    body: {
      projects: [{ id: 'p-new', name: '新项目', color: '#6366f1' }], // missing code
      members: [],
      tasks: [{ id: 't-new', task_key: 'NEW-101', title: '新任务', project_id: 'p-missing' }],
    },
  });
  assert.equal(broken.status, 400);

  const boot = (await api('GET', '/api/bootstrap', { token })).data;
  assert.deepEqual(boot.projects.map((p) => p.name), ['现有项目']);
  assert.deepEqual(boot.tasks.map((tk) => tk.title), ['现有任务']);

  const ok = await api('POST', '/api/import', {
    token,
    body: {
      projects: [{ id: 'p-new', name: '新项目', code: 'NEW', color: '#6366f1' }],
      members: [{ id: 'm-new', name: '新成员', role: '工程师', avatar_bg: 'from-indigo-500 to-purple-600' }],
      tasks: [
        {
          id: 't-new',
          task_key: 'NEW-101',
          title: '新任务',
          project_id: 'p-new',
          assignee_id: 'm-new',
          subtasks: [{ title: '子任务', completed: true }],
        },
      ],
    },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.projects.map((p) => p.name), ['新项目']);
  assert.equal(ok.data.tasks[0].subtasks.length, 1);
});

test('task, project and chat input is validated', async (t) => {
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  const project = (await api('POST', '/api/projects', {
    token,
    body: { name: 'P', code: 'PPP', color: '#6366f1' },
  })).data;
  const task = (await api('POST', '/api/tasks', {
    token,
    body: { title: 'T', project_id: project.id },
  })).data;

  const invalid = [
    ['POST', '/api/tasks', { title: 'x', project_id: project.id, status: 'completed' }],
    ['POST', '/api/tasks', { title: 'x', project_id: project.id, priority: '紧急' }],
    ['POST', '/api/tasks', { title: 'x', project_id: project.id, due_date: 'tomorrow' }],
    ['POST', '/api/tasks', { title: 'x', project_id: project.id, tags: 'a,b' }],
    ['PATCH', `/api/tasks/${task.id}`, { status: 'completed' }],
    ['PATCH', `/api/tasks/${task.id}`, { collaborator_ids: null }],
    ['PATCH', `/api/tasks/${task.id}`, { due_date: '2026-13-45' }],
    ['PATCH', `/api/tasks/${task.id}`, { estimate_hours: 'abc' }],
    ['POST', '/api/projects', { name: 'X', color: 'url(https://evil.test/x.png)' }],
    ['PATCH', `/api/projects/${project.id}`, { color: '#000 0%, #000 100%), url(https://evil.test/x)' }],
  ];
  for (const [method, url, body] of invalid) {
    const res = await api(method, url, { token, body });
    assert.equal(res.status, 400, `${method} ${url} ${JSON.stringify(body)} should be rejected`);
  }

  const cleared = await api('PATCH', `/api/tasks/${task.id}`, {
    token,
    body: { due_date: null, collaborator_ids: [], tags: ['ok'] },
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.data.due_date, null);
  assert.deepEqual(cleared.data.tags, ['ok']);
});

test('deleting a member unbinds accounts and chat groups (REST and AI share the cascade)', async (t) => {
  const { api } = await startTestApp(t);
  const { token: adminToken } = await setupAdmin(api, { create_member: false });
  const { user } = await createUserAndLogin(api, adminToken, {
    username: 'carol',
    display_name: 'Carol',
    auto_create_member: true,
  });
  const project = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: 'P', code: 'PPP', color: '#6366f1' },
  })).data;
  const group = (await api('POST', '/api/chat-groups', {
    token: adminToken,
    body: { name: 'G', project_id: project.id, member_ids: [user.member_id] },
  })).data;

  const del = await api('DELETE', `/api/members/${user.member_id}`, { token: adminToken });
  assert.equal(del.status, 200);
  const users = (await api('GET', '/api/users', { token: adminToken })).data.users;
  assert.equal(users.find((u) => u.id === user.id).member_id, null);
  const groups = (await api('GET', '/api/chat-groups', { token: adminToken })).data.groups;
  assert.deepEqual(groups.find((g) => g.id === group.id).member_ids, []);
});
