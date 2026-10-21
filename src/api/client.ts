import type {
  Activity,
  AiChatMessage,
  AiSettings,
  BootstrapPayload,
  Member,
  Project,
  Subtask,
  Task,
} from '../types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
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

  createProject: (payload: { name: string; code?: string; color: string; description?: string }) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (
    projectId: string,
    patch: Partial<{ name: string; code: string; color: string; description: string }>
  ) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

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

  resetDemoData: () =>
    request<BootstrapPayload>('/api/seed/reset', {
      method: 'POST',
    }),

  importBackup: (payload: BootstrapPayload) =>
    request<BootstrapPayload>('/api/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

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
