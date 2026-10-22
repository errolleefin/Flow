export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export type BoardViewType = 'status' | 'project' | 'member' | 'duedate' | 'analytics';

export type DueBucket = 'overdue' | 'today' | 'next3days' | 'upcoming' | 'nodate';

export type DueStatus = 'completed' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'none';

export type AccountRole = 'admin' | 'boss' | 'director' | 'lead' | 'member';

export interface UserPermissions {
  visible_project_ids: 'all' | string[];
  can_create_project: boolean;
  can_edit_project: boolean;
  can_delete_project: boolean;
  can_create_task: boolean;
  can_edit_task: boolean;
  can_delete_task: boolean;
  can_manage_members: boolean;
  can_manage_accounts: boolean;
}

export interface UserAccount {
  id: string;
  username: string;
  display_name: string;
  role: AccountRole;
  member_id: string | null;
  permissions: UserPermissions;
  created_at: string;
}

export interface AuthStatusPayload {
  initialized: boolean;
  currentUser: UserAccount | null;
  user?: UserAccount | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string;
  pinned?: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  avatar_bg: string;
  email: string;
  capacity_hours: number;
  pinned?: boolean;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  task_id: string;
  member_id: string | null;
  actor_name?: string | null;
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

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  project_id: string | null;
  member_ids: string[];
  created_by: string | null;
  created_at: string;
  message_count?: number;
  last_message_at?: string | null;
  last_message_id?: string | null;
  last_message_sender_member_id?: string | null;
  last_message_sender?: string | null;
  last_message_content?: string | null;
}

export interface ChatGroupMessage {
  id: string;
  group_id: string;
  sender_user_id: string | null;
  sender_member_id: string | null;
  sender_name: string;
  sender_role: string;
  avatar_bg: string;
  content: string;
  created_at: string;
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
  chatGroups?: ChatGroup[];
  currentUser?: UserAccount | null;
}

export interface AiSettings {
  id?: number;
  base_url: string;
  api_key: string;
  has_api_key?: boolean;
  api_key_masked?: string;
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
