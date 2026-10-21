import React from 'react';
import {
  BarChart3,
  CalendarClock,
  FolderKanban,
  Hash,
  Kanban,
  Layers,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  AlertTriangle,
} from 'lucide-react';
import type {
  AccountRole,
  BoardViewType,
  ChatGroup,
  FilterState,
  Member,
  Project,
  Task,
  UserAccount,
} from '../types';
import { getDueStatus } from '../utils/dateUtils';
import { useI18n } from '../i18n/I18nContext';
import { FlowLogo } from './FlowLogo';

interface SidebarProps {
  activeView: BoardViewType;
  onSelectView: (view: BoardViewType) => void;
  projects: Project[];
  members: Member[];
  tasks: Task[];
  chatGroups: ChatGroup[];
  currentUser: UserAccount | null;
  filters: FilterState;
  onUpdateFilter: (patch: Partial<FilterState>) => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onOpenNewMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
  onOpenChatDrawer: (groupId?: string) => void;
  onOpenAccountModal: () => void;
  onLogout: () => void;
}

export const BOARD_VIEWS: Array<{
  id: BoardViewType;
  label: string;
  labelEn: string;
  shortDesc: string;
  shortDescEn: string;
  icon: React.FC<{ className?: string }>;
  badgeColor: string;
}> = [
  {
    id: 'status',
    label: '状态流转看板',
    labelEn: 'Status Kanban',
    shortDesc: '敏捷工作流阶段推进',
    shortDescEn: 'Agile workflow stage progression',
    icon: Kanban,
    badgeColor: 'text-indigo-500',
  },
  {
    id: 'project',
    label: '项目维度看板',
    labelEn: 'Project Board',
    shortDesc: '按项目归属与进度聚合',
    shortDescEn: 'Group by project & delivery progress',
    icon: FolderKanban,
    badgeColor: 'text-emerald-500',
  },
  {
    id: 'member',
    label: '人员负载看板',
    labelEn: 'Team Workload',
    shortDesc: '按相关人员与工时水位',
    shortDescEn: 'By assignee & weekly capacity load',
    icon: Users,
    badgeColor: 'text-amber-500',
  },
  {
    id: 'duedate',
    label: '截止日期与日历',
    labelEn: 'Due Date & Calendar',
    shortDesc: '死线预警看板 + 月历视图',
    shortDescEn: 'Deadline radar board + monthly calendar',
    icon: CalendarClock,
    badgeColor: 'text-rose-500',
  },
  {
    id: 'analytics',
    label: '全局效能仪表盘',
    labelEn: 'Analytics & Insights',
    shortDesc: '多维统计图表与风险雷达',
    shortDescEn: 'Multi-dimensional metrics & risk radar',
    icon: BarChart3,
    badgeColor: 'text-cyan-500',
  },
];

const ROLE_LABELS: Record<
  AccountRole,
  { zh: string; en: string; badge: string }
