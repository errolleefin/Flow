import type { DueBucket, DueStatus, TaskStatus } from '../types/index.ts';

export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffDaysISO(targetDate: string, refDate: string = getTodayISO()): number {
  const [ty, tm, td] = targetDate.split('-').map(Number);
  const [ry, rm, rd] = refDate.split('-').map(Number);
  const targetUTC = Date.UTC(ty, tm - 1, td);
  const refUTC = Date.UTC(ry, rm - 1, rd);
  return Math.round((targetUTC - refUTC) / (1000 * 60 * 60 * 24));
}

export function addDaysISO(baseDate: string, days: number): string {
  const [y, m, d] = baseDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDueStatus(
  dueDate: string | null | undefined,
  status: TaskStatus,
  refDate: string = getTodayISO()
): DueStatus {
  if (status === 'done') return 'completed';
  if (!dueDate || !dueDate.trim()) return 'none';
  const diff = diffDaysISO(dueDate, refDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'due_today';
  if (diff <= 3) return 'due_soon';
  return 'upcoming';
}

export function getDueBucket(
  dueDate: string | null | undefined,
  refDate: string = getTodayISO()
): DueBucket {
  if (!dueDate || !dueDate.trim()) return 'nodate';
  const diff = diffDaysISO(dueDate, refDate);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'next3days';
  return 'upcoming';
}

export function getDateForBucket(
  bucket: DueBucket,
  refDate: string = getTodayISO()
): string | null {
  switch (bucket) {
    case 'overdue':
      return addDaysISO(refDate, -1);
    case 'today':
      return refDate;
    case 'next3days':
      return addDaysISO(refDate, 2);
    case 'upcoming':
      return addDaysISO(refDate, 7);
    case 'nodate':
      return null;
  }
}

export function formatDueLabel(
  dueDate: string | null | undefined,
  refDate: string = getTodayISO()
): string {
  if (!dueDate || !dueDate.trim()) return '未设截止日';
  const diff = diffDaysISO(dueDate, refDate);
  if (diff === 0) return '今天到期';
  if (diff === 1) return '明天到期';
  if (diff === 2) return '后天到期';
  if (diff > 2 && diff <= 7) return `${diff} 天后 (${dueDate.slice(5)})`;
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
  return dueDate;
}
