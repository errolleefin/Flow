export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'];
export const TASK_PRIORITIES = ['urgent', 'high', 'medium', 'low'];

// Strict calendar date in YYYY-MM-DD form (rejects 2026-02-30 and the like).
export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

// Project colors are interpolated into inline styles, so only allow #RRGGBB.
export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

export function isNonNegativeNumber(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  const n = Number(value);
  return value !== '' && Number.isFinite(n) && n >= 0;
}

// Returns an error message for the first invalid task field that is present.
export function validateTaskFields(fields) {
  if (!fields || typeof fields !== 'object') return null;
  if (fields.status !== undefined && !TASK_STATUSES.includes(fields.status)) {
    return '无效的任务状态';
  }
  if (
    fields.priority !== undefined &&
    !TASK_PRIORITIES.includes(fields.priority)
  ) {
    return '无效的优先级';
  }
  if (
    fields.due_date !== undefined &&
    fields.due_date !== null &&
    fields.due_date !== '' &&
    !isIsoDate(fields.due_date)
  ) {
    return '截止日期格式应为 YYYY-MM-DD';
  }
  for (const key of ['collaborator_ids', 'tags']) {
    if (fields[key] !== undefined && !isStringArray(fields[key])) {
      return `${key} 必须是字符串数组`;
    }
  }
  for (const key of [
    'estimate_hours',
    'logged_minutes',
    'logged_minutes_delta',
    'position',
  ]) {
    if (fields[key] !== undefined && !isNonNegativeNumber(fields[key])) {
      return `${key} 必须是非负数字`;
    }
  }
  return null;
}
