import React from 'react';
import {
  BarChart3,
  CalendarClock,
  FolderKanban,
  Kanban,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
} from 'lucide-react';
import type { BoardViewType, FilterState, Member, Project, Task } from '../types';
import { getDueStatus } from '../utils/dateUtils';
import { FlowLogo } from './FlowLogo';

interface SidebarProps {
  activeView: BoardViewType;
  onSelectView: (view: BoardViewType) => void;
  projects: Project[];
  members: Member[];
  tasks: Task[];
  filters: FilterState;
  onUpdateFilter: (patch: Partial<FilterState>) => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onOpenNewMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
}

export const BOARD_VIEWS: Array<{
  id: BoardViewType;
  label: string;
  shortDesc: string;
  icon: React.FC<{ className?: string }>;
  badgeColor: string;
}> = [
  {
    id: 'status',
    label: '状态流转看板',
    shortDesc: '敏捷工作流阶段推进',
    icon: Kanban,
    badgeColor: 'text-indigo-500',
  },
  {
    id: 'project',
    label: '项目维度看板',
    shortDesc: '按项目归属与进度聚合',
    icon: FolderKanban,
    badgeColor: 'text-emerald-500',
  },
  {
    id: 'member',
    label: '人员负载看板',
    shortDesc: '按相关人员与工时水位',
    icon: Users,
    badgeColor: 'text-amber-500',
  },
  {
    id: 'duedate',
    label: '截止日期与日历',
    shortDesc: '死线预警看板 + 月历视图',
    icon: CalendarClock,
    badgeColor: 'text-rose-500',
  },
  {
    id: 'analytics',
    label: '全局效能仪表盘',
    shortDesc: '多维统计图表与风险雷达',
    icon: BarChart3,
    badgeColor: 'text-cyan-500',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  projects,
  members,
  tasks,
  filters,
  onUpdateFilter,
  onOpenNewProject,
  onEditProject,
  onDeleteProject,
  onOpenNewMember,
  onEditMember,
  onDeleteMember,
}) => {
  const overdueCount = tasks.filter(
    (t) => getDueStatus(t.due_date, t.status) === 'overdue'
  ).length;

  return (
    <aside className="w-64 shrink-0 h-screen border-r border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0E131F] flex flex-col select-none">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FlowLogo className="w-8 h-8 shrink-0 shadow-md shadow-indigo-500/20 rounded-xl" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                Flow
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              多维协同 Todo 与看板中枢
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6">
        {/* 1. Five Board Views */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              多维看板视图 (5)
            </span>
          </div>
          <nav className="space-y-1">
            {BOARD_VIEWS.map((view) => {
              const Icon = view.icon;
              const isActive = activeView === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => onSelectView(view.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : view.badgeColor
                      }`}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold leading-tight">
                        {view.label}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive
                            ? 'text-indigo-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {view.shortDesc}
                      </div>
                    </div>
                  </div>
                  {view.id === 'duedate' && overdueCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}
                      title={`${overdueCount} 项任务已逾期`}
                    >
                      {overdueCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quick Overdue Alert Filter */}
        {overdueCount > 0 && (
          <div className="px-1">
            <button
              type="button"
              onClick={() =>
                onUpdateFilter({ onlyOverdue: !filters.onlyOverdue })
              }
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                filters.onlyOverdue
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/20'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                逾期死线预警
              </span>
              <span className="font-mono font-bold">{overdueCount} 项</span>
            </button>
          </div>
        )}

        {/* 2. Projects Section */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              项目列表 ({projects.length})
            </span>
            <button
              type="button"
              onClick={onOpenNewProject}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="新建项目"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onUpdateFilter({ projectId: 'all' })}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                filters.projectId === 'all'
                  ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                全部项目
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {tasks.length}
              </span>
            </button>

            {projects.map((proj) => {
              const count = tasks.filter((t) => t.project_id === proj.id).length;
              const doneCount = tasks.filter(
                (t) => t.project_id === proj.id && t.status === 'done'
              ).length;
              const isSelected = filters.projectId === proj.id;

              return (
                <div
                  key={proj.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateFilter({
                        projectId: isSelected ? 'all' : proj.id,
                      })
                    }
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="truncate">{proj.name}</span>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <span className="font-mono text-[10px] text-slate-400 group-hover:hidden">
                      {doneCount}/{count}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditProject(proj);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        title="编辑项目"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(proj);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        title="删除项目"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Team Personnel Section */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              相关人员 ({members.length})
            </span>
            <button
              type="button"
              onClick={onOpenNewMember}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="新增团队成员"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {members.map((mem) => {
              const activeCount = tasks.filter(
                (t) =>
                  t.status !== 'done' &&
                  (t.assignee_id === mem.id ||
                    t.collaborator_ids.includes(mem.id))
              ).length;
              const isSelected = filters.memberId === mem.id;

              return (
                <div
                  key={mem.id}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateFilter({
                        memberId: isSelected ? 'all' : mem.id,
                      })
                    }
                    className="flex-1 flex items-center gap-2 min-w-0 text-left"
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-gradient-to-br ${mem.avatar_bg} text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                    >
                      {mem.name.slice(0, 1)}
                    </span>
                    <div className="truncate text-left">
                      <span className="truncate block leading-tight">
                        {mem.name}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block">
                        {mem.role}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0 ml-1">
                    <span
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-500 group-hover:hidden"
                      title="进行中关联任务数"
                    >
                      {activeCount}
                    </span>
                    <div className="hidden group-hover:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMember(mem);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        title="编辑成员"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMember(mem);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        title="删除成员"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Shortcut Hint */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#0B0F17]/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span>快捷键导航</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
            Ctrl+K
          </kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
            N
          </kbd>
        </div>
      </div>
    </aside>
  );
};
