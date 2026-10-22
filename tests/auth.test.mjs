import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, setupAdmin, createUserAndLogin } from './helpers.mjs';

test('anonymous requests cannot read or change workspace data', async (t) => {
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  await api('PUT', '/api/ai/settings', { token, body: { api_key: 'sk-secret-value' } });

  const status = await api('GET', '/api/auth/status');
  assert.equal(status.status, 200);
  assert.equal(status.data.initialized, true);
  assert.equal(status.data.currentUser, null);

  for (const [method, url, body] of [
    ['GET', '/api/bootstrap'],
    ['GET', '/api/users'],
    ['POST', '/api/users', { username: 'mallory', password: 'pwnd1', role: 'admin' }],
    ['PATCH', '/api/users/x', { password: 'pwnd1' }],
    ['POST', '/api/seed/reset'],
    ['POST', '/api/import', { projects: [], members: [], tasks: [] }],
    ['GET', '/api/ai/settings'],
    ['POST', '/api/ai/models', { base_url: 'http://127.0.0.1:9/v1' }],
    ['POST', '/api/tasks', { title: 'x' }],
    ['GET', '/api/chat-groups'],
  ]) {
    const res = await api(method, url, { body });
    assert.equal(res.status, 401, `${method} ${url} should require a session`);
  }

  const fakeToken = await api('GET', '/api/bootstrap', { token: 'not-a-real-token' });
  assert.equal(fakeToken.status, 401);
  // A second setup cannot take over an initialized instance
  const again = await api('POST', '/api/auth/setup', {
    body: { username: 'mallory', password: 'pwnd1234' },
  });
  assert.equal(again.status, 400);
});

test('role permissions are enforced by the server, not just the UI', async (t) => {
  const { api } = await startTestApp(t);
  const { token: adminToken } = await setupAdmin(api);
  const visible = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: '可见项目', code: 'VIS', color: '#6366f1' },
  })).data;
  const hidden = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: '隐藏项目', code: 'HID', color: '#10b981' },
  })).data;
  const hiddenTask = (await api('POST', '/api/tasks', {
    token: adminToken,
    body: { title: '隐藏任务', project_id: hidden.id },
  })).data;
  const visibleTask = (await api('POST', '/api/tasks', {
    token: adminToken,
    body: { title: '可见任务', project_id: visible.id },
  })).data;
  const hiddenGroup = (await api('POST', '/api/chat-groups', {
    token: adminToken,
    body: { name: '隐藏群', project_id: hidden.id },
  })).data;
  await api('PUT', '/api/ai/settings', { token: adminToken, body: { api_key: 'sk-secret-value' } });

  const { token } = await createUserAndLogin(api, adminToken, {
    username: 'member1',
    role: 'member',
    auto_create_member: true,
    permissions: { visible_project_ids: [visible.id] },
  });

  // Admin-only and missing-permission operations
  const forbidden = [
    ['GET', '/api/users'],
    ['POST', '/api/users', { username: 'evil', password: 'evil-pass', role: 'admin' }],
    ['POST', '/api/seed/reset'],
    ['POST', '/api/import', { projects: [], members: [], tasks: [] }],
    ['PUT', '/api/ai/settings', { base_url: 'http://127.0.0.1:9/v1' }],
    ['POST', '/api/ai/models', {}],
    ['POST', '/api/projects', { name: 'x', color: '#6366f1' }],
    ['PATCH', `/api/projects/${visible.id}`, { name: 'renamed' }],
    ['DELETE', `/api/projects/${visible.id}`],
    ['POST', '/api/members', { name: 'x' }],
    ['DELETE', `/api/tasks/${visibleTask.id}`],
  ];
  for (const [method, url, body] of forbidden) {
    const res = await api(method, url, { token, body });
    assert.equal(res.status, 403, `${method} ${url} should be forbidden for a member`);
  }

  // Hidden projects behave as if they did not exist
  const boot = (await api('GET', '/api/bootstrap', { token })).data;
  assert.deepEqual(boot.projects.map((p) => p.id), [visible.id]);
  assert.ok(!boot.tasks.some((tk) => tk.id === hiddenTask.id));
  assert.ok(!boot.chatGroups.some((g) => g.id === hiddenGroup.id));
  const notFound = [
    ['PATCH', `/api/tasks/${hiddenTask.id}`, { status: 'done' }],
    ['POST', `/api/tasks/${hiddenTask.id}/comments`, { content: 'hi' }],
    ['POST', `/api/tasks/${hiddenTask.id}/subtasks`, { title: 'x' }],
    ['POST', '/api/tasks', { title: 'x', project_id: hidden.id }],
    ['PATCH', `/api/tasks/${visibleTask.id}`, { project_id: hidden.id }],
    ['GET', `/api/chat-groups/${hiddenGroup.id}/messages`],
    ['POST', `/api/chat-groups/${hiddenGroup.id}/messages`, { content: 'hi' }],
  ];
  for (const [method, url, body] of notFound) {
    const res = await api(method, url, { token, body });
    assert.equal(res.status, 404, `${method} ${url} should hide other projects`);
  }

  // Allowed: edit tasks in visible projects, read masked AI settings
  const edit = await api('PATCH', `/api/tasks/${visibleTask.id}`, {
    token,
    body: { status: 'in_progress' },
  });
  assert.equal(edit.status, 200);
  const ai = await api('GET', '/api/ai/settings', { token });
  assert.equal(ai.status, 200);
  assert.equal(ai.data.api_key, '');
  assert.equal(ai.data.has_api_key, true);
  assert.ok(!JSON.stringify(ai.data).includes('sk-secret-value'));
});

