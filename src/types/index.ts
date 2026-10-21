export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type BoardViewType = 'status' | 'project' | 'member' | 'duedate' | 'analytics';

export type DueBucket = 'overdue' | 'today' | 'next3days' | 'upcoming' | 'nodate';

export type DueStatus = 'completed' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'none';

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar_bg: string;
  email: string;
  capacity_hours: number;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  task_id: string;
  member_id: string | null;
  type: 'comment' | 'system';
  content: string;
  created_at: string;
}

export interface Task {
  id: string;
  task_key: string;
  title: string;
  description: string;
  project_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: string | null;
  collaborator_ids: string[];
  tags: string[];
  estimate_hours: number;
  logged_minutes: number;
  position: number;
  created_at: string;
  updated_at: string;
  subtasks: Subtask[];
  activities: Activity[];
}

export interface FilterState {
  search: string;
  projectId: string | 'all';
  memberId: string | 'all';
  priority: TaskPriority | 'all';
  tag: string | 'all';
  onlyOverdue: boolean;
  includeCollaborated: boolean;
}

export interface BootstrapPayload {
  projects: Project[];
  members: Member[];
  tasks: Task[];
}

export interface AiSettings {
  id?: number;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
  updated_at?: string;
}

export interface AiOperationReceipt {
  kind:
    | 'task_created'
    | 'task_updated'
    | 'task_deleted'
    | 'project_created'
    | 'member_created';
  id: string;
  task_key?: string;
  title: string;
  project_name?: string;
  assignee_name?: string;
  due_date?: string;
  subtask_count?: number;
  summary: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  operations: AiOperationReceipt[];
  created_at: string;
}

