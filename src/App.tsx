import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, setAuthToken } from './api/client';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { AccountManagementModal } from './components/AccountManagementModal';
import { AuthScreen } from './components/AuthScreen';
import { CommandPalette } from './components/CommandPalette';
import { CreateTaskModal, type ModalMode } from './components/CreateTaskModal';
import { PomodoroWidget } from './components/PomodoroWidget';
import { ProjectChatDrawer } from './components/ProjectChatDrawer';
import { Sidebar } from './components/Sidebar';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { TopHeader } from './components/TopHeader';
import { AnalyticsView } from './components/boards/AnalyticsView';
import { DueDateBoard } from './components/boards/DueDateBoard';
import { MemberBoard } from './components/boards/MemberBoard';
import { ProjectBoard } from './components/boards/ProjectBoard';
import { StatusBoard } from './components/boards/StatusBoard';
import { useI18n } from './i18n/I18nContext';
import type {
  BoardViewType,
  ChatGroup,
  FilterState,
  Member,
  Project,
  Task,
  UserAccount,
} from './types';
import { extractAllTags, filterTasks } from './utils/taskFilters';

const INITIAL_FILTERS: FilterState = {
  search: '',
  projectId: 'all',
  memberId: 'all',
  priority: 'all',
  tag: 'all',
  onlyOverdue: false,
  includeCollaborated: true,
};