test('account managers cannot escalate privileges', async (t) => {
  const { api } = await startTestApp(t);
  const { token: adminToken, user: admin } = await setupAdmin(api);
  const { token, user: manager } = await createUserAndLogin(api, adminToken, {
    username: 'manager',
    role: 'director',
    permissions: { can_manage_accounts: true },
  });
  assert.equal(manager.permissions.can_manage_accounts, true);

  const makeAdmin = await api('POST', '/api/users', {
    token,
    body: { username: 'evil', password: 'evil-pass', role: 'admin' },
  });
  assert.equal(makeAdmin.status, 403);
  const grantAccounts = await api('POST', '/api/users', {
    token,
    body: {
      username: 'evil2',
      password: 'evil-pass',
      role: 'member',
      permissions: { can_manage_accounts: true },
    },
  });
  assert.equal(grantAccounts.status, 403);
  const promoteSelf = await api('PATCH', `/api/users/${manager.id}`, {
    token,
    body: { role: 'admin' },
  });
  assert.equal(promoteSelf.status, 403);
  const widenSelf = await api('PATCH', `/api/users/${manager.id}`, {
    token,
    body: { permissions: { ...manager.permissions, can_delete_project: true } },
  });
  assert.equal(widenSelf.status, 403);
  const editAdmin = await api('PATCH', `/api/users/${admin.id}`, {
    token,
    body: { password: 'hijacked-pass' },
  });
  assert.equal(editAdmin.status, 403);
  const deleteAdmin = await api('DELETE', `/api/users/${admin.id}`, { token });
  assert.equal(deleteAdmin.status, 403);

  // Ordinary account management still works
  const created = await api('POST', '/api/users', {
    token,
    body: { username: 'newbie', password: 'newbie-pass', role: 'member' },
  });
  assert.equal(created.status, 201);
  const ownPassword = await api('PATCH', `/api/users/${manager.id}`, {
    token,
    body: { password: 'manager-new-pass' },
  });
  assert.equal(ownPassword.status, 200);
});

