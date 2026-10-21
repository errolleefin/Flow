import type { FilterState, Task } from '../types/index.ts';
import { getDueStatus, getTodayISO } from './dateUtils.ts';

export function filterTasks(
  tasks: Task[],
  filters: FilterState,
  refDate: string = getTodayISO()
): Task[] {
  const q = filters.search.trim().toLowerCase();

  return tasks.filter((t) => {
    if (filters.projectId !== 'all' && t.project_id !== filters.projectId) {
      return false;
    }

    if (filters.memberId !== 'all') {
      const isAssignee = t.assignee_id === filters.memberId;
      const isCollab = filters.includeCollaborated && t.collaborator_ids.includes(filters.memberId);
      if (!isAssignee && !isCollab) {
        return false;
      }
    }

    if (filters.priority !== 'all' && t.priority !== filters.priority) {
      return false;
    }

    if (filters.tag !== 'all' && !t.tags.includes(filters.tag)) {
      return false;
    }

    if (filters.onlyOverdue) {
      const dueStatus = getDueStatus(t.due_date, t.status, refDate);
      if (dueStatus !== 'overdue') {
        return false;
      }
    }

    if (q) {
      const hay = `${t.task_key} ${t.title} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function extractAllTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const t of tasks) {
    for (const tag of t.tags) {
      if (tag && tag.trim()) {
        set.add(tag.trim());
      }
    }
  }
  return Array.from(set);
}