export const App: React.FC = () => {
  const { tr } = useI18n();
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const [activeView, setActiveView] = useState<BoardViewType>('status');
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('flow-theme');
    return saved ? saved === 'dark' : true;
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [quickCreateDefaults, setQuickCreateDefaults] = useState<Partial<Task>>(
    {}
  );
  const [commandOpen, setCommandOpen] = useState<boolean>(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState<boolean>(false);
  const [chatDrawerOpen, setChatDrawerOpen] = useState<boolean>(false);
  const [activeChatGroupId, setActiveChatGroupId] = useState<string | null>(
    null
  );
  const [accountModalOpen, setAccountModalOpen] = useState<boolean>(false);
  const [pomodoroTask, setPomodoroTask] = useState<Task | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      window.setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 2800);
    },
    []
  );

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('flow-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('flow-theme', 'light');
    }
  }, [darkMode]);

  // Initial Bootstrap Load
  const loadBootstrap = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBootstrap();
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      if (data.chatGroups) {
        setChatGroups(data.chatGroups);
      }
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('加载本地 SQLite 数据失败', 'Failed to load SQLite data'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast, tr]);

  // Check Auth Status on Mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setAuthChecking(true);
        const status = await apiClient.getAuthStatus();
        if (!mounted) return;
        setAuthInitialized(status.initialized);
        const user = status.currentUser || status.user || null;
        setCurrentUser(user);
        if (status.initialized && user) {
          await loadBootstrap();
        }
      } catch {
        // Fallback if auth endpoint unreachable
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loadBootstrap]);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch {
      setAuthToken(null);
    }
    setCurrentUser(null);
    setSelectedTaskId(null);
    setAccountModalOpen(false);
    setChatDrawerOpen(false);
  };

  // Global Keyboard Shortcuts: Ctrl/Cmd+K, N, Esc
  useEffect(() => {
    if (!currentUser) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAiDrawerOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (commandOpen) setCommandOpen(false);
        else if (aiDrawerOpen) setAiDrawerOpen(false);
        else if (chatDrawerOpen) setChatDrawerOpen(false);
        else if (accountModalOpen) setAccountModalOpen(false);
        else if (modalMode) {
          setModalMode(null);
          setEditingProject(null);
          setEditingMember(null);
        } else if (selectedTaskId) setSelectedTaskId(null);
        return;
      }

      if (
        !isInput &&
        (e.key === 'n' || e.key === 'N') &&
        currentUser.permissions.can_create_task
      ) {
        e.preventDefault();
        setQuickCreateDefaults({});
        setModalMode('task');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandOpen,
    aiDrawerOpen,
    chatDrawerOpen,
    accountModalOpen,
    modalMode,
    selectedTaskId,
    currentUser,
  ]);

  const filteredTasks = useMemo(
    () => filterTasks(tasks, filters),
    [tasks, filters]
  );

  const allTags = useMemo(() => extractAllTags(tasks), [tasks]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  // Optimistic task update
  const handleUpdateTask = useCallback(
    async (taskId: string, patch: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
      );
      try {
        const updated = await apiClient.updateTask(taskId, patch);
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updated : t))
        );
        showToast(
          tr(`已同步更新 [${updated.task_key}]`, `Updated [${updated.task_key}]`)
        );
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : tr('更新任务失败', 'Failed to update task'),
          'error'
        );
        loadBootstrap();
      }
    },
    [loadBootstrap, showToast, tr]
  );

  const handleCreateTask = async (
    payload: Omit<Partial<Task>, 'subtasks'> & {
      title: string;
      project_id: string;
      project_name?: string;
      subtasks?: string[];
    }
  ) => {
    try {
      const created = await apiClient.createTask(payload);
      if (
        projects.length === 0 ||
        !projects.some((p) => p.id === created.project_id)
      ) {
        await loadBootstrap();
      } else {
        setTasks((prev) => [created, ...prev]);
      }
      showToast(
        tr(
          `已创建任务 [${created.task_key}] ${created.title}`,
          `Created task [${created.task_key}] ${created.title}`
        )
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('创建任务失败', 'Failed to create task'),
        'error'
      );
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      showToast(tr('任务已删除', 'Task deleted'));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : tr('删除失败', 'Delete failed'),
        'error'
      );
    }
  };

  const handleAddSubtask = async (taskId: string, title: string) => {
    try {
      const sub = await apiClient.addSubtask(taskId, title);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, subtasks: [...t.subtasks, sub] } : t
        )
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('添加子任务失败', 'Failed to add subtask'),
        'error'
      );
    }
  };

  const handleToggleSubtask = async (subId: string, completed: boolean) => {
    try {
      const updatedSub = await apiClient.updateSubtask(subId, { completed });
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          subtasks: t.subtasks.map((s) => (s.id === subId ? updatedSub : s)),
        }))
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('更新子任务失败', 'Failed to update subtask'),
        'error'
      );
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    try {
      await apiClient.deleteSubtask(subId);
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          subtasks: t.subtasks.filter((s) => s.id !== subId),
        }))
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('删除子任务失败', 'Failed to delete subtask'),
        'error'
      );
    }
  };

  const handleAddComment = async (
    taskId: string,
    memberId: string | null,
    content: string
  ) => {
    try {
      const comment = await apiClient.addComment(taskId, memberId, content);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, activities: [comment, ...t.activities] }
            : t
        )
      );
      showToast(tr('已发表协作评论', 'Comment posted'));
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('发表评论失败', 'Failed to post comment'),
        'error'
      );
    }
  };

  const handleCreateProject = async (payload: {
    name: string;
    code: string;
    color: string;
    description: string;
  }) => {
    try {
      const proj = await apiClient.createProject(payload);
      setProjects((prev) => [...prev, proj]);
      showToast(
        tr(`已新建项目「${proj.name}」`, `Created project "${proj.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('新建项目失败', 'Failed to create project'),
        'error'
      );
    }
  };

  const handleUpdateProject = async (
    id: string,
    payload: {
      name: string;
      code: string;
      color: string;
      description: string;
    }
  ) => {
    try {
      const updated = await apiClient.updateProject(id, payload);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
      showToast(
        tr(`已更新项目「${updated.name}」`, `Updated project "${updated.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('更新项目失败', 'Failed to update project'),
        'error'
      );
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const taskCount = tasks.filter((t) => t.project_id === project.id).length;
    const msg =
      taskCount > 0
        ? tr(
            `确定要删除项目「${project.name}」吗？该项目下的 ${taskCount} 项关联任务也将一并删除。`,
            `Delete project "${project.name}"? Its ${taskCount} associated task(s) will also be deleted.`
          )
        : tr(
            `确定要删除项目「${project.name}」吗？`,
            `Delete project "${project.name}"?`
          );
    if (!window.confirm(msg)) return;
    try {
      await apiClient.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setTasks((prev) => prev.filter((t) => t.project_id !== project.id));
      if (filters.projectId === project.id) {
        setFilters((prev) => ({ ...prev, projectId: 'all' }));
      }
      showToast(
        tr(`已删除项目「${project.name}」`, `Deleted project "${project.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('删除项目失败', 'Failed to delete project'),
        'error'
      );
    }
  };

  const handleCreateMember = async (payload: {
    name: string;
    role: string;
    avatar_bg: string;
    capacity_hours: number;
  }) => {
    try {
      const mem = await apiClient.createMember(payload);
      setMembers((prev) => [...prev, mem]);
      showToast(
        tr(`已添加团队成员「${mem.name}」`, `Added member "${mem.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('添加成员失败', 'Failed to add member'),
        'error'
      );
    }
  };

  const handleUpdateMember = async (
    id: string,
    payload: {
      name: string;
      role: string;
      avatar_bg: string;
      capacity_hours: number;
    }
  ) => {
    try {
      const updated = await apiClient.updateMember(id, payload);
      setMembers((prev) => prev.map((m) => (m.id === id ? updated : m)));
      showToast(
        tr(`已更新成员「${updated.name}」`, `Updated member "${updated.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('更新成员失败', 'Failed to update member'),
        'error'
      );
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (
      !window.confirm(
        tr(
          `确定要移除成员「${member.name}」吗？（其关联的任务不会被删除，将自动转为未指派）`,
          `Remove member "${member.name}"? (Their tasks will not be deleted and will become unassigned)`
        )
      )
    ) {
      return;
    }
    try {
      await apiClient.deleteMember(member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          assignee_id: t.assignee_id === member.id ? null : t.assignee_id,
          collaborator_ids: t.collaborator_ids.filter((id) => id !== member.id),
        }))
      );
      if (filters.memberId === member.id) {
        setFilters((prev) => ({ ...prev, memberId: 'all' }));
      }
      showToast(
        tr(`已移除成员「${member.name}」`, `Removed member "${member.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('删除成员失败', 'Failed to remove member'),
        'error'
      );
    }
  };

  const handleTogglePinProject = async (project: Project) => {
    const nextPinned = !project.pinned;
    setProjects((prev) =>
      prev.map((p) => (p.id === project.id ? { ...p, pinned: nextPinned } : p))
    );
    try {
      const updated = await apiClient.updateProject(project.id, {
        pinned: nextPinned,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? updated : p))
      );
      showToast(
        nextPinned
          ? tr(`已置顶项目「${project.name}」`, `Pinned project "${project.name}"`)
          : tr(`已取消置顶「${project.name}」`, `Unpinned "${project.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('置顶状态更新失败', 'Failed to update pin status'),
        'error'
      );
      loadBootstrap();
    }
  };

  const handleTogglePinMember = async (member: Member) => {
    const nextPinned = !member.pinned;
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, pinned: nextPinned } : m))
    );
    try {
      const updated = await apiClient.updateMember(member.id, {
        pinned: nextPinned,
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? updated : m))
      );
      showToast(
        nextPinned
          ? tr(`已置顶成员「${member.name}」`, `Pinned member "${member.name}"`)
          : tr(`已取消置顶「${member.name}」`, `Unpinned "${member.name}"`)
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('置顶状态更新失败', 'Failed to update pin status'),
        'error'
      );
      loadBootstrap();
    }
  };

  // Export & Import Handlers
  const handleExportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ projects, members, tasks }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(tr('已导出 JSON 完整备份', 'Exported full JSON backup'));
  };

  const handleExportCSV = () => {
    const projMap = new Map(projects.map((p) => [p.id, p.name]));
    const memMap = new Map(members.map((m) => [m.id, m.name]));
    const headers = [
      tr('任务编号', 'Key'),
      tr('任务名称', 'Title'),
      tr('所属项目', 'Project'),
      tr('状态', 'Status'),
      tr('优先级', 'Priority'),
      tr('截止日期', 'Due Date'),
      tr('主负责人', 'Assignee'),
      tr('协同相关人员', 'Collaborators'),
      tr('预估工时(h)', 'Est. Hours'),
      tr('已投入分钟', 'Logged Mins'),
    ];
    const rows = tasks.map((t) => [
      t.task_key,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${projMap.get(t.project_id) || ''}"`,
      t.status,
      t.priority,
      t.due_date || tr('未排期', 'Unscheduled'),
      memMap.get(t.assignee_id || '') || tr('未指派', 'Unassigned'),
      `"${t.collaborator_ids
        .map((id) => memMap.get(id))
        .filter(Boolean)
        .join(' / ')}"`,
      t.estimate_hours,
      t.logged_minutes,
    ]);
    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(tr('已导出 CSV 表格报表', 'Exported CSV report'));
  };

  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = await apiClient.importBackup(parsed);
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      showToast(
        tr('已从备份成功恢复全部数据', 'Restored all data from JSON backup')
      );
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : tr('导入 JSON 备份失败', 'Failed to import JSON backup'),
        'error'
      );
    }
  };

  const handleResetDemoData = async () => {
    if (
      !window.confirm(
        tr(
          '确定要清空当前工作区的所有项目、人员与任务数据吗？（AI 接口配置将保留）',
          'Are you sure you want to clear all projects, members, and tasks in this workspace? (AI endpoint settings will be preserved)'
        )
      )
    ) {
      return;
    }
    try {
      const data = await apiClient.resetDemoData();
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      setFilters(INITIAL_FILTERS);
      showToast(tr('已清空工作区所有数据', 'Cleared all workspace data'));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : tr('清空失败', 'Failed to clear'),
        'error'
      );
    }
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-slate-400 text-xs">
        {tr('正在验证身份与权限体系...', 'Verifying identity & RBAC permissions...')}
      </div>
    );
  }

  if (!authInitialized || !currentUser) {
    return (
      <AuthScreen
        initialized={authInitialized}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onAuthenticated={async (user) => {
          setAuthInitialized(true);
          setCurrentUser(user);
          await loadBootstrap();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        projects={projects}
        members={members}
        tasks={tasks}
        currentUser={currentUser}
        filters={filters}
        onUpdateFilter={(patch) =>
          setFilters((prev) => ({ ...prev, ...patch }))
        }
        onOpenNewProject={() => {
          setEditingProject(null);
          setModalMode('project');
        }}
        onEditProject={(proj) => {
          setEditingProject(proj);
          setModalMode('project');
        }}
        onDeleteProject={handleDeleteProject}
        onTogglePinProject={handleTogglePinProject}
        onOpenNewMember={() => {
          setEditingMember(null);
          setModalMode('member');
        }}
        onEditMember={(mem) => {
          setEditingMember(mem);
          setModalMode('member');
        }}
        onDeleteMember={handleDeleteMember}
        onTogglePinMember={handleTogglePinMember}
        onOpenAccountModal={() => setAccountModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopHeader
          activeView={activeView}
          filters={filters}
          projects={projects}
          members={members}
          allTags={allTags}
          totalFilteredCount={filteredTasks.length}
          totalTaskCount={tasks.length}
          chatGroupCount={chatGroups.length}
          canCreateTask={currentUser.permissions.can_create_task}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((prev) => !prev)}
          onUpdateFilter={(patch) =>
            setFilters((prev) => ({ ...prev, ...patch }))
          }
          onResetFilters={() => setFilters(INITIAL_FILTERS)}
          onOpenCreateTask={() => {
            setQuickCreateDefaults({});
            setModalMode('task');
          }}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenAiAssistant={() => setAiDrawerOpen(true)}
          onOpenChatDrawer={() => {
            setActiveChatGroupId(null);
            setChatDrawerOpen(true);
          }}
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onImportJSON={handleImportJSON}
          onResetDemoData={handleResetDemoData}
        />

        {/* Board Viewport */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              {tr(
                '正在从本地 SQLite 数据库加载多维看板...',
                'Loading multi-board workspace from SQLite...'
              )}
            </div>
          ) : (
            <>
              {activeView === 'status' && (
                <StatusBoard
                  tasks={filteredTasks}
                  projects={projects}
                  members={members}
                  onUpdateTask={handleUpdateTask}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onQuickCreate={(defaults) => {
                    if (!currentUser.permissions.can_create_task) {
                      showToast(
                        tr('当前账号无新建任务权限', 'No permission to create tasks'),
                        'error'
                      );
                      return;
                    }
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onStartPomodoro={(t) => setPomodoroTask(t)}
                />
              )}

              {activeView === 'project' && (
                <ProjectBoard
                  tasks={filteredTasks}
                  projects={projects}
                  members={members}
                  onUpdateTask={handleUpdateTask}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onQuickCreate={(defaults) => {
                    if (!currentUser.permissions.can_create_task) {
                      showToast(
                        tr('当前账号无新建任务权限', 'No permission to create tasks'),
                        'error'
                      );
                      return;
                    }
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onOpenNewProject={() => {
                    if (!currentUser.permissions.can_create_project) {
                      showToast(
                        tr('当前账号无新建项目权限', 'No permission to create projects'),
                        'error'
                      );
                      return;
                    }
                    setEditingProject(null);
                    setModalMode('project');
                  }}
                  onEditProject={(proj) => {
                    if (!currentUser.permissions.can_edit_project) {
                      showToast(
                        tr('当前账号无编辑项目权限', 'No permission to edit projects'),
                        'error'
                      );
                      return;
                    }
                    setEditingProject(proj);
                    setModalMode('project');
                  }}
                  onDeleteProject={(proj) => {
                    if (!currentUser.permissions.can_delete_project) {
                      showToast(
                        tr('当前账号无删除项目权限', 'No permission to delete projects'),
                        'error'
                      );
                      return;
                    }
                    handleDeleteProject(proj);
                  }}
                  onStartPomodoro={(t) => setPomodoroTask(t)}
                />
              )}

              {activeView === 'member' && (
                <MemberBoard
                  tasks={filteredTasks}
                  projects={projects}
                  members={members}
                  onUpdateTask={handleUpdateTask}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onQuickCreate={(defaults) => {
                    if (!currentUser.permissions.can_create_task) {
                      showToast(
                        tr('当前账号无新建任务权限', 'No permission to create tasks'),
                        'error'
                      );
                      return;
                    }
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onOpenNewMember={() => {
                    if (!currentUser.permissions.can_manage_members) {
                      showToast(
                        tr('当前账号无管理人员权限', 'No permission to manage members'),
                        'error'
                      );
                      return;
                    }
                    setEditingMember(null);
                    setModalMode('member');
                  }}
                  onEditMember={(mem) => {
                    if (!currentUser.permissions.can_manage_members) {
                      showToast(
                        tr('当前账号无管理人员权限', 'No permission to manage members'),
                        'error'
                      );
                      return;
                    }
                    setEditingMember(mem);
                    setModalMode('member');
                  }}
                  onDeleteMember={(mem) => {
                    if (!currentUser.permissions.can_manage_members) {
                      showToast(
                        tr('当前账号无管理人员权限', 'No permission to manage members'),
                        'error'
                      );
                      return;
                    }
                    handleDeleteMember(mem);
                  }}
                  onStartPomodoro={(t) => setPomodoroTask(t)}
                />
              )}

              {activeView === 'duedate' && (
                <DueDateBoard
                  tasks={filteredTasks}
                  projects={projects}
                  members={members}
                  onUpdateTask={handleUpdateTask}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                  onQuickCreate={(defaults) => {
                    if (!currentUser.permissions.can_create_task) {
                      showToast(
                        tr('当前账号无新建任务权限', 'No permission to create tasks'),
                        'error'
                      );
                      return;
                    }
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onStartPomodoro={(t) => setPomodoroTask(t)}
                />
              )}

              {activeView === 'analytics' && (
                <AnalyticsView
                  tasks={filteredTasks}
                  projects={projects}
                  members={members}
                  onSelectTask={(t) => setSelectedTaskId(t.id)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Right Slide-Over Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        projects={projects}
        members={members}
        currentUserMemberId={currentUser.member_id}
        canEditTask={currentUser.permissions.can_edit_task}
        canDeleteTask={currentUser.permissions.can_delete_task}
        onClose={() => setSelectedTaskId(null)}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onAddSubtask={handleAddSubtask}
        onToggleSubtask={handleToggleSubtask}
        onDeleteSubtask={handleDeleteSubtask}
        onAddComment={handleAddComment}
        onStartPomodoro={(t) => setPomodoroTask(t)}
      />

      {/* Create / Edit Task / Project / Member Modal */}
      <CreateTaskModal
        mode={modalMode}
        defaults={quickCreateDefaults}
        editingProject={editingProject}
        editingMember={editingMember}
        projects={projects}
        members={members}
        onClose={() => {
          setModalMode(null);
          setEditingProject(null);
          setEditingMember(null);
        }}
        onCreateTask={handleCreateTask}
        onCreateProject={handleCreateProject}
        onUpdateProject={handleUpdateProject}
        onDeleteProject={handleDeleteProject}
        onCreateMember={handleCreateMember}
        onUpdateMember={handleUpdateMember}
        onDeleteMember={handleDeleteMember}
      />

      {/* Global Command Palette (Ctrl/Cmd + K) */}
      <CommandPalette
        isOpen={commandOpen}
        tasks={tasks}
        projects={projects}
        darkMode={darkMode}
        onClose={() => setCommandOpen(false)}
        onSelectView={setActiveView}
        onSelectTask={(t) => setSelectedTaskId(t.id)}
        onOpenCreateTask={() => {
          setQuickCreateDefaults({});
          setModalMode('task');
        }}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
      />

      {/* AI Assistant Drawer (OpenAI Compatible + Permanent SQLite Config + Auto DB Ingestion) */}
      <AIAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onSyncBootstrap={(data) => {
          setProjects(data.projects);
          setMembers(data.members);
          setTasks(data.tasks);
          if (data.chatGroups) setChatGroups(data.chatGroups);
        }}
        onSelectTaskById={(taskId) => {
          setAiDrawerOpen(false);
          setSelectedTaskId(taskId);
        }}
        onShowToast={showToast}
      />

      {/* Custom Project Communication Group Chat Drawer */}
      <ProjectChatDrawer
        isOpen={chatDrawerOpen}
        initialGroupId={activeChatGroupId}
        activeProjectId={filters.projectId}
        currentUser={currentUser}
        projects={projects}
        members={members}
        tasks={tasks}
        chatGroups={chatGroups}
        onClose={() => setChatDrawerOpen(false)}
        onSyncGroups={(groups) => setChatGroups(groups)}
        onSelectTask={(task) => {
          setChatDrawerOpen(false);
          setSelectedTaskId(task.id);
        }}
        onShowToast={showToast}
      />

      {/* Account & 5-Tier RBAC Management Modal */}
      <AccountManagementModal
        isOpen={accountModalOpen}
        currentUser={currentUser}
        projects={projects}
        members={members}
        onClose={() => setAccountModalOpen(false)}
        onRefreshBootstrap={loadBootstrap}
        onUpdateCurrentUser={(user) => setCurrentUser(user)}
        onShowToast={showToast}
      />

      {/* Floating Pomodoro Timer */}
      <PomodoroWidget
        activeTask={pomodoroTask}
        onClose={() => setPomodoroTask(null)}
        onLogMinutes={(taskId, mins) => {
          const target = tasks.find((t) => t.id === taskId);
          if (target) {
            handleUpdateTask(taskId, {
              logged_minutes: (target.logged_minutes || 0) + mins,
            });
          }
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-900 dark:bg-indigo-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
