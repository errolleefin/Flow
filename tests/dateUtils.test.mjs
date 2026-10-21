import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDueStatus,
  getDueBucket,
  formatDueLabel,
  getDateForBucket,
} from '../src/utils/dateUtils.ts';

test('getDueStatus identifies completed, overdue, due_today, due_soon, upcoming, and none', () => {
  const refDate = '2026-10-21';

  assert.equal(getDueStatus('2026-10-15', 'done', refDate), 'completed');
  assert.equal(getDueStatus('2026-10-19', 'in_progress', refDate), 'overdue');
  assert.equal(getDueStatus('2026-10-21', 'todo', refDate), 'due_today');
  assert.equal(getDueStatus('2026-10-23', 'todo', refDate), 'due_soon');
  assert.equal(getDueStatus('2026-10-30', 'backlog', refDate), 'upcoming');
  assert.equal(getDueStatus(null, 'todo', refDate), 'none');
});

test('getDueBucket classifies due dates into 5 kanban columns accurately', () => {
  const refDate = '2026-10-21';

  assert.equal(getDueBucket('2026-10-20', refDate), 'overdue');
  assert.equal(getDueBucket('2026-10-21', refDate), 'today');
  assert.equal(getDueBucket('2026-10-22', refDate), 'next3days');
  assert.equal(getDueBucket('2026-10-24', refDate), 'next3days');
  assert.equal(getDueBucket('2026-10-25', refDate), 'upcoming');
  assert.equal(getDueBucket('', refDate), 'nodate');
  assert.equal(getDueBucket(null, refDate), 'nodate');
});

test('getDateForBucket returns appropriate target ISO date when dragging across due date columns', () => {
  const refDate = '2026-10-21';

  assert.equal(getDateForBucket('today', refDate), '2026-10-21');
  assert.equal(getDateForBucket('next3days', refDate), '2026-10-23');
  assert.equal(getDateForBucket('upcoming', refDate), '2026-10-28');
  assert.equal(getDateForBucket('overdue', refDate), '2026-10-20');
  assert.equal(getDateForBucket('nodate', refDate), null);
});

test('formatDueLabel produces human-readable Chinese relative labels', () => {
  const refDate = '2026-10-21';

  assert.equal(formatDueLabel('2026-10-21', refDate), '今天到期');
  assert.equal(formatDueLabel('2026-10-22', refDate), '明天到期');
  assert.equal(formatDueLabel('2026-10-19', refDate), '逾期 2 天');
  assert.equal(formatDueLabel(null, refDate), '未设截止日');
});
