import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from './api/client';
import { AIAssistantDrawer } from './components/AIAssistantDrawer';
import { CommandPalette } from './components/CommandPalette';
import { CreateTaskModal, type ModalMode } from './components/CreateTaskModal';
import { PomodoroWidget } from './components/PomodoroWidget';
import { Sidebar } from './components/Sidebar';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { TopHeader } from './components/TopHeader';
import { AnalyticsView } from './components/boards/AnalyticsView';
import { DueDateBoard } from './components/boards/DueDateBoard';
import { MemberBoard } from './components/boards/MemberBoard';
import { ProjectBoard } from './components/boards/ProjectBoard';
import { StatusBoard } from './components/boards/StatusBoard';
import type {
  BoardViewType,
  FilterState,
  Member,
  Project,
  Task,
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '加载本地 SQLite 数据失败',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  // Global Keyboard Shortcuts: Ctrl/Cmd+K, N, Esc
  useEffect(() => {
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
        else if (modalMode) setModalMode(null);
        else if (selectedTaskId) setSelectedTaskId(null);
        return;
      }

      if (!isInput && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setQuickCreateDefaults({});
        setModalMode('task');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandOpen, modalMode, selectedTaskId]);

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
        showToast(`已同步更新 [${updated.task_key}]`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : '更新任务失败',
          'error'
        );
        loadBootstrap();
      }
    },
    [loadBootstrap, showToast]
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
      showToast(`已创建任务 [${created.task_key}] ${created.title}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '创建任务失败', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiClient.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      showToast('任务已删除');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error');
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
      showToast(err instanceof Error ? err.message : '添加子任务失败', 'error');
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
      showToast(err instanceof Error ? err.message : '更新子任务失败', 'error');
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
      showToast(err instanceof Error ? err.message : '删除子任务失败', 'error');
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
      showToast('已发表协作评论');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '发表评论失败', 'error');
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
      showToast(`已新建项目「${proj.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '新建项目失败', 'error');
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
      showToast(`已更新项目「${updated.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新项目失败', 'error');
    }
  };

  const handleDeleteProject = async (project: Project) => {
    const taskCount = tasks.filter((t) => t.project_id === project.id).length;
    const msg =
      taskCount > 0
        ? `确定要删除项目「${project.name}」吗？该项目下的 ${taskCount} 项关联任务也将一并删除。`
        : `确定要删除项目「${project.name}」吗？`;
    if (!window.confirm(msg)) return;
    try {
      await apiClient.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setTasks((prev) => prev.filter((t) => t.project_id !== project.id));
      if (filters.projectId === project.id) {
        setFilters((prev) => ({ ...prev, projectId: 'all' }));
      }
      showToast(`已删除项目「${project.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除项目失败', 'error');
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
      showToast(`已添加团队成员「${mem.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '添加成员失败', 'error');
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
      showToast(`已更新成员「${updated.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新成员失败', 'error');
    }
  };

  const handleDeleteMember = async (member: Member) => {
    if (
      !window.confirm(
        `确定要移除成员「${member.name}」吗？（其关联的任务不会被删除，将自动转为未指派）`
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
      showToast(`已移除成员「${member.name}」`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除成员失败', 'error');
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
    showToast('已导出 JSON 完整备份');
  };

  const handleExportCSV = () => {
    const projMap = new Map(projects.map((p) => [p.id, p.name]));
    const memMap = new Map(members.map((m) => [m.id, m.name]));
    const headers = [
      '任务编号',
      '任务名称',
      '所属项目',
      '状态',
      '优先级',
      '截止日期',
      '主负责人',
      '协同相关人员',
      '预估工时(h)',
      '已投入分钟',
    ];
    const rows = tasks.map((t) => [
      t.task_key,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${projMap.get(t.project_id) || ''}"`,
      t.status,
      t.priority,
      t.due_date || '未排期',
      memMap.get(t.assignee_id || '') || '未指派',
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
    showToast('已导出 CSV 表格报表');
  };

  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = await apiClient.importBackup(parsed);
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      showToast('已从备份成功恢复全部数据');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '导入 JSON 备份失败',
        'error'
      );
    }
  };

  const handleResetDemoData = async () => {
    if (!window.confirm('确定要清空当前工作区的所有项目、人员与任务数据吗？（AI 接口配置将保留）')) {
      return;
    }
    try {
      const data = await apiClient.resetDemoData();
      setProjects(data.projects);
      setMembers(data.members);
      setTasks(data.tasks);
      setFilters(INITIAL_FILTERS);
      showToast('已清空工作区所有数据');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '清空失败', 'error');
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        projects={projects}
        members={members}
        tasks={tasks}
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
        onOpenNewMember={() => {
          setEditingMember(null);
          setModalMode('member');
        }}
        onEditMember={(mem) => {
          setEditingMember(mem);
          setModalMode('member');
        }}
        onDeleteMember={handleDeleteMember}
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
          onExportJSON={handleExportJSON}
          onExportCSV={handleExportCSV}
          onImportJSON={handleImportJSON}
          onResetDemoData={handleResetDemoData}
        />

        {/* Board Viewport */}
        <main className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              正在从本地 SQLite 数据库加载多维看板...
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
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onOpenNewProject={() => {
                    setEditingProject(null);
                    setModalMode('project');
                  }}
                  onEditProject={(proj) => {
                    setEditingProject(proj);
                    setModalMode('project');
                  }}
                  onDeleteProject={handleDeleteProject}
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
                    setQuickCreateDefaults(defaults);
                    setModalMode('task');
                  }}
                  onOpenNewMember={() => {
                    setEditingMember(null);
                    setModalMode('member');
                  }}
                  onEditMember={(mem) => {
                    setEditingMember(mem);
                    setModalMode('member');
                  }}
                  onDeleteMember={handleDeleteMember}
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
        }}
        onSelectTaskById={(taskId) => {
          setAiDrawerOpen(false);
          setSelectedTaskId(taskId);
        }}
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
