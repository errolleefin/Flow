import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestApp, setupAdmin } from './helpers.mjs';

test('SQLite database initializes clean (zero mock data) and supports full CRUD across projects, members, tasks, subtasks, and activities', async (t) => {
  const { api } = await startTestApp(t);

  // 0. First-time Super Admin setup creates and binds a member with the display name
  const statusBefore = (await api('GET', '/api/auth/status')).data;
  assert.equal(statusBefore.initialized, false);
  assert.equal(statusBefore.user, null);

  const setupData = await setupAdmin(api, { display_name: '张明' });
  const token = setupData.token;
  assert.ok(token);
  assert.equal(setupData.user.role, 'admin');
  assert.ok(setupData.user.member_id, 'Setup should create and bind a member');

  // 1. Bootstrap starts with no projects or tasks (only the admin's own member)
  const bootRes = await api('GET', '/api/bootstrap', { token });
  assert.equal(bootRes.status, 200);
  assert.deepEqual(bootRes.data.projects, [], 'Should start with 0 mock projects');
  assert.deepEqual(bootRes.data.tasks, [], 'Should start with 0 mock tasks');
  const targetAssignee = bootRes.data.members.find(
    (m) => m.id === setupData.user.member_id
  );
  assert.equal(targetAssignee.name, '张明');

  // 2. Create two projects and a collaborator
  const proj1Res = await api('POST', '/api/projects', {
    token,
    body: {
      name: 'Flow 核心引擎',
      code: 'FLW',
      color: '#6366f1',
      description: '多维看板与 AI 助理架构',
    },
  });
  assert.equal(proj1Res.status, 201);
  const targetProject = proj1Res.data;

  const secondProject = (
    await api('POST', '/api/projects', {
      token,
      body: { name: '移动端适配', code: 'APP', color: '#10b981' },
    })
  ).data;

  const targetCollab = (
    await api('POST', '/api/members', {
      token,
      body: { name: '李薇', role: '产品设计师', capacity_hours: 36 },
    })
  ).data;

  // 3. Create a new task with core fields & verify auto task_key generation
  const createRes = await api('POST', '/api/tasks', {
    token,
    body: {
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
    },
  });
  assert.equal(createRes.status, 201);
  const createdTask = createRes.data;
  assert.equal(createdTask.title, '完成多维看板拖拽联动自动化验证');
  assert.equal(createdTask.task_key, 'FLW-101');
  assert.equal(createdTask.project_id, targetProject.id);
  assert.equal(createdTask.assignee_id, targetAssignee.id);
  assert.deepEqual(createdTask.collaborator_ids, [targetCollab.id]);
  assert.equal(createdTask.due_date, '2026-10-25');

  // 4. Patch task across boards (status, project_id, assignee_id, due_date, logged_minutes)
  const patchRes = await api('PATCH', `/api/tasks/${createdTask.id}`, {
    token,
    body: {
      status: 'in_progress',
      project_id: secondProject.id,
      assignee_id: targetCollab.id,
      due_date: '2026-10-22',
      logged_minutes: 50,
    },
  });
  assert.equal(patchRes.status, 200);
  const patchedTask = patchRes.data;
  assert.equal(patchedTask.status, 'in_progress');
  assert.equal(patchedTask.project_id, secondProject.id);
  assert.equal(patchedTask.assignee_id, targetCollab.id);
  assert.equal(patchedTask.due_date, '2026-10-22');
  assert.equal(patchedTask.logged_minutes, 50);
  assert.ok(patchedTask.activities.length >= 2, 'Should record system activity logs on changes');
  // The audit entry names the account that made the change, not the new assignee
  const changeLog = patchedTask.activities.find((a) => a.content.includes('状态变更'));
  assert.equal(changeLog.member_id, targetAssignee.id);
  assert.equal(changeLog.actor_name, '张明');

  // 5. Add & toggle subtask (verify completed_at timestamp is automatically set and cleared)
  const subRes = await api('POST', `/api/tasks/${createdTask.id}/subtasks`, {
    token,
    body: { title: '编写 SQLite 持久化断言' },
  });
  assert.equal(subRes.status, 201);
  const subtask = subRes.data;
  assert.equal(subtask.completed, false);
  assert.equal(subtask.completed_at, null);

  const toggleRes = await api('PATCH', `/api/subtasks/${subtask.id}`, {
    token,
    body: { completed: true },
  });
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.data.completed, true);
  assert.ok(
    typeof toggleRes.data.completed_at === 'string' &&
      toggleRes.data.completed_at.length > 0,
    'completed_at should be recorded when subtask is completed'
  );

  const uncheckedSub = (
    await api('PATCH', `/api/subtasks/${subtask.id}`, {
      token,
      body: { completed: false },
    })
  ).data;
  assert.equal(uncheckedSub.completed, false);
  assert.equal(uncheckedSub.completed_at, null);

  // 6. Add a comment activity
  const commentRes = await api('POST', `/api/tasks/${createdTask.id}/comments`, {
    token,
    body: { content: '接口响应速度非常快，已完成联调！' },
  });
  assert.equal(commentRes.status, 201);
  assert.equal(commentRes.data.type, 'comment');
  assert.equal(commentRes.data.content, '接口响应速度非常快，已完成联调！');
  assert.equal(commentRes.data.member_id, targetAssignee.id);

  // 7. Edit Project & Pin (PATCH /api/projects/:id)
  const editProjRes = await api('PATCH', `/api/projects/${secondProject.id}`, {
    token,
    body: {
      name: '移动端 4.0 架构',
      code: 'MOB',
      color: '#ec4899',
      description: '全新跨端渲染引擎',
      pinned: true,
    },
  });
  assert.equal(editProjRes.status, 200);
  assert.equal(editProjRes.data.name, '移动端 4.0 架构');
  assert.equal(editProjRes.data.code, 'MOB');
  assert.equal(editProjRes.data.color, '#ec4899');
  assert.equal(editProjRes.data.pinned, true);

  // 8. Edit Member & Pin (PATCH /api/members/:id)
  const editMemRes = await api('PATCH', `/api/members/${targetCollab.id}`, {
    token,
    body: { name: '李薇薇', role: '设计总监', capacity_hours: 32, pinned: true },
  });
  assert.equal(editMemRes.status, 200);
  assert.equal(editMemRes.data.name, '李薇薇');
  assert.equal(editMemRes.data.role, '设计总监');
  assert.equal(editMemRes.data.capacity_hours, 32);
  assert.equal(editMemRes.data.pinned, true);

  // 9. Delete Member and verify tasks are unassigned safely without being deleted
  const delMemRes = await api('DELETE', `/api/members/${targetCollab.id}`, { token });
  assert.equal(delMemRes.status, 200);

  const afterMemDelBoot = (await api('GET', '/api/bootstrap', { token })).data;
  assert.equal(afterMemDelBoot.members.length, 1);
  const taskAfterMemDel = afterMemDelBoot.tasks.find((item) => item.id === createdTask.id);
  assert.ok(taskAfterMemDel, 'Task should still exist after its assignee is deleted');
  assert.equal(taskAfterMemDel.assignee_id, null, 'Task assignee_id should be cleared to null');
  assert.deepEqual(
    taskAfterMemDel.collaborator_ids,
    [],
    'Deleted member should be removed from collaborator_ids'
  );

  // 10. Delete Project and verify cascade cleanup
  const delProjRes = await api('DELETE', `/api/projects/${secondProject.id}`, { token });
  assert.equal(delProjRes.status, 200);
  const afterProjDelBoot = (await api('GET', '/api/bootstrap', { token })).data;
  assert.equal(afterProjDelBoot.projects.length, 1);
  assert.equal(afterProjDelBoot.tasks.length, 0);

  // 11. 5-Tier RBAC: a Lead account bound to a new member and restricted to targetProject
  const createLeadRes = await api('POST', '/api/users', {
    token,
    body: {
      username: 'teamlead',
      display_name: '王组长',
      password: 'lead-password',
      role: 'lead',
      auto_create_member: true,
      permissions: {
        visible_project_ids: [targetProject.id],
        can_create_project: false,
        can_edit_project: false,
        can_delete_project: false,
        can_create_task: true,
        can_edit_task: true,
        can_delete_task: false,
        can_manage_members: false,
        can_manage_accounts: false,
      },
    },
  });
  assert.equal(createLeadRes.status, 201);
  const leadUser = createLeadRes.data;
  assert.equal(leadUser.role, 'lead');
  assert.ok(leadUser.member_id, 'Should auto-create and bind a member');
  assert.deepEqual(leadUser.permissions.visible_project_ids, [targetProject.id]);

  // 12. Custom Project Communication Group Chats CRUD & Messaging
  const createGroupRes = await api('POST', '/api/chat-groups', {
    token,
    body: {
      name: 'Flow 架构攻坚群',
      description: '核心研发实时沟通',
      project_id: targetProject.id,
      member_ids: [targetAssignee.id],
    },
  });
  assert.equal(createGroupRes.status, 201);
  const chatGroup = createGroupRes.data;
  assert.equal(chatGroup.name, 'Flow 架构攻坚群');
  assert.equal(chatGroup.project_id, targetProject.id);

  const sendMsgRes = await api('POST', `/api/chat-groups/${chatGroup.id}/messages`, {
    token,
    body: { content: '@张明 请关注 #FLW-101 子任务进度' },
  });
  assert.equal(sendMsgRes.status, 201);
  const sentMsg = sendMsgRes.data;
  assert.equal(sentMsg.sender_name, '张明');
  assert.equal(sentMsg.sender_member_id, targetAssignee.id);

  const listMsgRes = await api('GET', `/api/chat-groups/${chatGroup.id}/messages`, { token });
  assert.equal(listMsgRes.status, 200);
  assert.equal(listMsgRes.data.messages.length, 1);

  const listGroupsRes = await api('GET', '/api/chat-groups', { token });
  assert.equal(listGroupsRes.status, 200);
  const updatedChatGroup = listGroupsRes.data.groups.find((g) => g.id === chatGroup.id);
  assert.ok(updatedChatGroup);
  assert.equal(updatedChatGroup.last_message_id, sentMsg.id);
  assert.equal(updatedChatGroup.last_message_sender, '张明');
  assert.equal(updatedChatGroup.last_message_content, '@张明 请关注 #FLW-101 子任务进度');
});
