import test from 'node:test';
import assert from 'node:assert/strict';
import { filterTasks, extractAllTags } from '../src/utils/taskFilters.ts';

const mockTasks = [
  {
    id: 't1',
    task_key: 'AI-101',
    title: '设计 RAG 引用溯源卡片',
    description: '支持流式高亮',
    project_id: 'proj-ai',
    status: 'in_progress',
    priority: 'urgent',
    due_date: '2026-10-19', // overdue relative to 2026-10-21
    assignee_id: 'mem-chen',
    collaborator_ids: ['mem-su'],
    tags: ['核心体验', 'RAG'],
    estimate_hours: 8,
    logged_minutes: 120,
    position: 1,
    created_at: '',
    updated_at: '',
    subtasks: [],
    activities: [],
  },
  {
    id: 't2',
    task_key: 'APP-201',
    title: '移动端离线缓存同步',
    description: 'SQLite 本地队列',
    project_id: 'proj-app',
    status: 'todo',
    priority: 'high',
    due_date: '2026-10-25',
    assignee_id: 'mem-zhou',
    collaborator_ids: ['mem-chen'],
    tags: ['离线优先'],
    estimate_hours: 12,
    logged_minutes: 0,
    position: 2,
    created_at: '',
    updated_at: '',
    subtasks: [],
    activities: [],
  },
];

test('filterTasks filters by search, project, member (assignee + collaborator), priority, tag, and overdue', () => {
  const refDate = '2026-10-21';
  const baseFilter = {
    search: '',
    projectId: 'all',
    memberId: 'all',
    priority: 'all',
    tag: 'all',
    onlyOverdue: false,
    includeCollaborated: true,
  };

  assert.equal(filterTasks(mockTasks, baseFilter, refDate).length, 2);
  assert.equal(filterTasks(mockTasks, { ...baseFilter, projectId: 'proj-ai' }, refDate).length, 1);
  assert.equal(filterTasks(mockTasks, { ...baseFilter, memberId: 'mem-chen', includeCollaborated: false }, refDate).length, 1);
  assert.equal(filterTasks(mockTasks, { ...baseFilter, memberId: 'mem-chen', includeCollaborated: true }, refDate).length, 2);
  assert.equal(filterTasks(mockTasks, { ...baseFilter, onlyOverdue: true }, refDate).length, 1);
  assert.equal(filterTasks(mockTasks, { ...baseFilter, search: 'APP-201' }, refDate).length, 1);
  assert.deepEqual(extractAllTags(mockTasks), ['核心体验', 'RAG', '离线优先']);
});
