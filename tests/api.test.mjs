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

  // 5. Add & toggle subtask (verify completed_at timestamp is automatically set and cleared)
  const subRes = await fetch(`${baseUrl}/api/tasks/${createdTask.id}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '编写 SQLite 持久化断言' }),
  });
  assert.equal(subRes.status, 201);
  const subtask = await subRes.json();
  assert.equal(subtask.completed, false);
  assert.equal(subtask.completed_at, null);

  const toggleRes = await fetch(`${baseUrl}/api/subtasks/${subtask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(toggleRes.status, 200);
  const toggledSub = await toggleRes.json();
  assert.equal(toggledSub.completed, true);
  assert.ok(
    typeof toggledSub.completed_at === 'string' &&
      toggledSub.completed_at.length > 0,
    'completed_at should be recorded when subtask is completed'
  );

  const uncheckRes = await fetch(`${baseUrl}/api/subtasks/${subtask.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed: false }),
  });
  const uncheckedSub = await uncheckRes.json();
  assert.equal(uncheckedSub.completed, false);
  assert.equal(uncheckedSub.completed_at, null);

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

  // 7. Edit Project & Pin (PATCH /api/projects/:id)
  const editProjRes = await fetch(`${baseUrl}/api/projects/${secondProject.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '移动端 4.0 架构',
      code: 'MOB',
      color: '#ec4899',
      description: '全新跨端渲染引擎',
      pinned: true,
    }),
  });
  assert.equal(editProjRes.status, 200);
  const editedProj = await editProjRes.json();
  assert.equal(editedProj.name, '移动端 4.0 架构');
  assert.equal(editedProj.code, 'MOB');
  assert.equal(editedProj.color, '#ec4899');
  assert.equal(editedProj.pinned, true);

  // 8. Edit Member & Pin (PATCH /api/members/:id)
  const editMemRes = await fetch(`${baseUrl}/api/members/${targetCollab.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '李薇薇',
      role: '设计总监',
      capacity_hours: 32,
      pinned: true,
    }),
  });
  assert.equal(editMemRes.status, 200);
  const editedMem = await editMemRes.json();
  assert.equal(editedMem.name, '李薇薇');
  assert.equal(editedMem.role, '设计总监');
  assert.equal(editedMem.capacity_hours, 32);
  assert.equal(editedMem.pinned, true);

  // 9. Delete Member (DELETE /api/members/:id) and verify tasks are unassigned safely without being deleted
  const delMemRes = await fetch(`${baseUrl}/api/members/${targetCollab.id}`, {
    method: 'DELETE',
  });
  assert.equal(delMemRes.status, 200);

  const afterMemDelBoot = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
  assert.equal(afterMemDelBoot.members.length, 1);
  const taskAfterMemDel = afterMemDelBoot.tasks.find((item) => item.id === createdTask.id);
  assert.ok(taskAfterMemDel, 'Task should still exist after its assignee is deleted');
  assert.equal(taskAfterMemDel.assignee_id, null, 'Task assignee_id should be cleared to null');
  assert.deepEqual(
    taskAfterMemDel.collaborator_ids,
    [],
    'Deleted member should be removed from collaborator_ids'
  );

  // 10. Delete Project (DELETE /api/projects/:id) and verify cascade cleanup
  const delProjRes = await fetch(`${baseUrl}/api/projects/${secondProject.id}`, {
    method: 'DELETE',
  });
  assert.equal(delProjRes.status, 200);
  const afterProjDelBoot = await (await fetch(`${baseUrl}/api/bootstrap`)).json();
  assert.equal(afterProjDelBoot.projects.length, 1);
  assert.equal(afterProjDelBoot.tasks.length, 0);

  // 11. First-Time Super Admin Setup, Login, 5-Tier RBAC & Member Binding
  const statusBefore = await (await fetch(`${baseUrl}/api/auth/status`)).json();
  assert.equal(statusBefore.initialized, false);
  assert.equal(statusBefore.user, null);

  const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      display_name: '系统超级管理员',
      password: 'admin-password-123',
      bind_member_name: '张明',
    }),
  });
  assert.equal(setupRes.status, 201);
  const setupData = await setupRes.json();
  assert.ok(setupData.token);
  assert.equal(setupData.user.role, 'admin');
  assert.equal(setupData.user.member_id, targetAssignee.id);

  // Create a Lead account bound to a newly created member and restricted to targetProject
  const createLeadRes = await fetch(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${setupData.token}`,
    },
    body: JSON.stringify({
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
    }),
  });
  assert.equal(createLeadRes.status, 201);
  const leadUser = await createLeadRes.json();
  assert.equal(leadUser.role, 'lead');
  assert.ok(leadUser.member_id, 'Should auto-create and bind a member');
  assert.deepEqual(leadUser.permissions.visible_project_ids, [targetProject.id]);

  // 12. Custom Project Communication Group Chats CRUD & Messaging
  const createGroupRes = await fetch(`${baseUrl}/api/chat-groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${setupData.token}`,
    },
    body: JSON.stringify({
      name: 'Flow 架构攻坚群',
      description: '核心研发实时沟通',
      project_id: targetProject.id,
      member_ids: [targetAssignee.id],
    }),
  });
  assert.equal(createGroupRes.status, 201);
  const chatGroup = await createGroupRes.json();
  assert.equal(chatGroup.name, 'Flow 架构攻坚群');
  assert.equal(chatGroup.project_id, targetProject.id);

  const sendMsgRes = await fetch(
    `${baseUrl}/api/chat-groups/${chatGroup.id}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${setupData.token}`,
      },
      body: JSON.stringify({
        content: '@张明 请关注 #FLW-101 子任务进度',
      }),
    }
  );
  assert.equal(sendMsgRes.status, 201);
  const sentMsg = await sendMsgRes.json();
  assert.equal(sentMsg.sender_name, '张明');
  assert.equal(sentMsg.sender_member_id, targetAssignee.id);

  const listMsgRes = await fetch(
    `${baseUrl}/api/chat-groups/${chatGroup.id}/messages`
  );
  assert.equal(listMsgRes.status, 200);
  const { messages } = await listMsgRes.json();
  assert.equal(messages.length, 1);

  const listGroupsRes = await fetch(`${baseUrl}/api/chat-groups`);
  assert.equal(listGroupsRes.status, 200);
  const { groups } = await listGroupsRes.json();
  const updatedChatGroup = groups.find((g) => g.id === chatGroup.id);
  assert.ok(updatedChatGroup);
  assert.equal(updatedChatGroup.last_message_id, sentMsg.id);
  assert.equal(updatedChatGroup.last_message_sender, '张明');
  assert.equal(updatedChatGroup.last_message_content, '@张明 请关注 #FLW-101 子任务进度');
});