> = {
  admin: {
    zh: '管理员',
    en: 'Admin',
    badge: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  },
  boss: {
    zh: '老板',
    en: 'Boss',
    badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  },
  director: {
    zh: '项目主管',
    en: 'Director',
    badge: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  },
  lead: {
    zh: '组长',
    en: 'Team Lead',
    badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  },
  member: {
    zh: '成员',
    en: 'Member',
    badge: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  },
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  projects,
  members,
  tasks,
  chatGroups,
  currentUser,
  filters,
  onUpdateFilter,
  onOpenNewProject,
  onEditProject,
  onDeleteProject,
  onOpenNewMember,
  onEditMember,
  onDeleteMember,
  onOpenChatDrawer,
  onOpenAccountModal,
  onLogout,
}) => {
  const { tr } = useI18n();
  const overdueCount = tasks.filter(
    (t) => getDueStatus(t.due_date, t.status) === 'overdue'
  ).length;

  const canCreateProject =
    !currentUser || currentUser.permissions.can_create_project;
  const canEditProject =
    !currentUser || currentUser.permissions.can_edit_project;
  const canDeleteProject =
    !currentUser || currentUser.permissions.can_delete_project;
  const canManageMembers =
    !currentUser || currentUser.permissions.can_manage_members;
  const canManageAccounts =
    currentUser?.role === 'admin' ||
    Boolean(currentUser?.permissions.can_manage_accounts);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const boundMember = currentUser?.member_id
    ? members.find((m) => m.id === currentUser.member_id)
    : null;

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
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {tr('多维协同 Todo 与看板中枢', 'Multi-Board Work Todo & Kanban')}
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* 1. Five Board Views */}
        <div>
          <div className="px-2 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {tr('多维看板视图 (5)', 'Board Views (5)')}
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
                        {tr(view.label, view.labelEn)}
                      </div>
                      <div
                        className={`text-[10px] truncate ${
                          isActive
                            ? 'text-indigo-100'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {tr(view.shortDesc, view.shortDescEn)}
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
                      title={tr(
                        `${overdueCount} 项任务已逾期`,
                        `${overdueCount} overdue tasks`
                      )}
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
                {tr('逾期死线预警', 'Overdue Alerts')}
              </span>
              <span className="font-mono font-bold">
                {tr(`${overdueCount} 项`, `${overdueCount}`)}
              </span>
            </button>
          </div>
        )}

        {/* 2. Projects Section */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {tr(`项目列表 (${projects.length})`, `Projects (${projects.length})`)}
            </span>
            {canCreateProject && (
              <button
                type="button"
                onClick={onOpenNewProject}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={tr('新建项目', 'New Project')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
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
                {tr('全部项目', 'All Projects')}
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
                    <span
                      className={`font-mono text-[10px] text-slate-400 ${
                        canEditProject || canDeleteProject
                          ? 'group-hover:hidden'
                          : ''
                      }`}
                    >
                      {doneCount}/{count}
                    </span>
                    {(canEditProject || canDeleteProject) && (
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        {canEditProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditProject(proj);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            title={tr('编辑项目', 'Edit Project')}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {canDeleteProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(proj);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                            title={tr('删除项目', 'Delete Project')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Custom Project Communication Group Chats */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {tr(
                `项目沟通群聊 (${chatGroups.length})`,
                `Group Chats (${chatGroups.length})`
              )}
            </span>
            <button
              type="button"
              onClick={() => onOpenChatDrawer()}
              className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={tr('打开或新建项目沟通群聊', 'Open or create group chat')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {chatGroups.length === 0 ? (
              <button
                type="button"
                onClick={() => onOpenChatDrawer()}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">
                  {tr('+ 新建自定义项目沟通群', '+ Create project chat group')}
                </span>
              </button>
            ) : (
              chatGroups.map((group) => {
                const linkedProj = group.project_id
                  ? projectMap.get(group.project_id)
                  : null;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onOpenChatDrawer(group.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Hash className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate">{group.name}</span>
                      {linkedProj && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: linkedProj.color }}
                          title={linkedProj.name}
                        />
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {group.message_count || 0}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 4. Team Personnel Section */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {tr(`相关人员 (${members.length})`, `Team Members (${members.length})`)}
            </span>
            {canManageMembers && (
              <button
                type="button"
                onClick={onOpenNewMember}
                className="p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={tr('新增团队成员', 'New Team Member')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
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
                      className={`px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-500 ${
                        canManageMembers ? 'group-hover:hidden' : ''
                      }`}
                      title={tr('进行中关联任务数', 'Active related tasks')}
                    >
                      {activeCount}
                    </span>
                    {canManageMembers && (
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMember(mem);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title={tr('编辑成员', 'Edit Member')}
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
                          title={tr('删除成员', 'Delete Member')}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: Current User Account + Admin Account Management Menu + Shortcuts */}
      <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-2">
        {currentUser && (
          <div className="space-y-1.5">
            {canManageAccounts && (
              <button
                type="button"
                onClick={onOpenAccountModal}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {tr('账号与权限管理', 'Account & RBAC')}
                </span>
                <span className="text-[10px] font-mono opacity-80">RBAC</span>
              </button>
            )}

            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {currentUser.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {currentUser.display_name}
                    </span>
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] font-semibold border shrink-0 ${
                        ROLE_LABELS[currentUser.role]?.badge ||
                        ROLE_LABELS.member.badge
                      }`}
                    >
                      {tr(
                        ROLE_LABELS[currentUser.role]?.zh || '成员',
                        ROLE_LABELS[currentUser.role]?.en || 'Member'
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    @{currentUser.username}
                    {boundMember ? ` · ${boundMember.name}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                title={tr('退出当前账号', 'Sign out')}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
          <span>{tr('快捷键导航', 'Shortcuts')}</span>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
              Ctrl+K
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
              N
            </kbd>
          </div>
        </div>
      </div>
    </aside>
  );
};
