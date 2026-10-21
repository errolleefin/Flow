import React from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Flame,
  FolderKanban,
  Timer,
  Users,
} from 'lucide-react';
import type { Member, Project, Task } from '../../types';
import { formatDueLabel, getDueStatus } from '../../utils/dateUtils';
import { useI18n } from '../../i18n/I18nContext';
import { PRIORITY_CONFIG } from '../TaskCard';

interface AnalyticsViewProps {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  onSelectTask: (task: Task) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  projects,
  members,
  onSelectTask,
}) => {
  const { lang, tr } = useI18n();
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const overdueTasks = tasks.filter(
    (t) => getDueStatus(t.due_date, t.status) === 'overdue'
  );
  const dueTodayTasks = tasks.filter(
    (t) => getDueStatus(t.due_date, t.status) === 'due_today'
  );

  const completionRate =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalEstimateHours = tasks.reduce(
    (acc, t) => acc + (Number(t.estimate_hours) || 0),
    0
  );
  const totalLoggedHours =
    Math.round(
      (tasks.reduce((acc, t) => acc + (Number(t.logged_minutes) || 0), 0) /
        60) *
        10
    ) / 10;

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Urgent & Overdue Attention List
  const attentionTasks = tasks
    .filter(
      (t) =>
        t.status !== 'done' &&
        (t.priority === 'urgent' ||
          getDueStatus(t.due_date, t.status) === 'overdue' ||
          getDueStatus(t.due_date, t.status) === 'due_today')
    )
    .slice(0, 8);

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr('全局任务交付率', 'Overall Delivery Rate')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {completionRate}%
            </span>
            <span className="text-xs text-slate-400">
              {tr(
                `已完成 ${doneTasks} / 共 ${totalTasks} 项`,
                `${doneTasks} done / ${totalTasks} total`
              )}
            </span>
          </div>
          <div className="mt-3 w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr('死线预警与今日到期', 'Overdue & Due Today')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold text-rose-500">
                {overdueTasks.length}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                {tr('已逾期', 'Overdue')}
              </span>
            </div>
            <div className="text-slate-300 dark:text-slate-700">|</div>
            <div>
              <span className="text-2xl font-bold text-amber-500">
                {dueTodayTasks.length}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                {tr('今日到期', 'Due Today')}
              </span>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400">
            {tr(
              `进行中核心任务共 ${inProgressTasks} 项`,
              `${inProgressTasks} active tasks in progress`
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr('专注工时投入 vs 预估', 'Focus Hours vs. Estimated')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalLoggedHours}h
            </span>
            <span className="text-xs text-slate-400">
              {tr(
                `/ 预估总计 ${totalEstimateHours}h`,
                `/ ${totalEstimateHours}h estimated`
              )}
            </span>
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400">
            {tr(
              '通过番茄钟与工时记录自动汇总',
              'Aggregated from Pomodoro & time logs'
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {tr('活跃项目与团队规模', 'Active Projects & Team Size')}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {projects.length}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                {tr('个项目', 'Projects')}
              </span>
            </div>
            <div className="text-slate-300 dark:text-slate-700">|</div>
            <div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white">
                {members.length}
              </span>
              <span className="text-xs text-slate-400 ml-1">
                {tr('位相关人员', 'Members')}
              </span>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400">
            {tr(
              '跨职能多人员协作实时联动',
              'Cross-functional collaboration synced in real time'
            )}
          </p>
        </div>
      </div>

      {/* Middle 2-Column Charts: Project Health & Member Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Project Progress Breakdown */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tr(
                  '各项目交付健康度与进度对比',
                  'Project Delivery Health & Progress'
                )}
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {tr('按项目名维度聚合', 'Grouped by project')}
            </span>
          </div>

          <div className="space-y-4">
            {projects.map((proj) => {
              const pTasks = tasks.filter((t) => t.project_id === proj.id);
              const pDone = pTasks.filter((t) => t.status === 'done').length;
              const pActive = pTasks.filter(
                (t) => t.status === 'in_progress' || t.status === 'review'
              ).length;
              const pOverdue = pTasks.filter(
                (t) => getDueStatus(t.due_date, t.status) === 'overdue'
              ).length;
              const pct =
                pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;

              return (
                <div key={proj.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: proj.color }}
                      />
                      <span>{proj.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                        {proj.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {pOverdue > 0 && (
                        <span className="text-rose-500 font-semibold">
                          {tr(`${pOverdue} 逾期`, `${pOverdue} Overdue`)}
                        </span>
                      )}
                      <span>
                        {tr(`推进中 ${pActive}`, `${pActive} Active`)}
                      </span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {pct}% ({pDone}/{pTasks.length})
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: proj.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Team Member Workload & Collaboration */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {tr(
                  '相关人员工作负载与协同排行',
                  'Team Workload & Collaboration Ranking'
                )}
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {tr('主负责工时 + 协同参与数', 'Assigned hours + collaborations')}
            </span>
          </div>

          <div className="space-y-3.5">
            {members.map((mem) => {
              const assignedActive = tasks.filter(
                (t) => t.assignee_id === mem.id && t.status !== 'done'
              );
              const assignedDone = tasks.filter(
                (t) => t.assignee_id === mem.id && t.status === 'done'
              ).length;
              const collabCount = tasks.filter(
                (t) =>
                  t.collaborator_ids.includes(mem.id) &&
                  t.assignee_id !== mem.id
              ).length;

              const activeHours = assignedActive.reduce(
                (acc, t) => acc + (Number(t.estimate_hours) || 0),
                0
              );
              const cap = mem.capacity_hours || 40;
              const pct = Math.round((activeHours / cap) * 100);

              return (
                <div key={mem.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${mem.avatar_bg} text-white text-[10px] font-bold flex items-center justify-center`}
                      >
                        {mem.name.slice(0, 1)}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {mem.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {mem.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                      <span>
                        {tr(`协同 ${collabCount} 项`, `${collabCount} Collab`)}
                      </span>
                      <span>
                        {tr(
                          `已交付 ${assignedDone} 项`,
                          `${assignedDone} Done`
                        )}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          pct > 100
                            ? 'text-rose-500'
                            : pct >= 70
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {activeHours}h / {cap}h ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct > 100
                          ? 'bg-rose-500'
                          : pct >= 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom High-Priority & Deadline Radar Table */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {tr(
                '高优与近期死线重点关注任务雷达',
                'High-Priority & Immediate Deadline Radar'
              )}
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {tr(
              '点击任意行可直接打开任务详情抽屉编辑',
              'Click any row to open the task detail drawer'
            )}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                <th className="py-2.5 px-3">{tr('编号', 'Key')}</th>
                <th className="py-2.5 px-3">{tr('任务名称', 'Task Title')}</th>
                <th className="py-2.5 px-3">{tr('所属项目', 'Project')}</th>
                <th className="py-2.5 px-3">
                  {tr(
                    '相关人员 (负责人 / 协作人)',
                    'Personnel (Assignee / Collaborators)'
                  )}
                </th>
                <th className="py-2.5 px-3">{tr('优先级', 'Priority')}</th>
                <th className="py-2.5 px-3">{tr('截止日期', 'Due Date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {attentionTasks.map((t) => {
                const proj = projectMap.get(t.project_id);
                const assignee = t.assignee_id
                  ? memberMap.get(t.assignee_id)
                  : null;
                const collabs = t.collaborator_ids
                  .map((cid) => memberMap.get(cid))
                  .filter(Boolean);
                const pConf = PRIORITY_CONFIG[t.priority];
                const dStatus = getDueStatus(t.due_date, t.status);

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {t.task_key}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100">
                      {t.title}
                    </td>
                    <td className="py-2.5 px-3">
                      {proj && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
                          style={{
                            backgroundColor: `${proj.color}18`,
                            color: proj.color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: proj.color }}
                          />
                          {proj.name}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {assignee ? (
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {assignee.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            {tr('未指派', 'Unassigned')}
                          </span>
                        )}
                        {collabs.length > 0 && (
                          <span className="text-[11px] text-slate-400">
                            + {tr('协同:', 'Collab:')}{' '}
                            {collabs.map((c) => c?.name).join(', ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${pConf.badgeClass}`}
                      >
                        {tr(pConf.label, pConf.labelEn)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-medium ${
                          dStatus === 'overdue'
                            ? 'text-rose-500 font-bold'
                            : dStatus === 'due_today'
                            ? 'text-amber-500 font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {formatDueLabel(t.due_date, undefined, lang)} (
                        {t.due_date || '-'})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