test('password changes are validated and revoke other sessions', async (t) => {
  const { api } = await startTestApp(t);
  const { token: adminToken } = await setupAdmin(api);
  const { token: userToken, user } = await createUserAndLogin(api, adminToken, {
    username: 'alice',
    password: 'alice-pass',
  });

  const tooShort = await api('PATCH', `/api/users/${user.id}`, {
    token: adminToken,
    body: { password: 'abc' },
  });
  assert.equal(tooShort.status, 400);
  const dupName = await api('PATCH', `/api/users/${user.id}`, {
    token: adminToken,
    body: { username: 'admin' },
  });
  assert.equal(dupName.status, 400);

  const reset = await api('PATCH', `/api/users/${user.id}`, {
    token: adminToken,
    body: { password: ' new pass ' },
  });
  assert.equal(reset.status, 200);
  const oldSession = await api('GET', '/api/bootstrap', { token: userToken });
  assert.equal(oldSession.status, 401, 'old session should be revoked');
  // The password is stored exactly as typed (no trimming)
  const trimmed = await api('POST', '/api/auth/login', {
    body: { username: 'alice', password: 'new pass' },
  });
  assert.equal(trimmed.status, 401);
  const exact = await api('POST', '/api/auth/login', {
    body: { username: 'alice', password: ' new pass ' },
  });
  assert.equal(exact.status, 200);
});

test('comments and chat messages are attributed to the signed-in user', async (t) => {
  const { api } = await startTestApp(t);
  const { token: adminToken, user: admin } = await setupAdmin(api, {
    display_name: '老板',
  });
  const project = (await api('POST', '/api/projects', {
    token: adminToken,
    body: { name: 'P', code: 'PPP', color: '#6366f1' },
  })).data;
  const task = (await api('POST', '/api/tasks', {
    token: adminToken,
    body: { title: 'T', project_id: project.id },
  })).data;
  const group = (await api('POST', '/api/chat-groups', {
    token: adminToken,
    body: { name: 'G', project_id: project.id },
  })).data;
  const bossMessage = (await api('POST', `/api/chat-groups/${group.id}/messages`, {
    token: adminToken,
    body: { content: '老板的消息' },
  })).data;

  const { token, user } = await createUserAndLogin(api, adminToken, {
    username: 'bob',
    display_name: 'Bob',
    auto_create_member: true,
  });

  const comment = await api('POST', `/api/tasks/${task.id}/comments`, {
    token,
    body: { member_id: admin.member_id, content: '冒充老板评论' },
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.member_id, user.member_id);
  assert.equal(comment.data.actor_name, 'Bob');

  const message = await api('POST', `/api/chat-groups/${group.id}/messages`, {
    token,
    body: { content: '冒充老板发言', sender_member_id: admin.member_id, sender_name: '老板' },
  });
  assert.equal(message.status, 201);
  assert.equal(message.data.sender_member_id, user.member_id);
  assert.equal(message.data.sender_name, 'Bob');
  assert.equal(message.data.sender_user_id, user.id);

  const deleteOthers = await api(
    'DELETE',
    `/api/chat-groups/${group.id}/messages/${bossMessage.id}`,
    { token }
  );
  assert.equal(deleteOthers.status, 403);
  const deleteOwn = await api(
    'DELETE',
    `/api/chat-groups/${group.id}/messages/${message.data.id}`,
    { token }
  );
  assert.equal(deleteOwn.status, 200);
  const deleteGroup = await api('DELETE', `/api/chat-groups/${group.id}`, { token });
  assert.equal(deleteGroup.status, 403);
});

test('repeated failed logins are rate limited', async (t) => {
  const { api } = await startTestApp(t);
  await setupAdmin(api);
  for (let i = 0; i < 10; i += 1) {
    const res = await api('POST', '/api/auth/login', {
      body: { username: 'admin', password: `wrong-${i}` },
    });
    assert.equal(res.status, 401);
  }
  const blocked = await api('POST', '/api/auth/login', {
    body: { username: 'admin', password: 'admin-password-123' },
  });
  assert.equal(blocked.status, 429);
});

test('sessions expire after FLOW_SESSION_TTL_DAYS', async (t) => {
  const previous = process.env.FLOW_SESSION_TTL_DAYS;
  process.env.FLOW_SESSION_TTL_DAYS = String(1 / (24 * 60 * 60)); // one second
  t.after(() => {
    if (previous === undefined) delete process.env.FLOW_SESSION_TTL_DAYS;
    else process.env.FLOW_SESSION_TTL_DAYS = previous;
  });
  const { api } = await startTestApp(t);
  const { token } = await setupAdmin(api);
  assert.equal((await api('GET', '/api/bootstrap', { token })).status, 200);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  assert.equal((await api('GET', '/api/bootstrap', { token })).status, 401);
});
