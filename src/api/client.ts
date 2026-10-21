import type {
  AccountRole,
  Activity,
  AiChatMessage,
  AiSettings,
  AuthStatusPayload,
  BootstrapPayload,
  ChatGroup,
  ChatGroupMessage,
  Member,
  Project,
  Subtask,
  Task,
  UserAccount,
  UserPermissions,
} from '../types';

const AUTH_TOKEN_KEY = 'flow-auth-token';

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let errMsg = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) errMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const apiClient = {
  // Auth & User Management
  getAuthStatus: () => request<AuthStatusPayload>('/api/auth/status'),

  setupSuperAdmin: (payload: {
    username: string;
    display_name: string;
    password: string;
    create_member?: boolean;
  }) =>
    request<{ token: string; user: UserAccount }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { username: string; password: string }) =>
    request<{ token: string; user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getUsers: () => request<{ users: UserAccount[] }>('/api/users'),

  createUser: (payload: {
    username: string;
    display_name: string;
    password: string;
    role: AccountRole;
    member_id: string | null;
    auto_create_member?: boolean;
    permissions: UserPermissions;
  }) =>
    request<UserAccount>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateUser: (
    userId: string,
    patch: Partial<{
      username: string;
      display_name: string;
      password: string;
      role: AccountRole;
      member_id: string | null;
      permissions: UserPermissions;
    }>
  ) =>
    request<UserAccount>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteUser: (userId: string) =>
    request<{ ok: boolean }>(`/api/users/${userId}`, {
      method: 'DELETE',
    }),

  // Bootstrap & Tasks
  getBootstrap: () => request<BootstrapPayload>('/api/bootstrap'),

  createTask: (
    payload: Omit<Partial<Task>, 'subtasks'> & {
      title: string;
      project_id: string;
      project_name?: string;
      subtasks?: string[];
    }
  ) =>
    request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTask: (taskId: string, patch: Partial<Task>) =>
    request<Task>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteTask: (taskId: string) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  addSubtask: (taskId: string, title: string) =>
    request<Subtask>(`/api/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  updateSubtask: (subId: string, patch: { completed?: boolean; title?: string }) =>
    request<Subtask>(`/api/subtasks/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteSubtask: (subId: string) =>
    request<{ ok: boolean }>(`/api/subtasks/${subId}`, {
      method: 'DELETE',
    }),

  addComment: (taskId: string, member_id: string | null, content: string) =>
    request<Activity>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ member_id, content }),
    }),

  // Projects
  createProject: (payload: {
    name: string;
    code?: string;
    color: string;
    description?: string;
  }) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (
    projectId: string,
    patch: Partial<{
      name: string;
      code: string;
      color: string;
      description: string;
      pinned: boolean;
    }>
  ) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

  // Members
  createMember: (payload: {
    name: string;
    role: string;
    avatar_bg: string;
    email?: string;
    capacity_hours?: number;
  }) =>
    request<Member>('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMember: (
    memberId: string,
    patch: Partial<{
      name: string;
      role: string;
      avatar_bg: string;
      email: string;
      capacity_hours: number;
      pinned: boolean;
    }>
  ) =>
    request<Member>(`/api/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteMember: (memberId: string) =>
    request<{ ok: boolean }>(`/api/members/${memberId}`, {
      method: 'DELETE',
    }),

  // Custom Project Communication Group Chats
  getChatGroups: () => request<{ groups: ChatGroup[] }>('/api/chat-groups'),

  createChatGroup: (payload: {
    name: string;
    description?: string;
    project_id?: string | null;
    member_ids?: string[];
  }) =>
    request<ChatGroup>('/api/chat-groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateChatGroup: (
    groupId: string,
    patch: Partial<{
      name: string;
      description: string;
      project_id: string | null;
      member_ids: string[];
    }>
  ) =>
    request<ChatGroup>(`/api/chat-groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteChatGroup: (groupId: string) =>
    request<{ ok: boolean }>(`/api/chat-groups/${groupId}`, {
      method: 'DELETE',
    }),

  getChatGroupMessages: (groupId: string) =>
    request<{ messages: ChatGroupMessage[] }>(
      `/api/chat-groups/${groupId}/messages`
    ),

  sendChatGroupMessage: (
    groupId: string,
    payload: {
      content: string;
      sender_member_id?: string | null;
      sender_name?: string;
    }
  ) =>
    request<ChatGroupMessage>(`/api/chat-groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteChatGroupMessage: (groupId: string, msgId: string) =>
    request<{ ok: boolean }>(`/api/chat-groups/${groupId}/messages/${msgId}`, {
      method: 'DELETE',
    }),

  // Backup & Reset
  resetDemoData: () =>
    request<BootstrapPayload>('/api/seed/reset', {
      method: 'POST',
    }),

  importBackup: (payload: BootstrapPayload) =>
    request<BootstrapPayload>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // AI Assistant
  getAiSettings: () => request<AiSettings>('/api/ai/settings'),

  updateAiSettings: (patch: Partial<AiSettings>) =>
    request<AiSettings>('/api/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  fetchAiModels: (base_url: string, api_key: string) =>
    request<{ models: string[] }>('/api/ai/models', {
      method: 'POST',
      body: JSON.stringify({ base_url, api_key }),
    }),

  getAiMessages: () => request<{ messages: AiChatMessage[] }>('/api/ai/messages'),

  clearAiMessages: () =>
    request<{ messages: AiChatMessage[] }>('/api/ai/messages', {
      method: 'DELETE',
    }),

  sendAiChat: (message: string) =>
    request<{
      assistantMessage: AiChatMessage;
      messages: AiChatMessage[];
      bootstrap: BootstrapPayload;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
