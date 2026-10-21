import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  ListChecks,
  MessageSquare,
  Play,
  Users,
} from 'lucide-react';
import type { Member, Project, Task, TaskPriority } from '../types';
import { formatDueLabel, getDueStatus } from '../utils/dateUtils';

interface TaskCardProps {
  task: Task;
  project?: Project;
  members: Member[];
  onSelect: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onStartPomodoro: (task: Task) => void;
  hideProjectBadge?: boolean;
}

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; badgeClass: string; dotColor: string }
> = {
  urgent: {
    label: '紧急',
    badgeClass:
      'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    dotColor: 'bg-rose-500',
  },
  high: {
    label: '高优',
    badgeClass:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dotColor: 'bg-amber-500',
  },
  medium: {
    label: '普通',
    badgeClass:
      'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    dotColor: 'bg-indigo-500',
  },
  low: {
    label: '较低',
    badgeClass:
      'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dotColor: 'bg-slate-400',
  },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  project,
  members,
  onSelect,
  onToggleDone,
  onStartPomodoro,
  hideProjectBadge = false,
}) => {
  const dueStatus = getDueStatus(task.due_date, task.status);
  const dueLabel = formatDueLabel(task.due_date);
  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  const assignee = members.find((m) => m.id === task.assignee_id);
  const collaborators = members.filter((m) =>
    task.collaborator_ids.includes(m.id) && m.id !== task.assignee_id
  );

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = task.subtasks.length;
  const subtaskPct =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const commentCount = task.activities.filter((a) => a.type === 'comment').length;

  const dueBadgeClasses: Record<typeof dueStatus, string> = {
    completed:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    overdue:
      'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35 animate-pulse-subtle font-semibold',
    due_today:
      'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/35 font-semibold',
    due_soon:
      'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    upcoming:
      'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    none: 'bg-slate-500/5 text-slate-400 dark:text-slate-500 border-slate-500/15',
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging-card');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('dragging-card');
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(task)}
      className="group relative rounded-xl border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#131924] hover:border-indigo-500/50 dark:hover:border-indigo-500/50 shadow-sm hover:shadow-md transition-all duration-150 p-3.5 cursor-grab active:cursor-grabbing select-none"
    >
      {/* Top Row: Task Key + Project Name + Priority Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {task.task_key}
          </span>
          {!hideProjectBadge && project && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium truncate max-w-[155px]"
              style={{
                backgroundColor: `${project.color}18`,
                color: project.color,
                border: `1px solid ${project.color}35`,
              }}
              title={`项目：${project.name}`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate">{project.name}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${priorityInfo.badgeClass}`}
          >
            {task.priority === 'urgent' ? (
              <Flame className="w-2.5 h-2.5 fill-current" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.dotColor}`} />
            )}
            {priorityInfo.label}
          </span>
        </div>
      </div>

      {/* Title Row with Quick Check Toggle */}
      <div className="flex items-start gap-2 mb-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone(task);
          }}
          className="mt-0.5 text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors shrink-0"
          title={task.status === 'done' ? '标记为未完成' : '快速标记完成'}
        >
          {task.status === 'done' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
        <h4
          className={`text-sm font-medium leading-snug line-clamp-2 ${
            task.status === 'done'
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300'
          } transition-colors`}
        >
          {task.title}
        </h4>
      </div>

      {/* Tags Row */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Subtask Progress Bar */}
      {totalSubtasks > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="w-3 h-3 text-indigo-500" />
              子任务进度
            </span>
            <span className="font-mono">
              {completedSubtasks}/{totalSubtasks} ({subtaskPct}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                subtaskPct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${subtaskPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer Row: Due Date + Related Personnel + Quick Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/70">
        {/* Due Date Badge */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border ${dueBadgeClasses[dueStatus]}`}
            title={task.due_date ? `截止日期：${task.due_date}` : '未设置截止日期'}
          >
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="truncate">{dueLabel}</span>
          </span>

          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-3 h-3" />
              {commentCount}
            </span>
          )}
        </div>

        {/* Personnel Avatars (Assignee + Collaborators) & Pomodoro Trigger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartPomodoro(task);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
            title="开启专注番茄钟计时"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          {task.estimate_hours > 0 && (
            <span
              className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500"
              title={`预估 ${task.estimate_hours}h / 已投入 ${Math.round(task.logged_minutes / 60 * 10) / 10}h`}
            >
              <Clock className="w-2.5 h-2.5" />
              {task.estimate_hours}h
            </span>
          )}

          {/* Avatar Stack */}
          <div className="flex items-center -space-x-1.5">
            {assignee ? (
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${assignee.avatar_bg} text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-[#131924] shadow-sm`}
                title={`主负责人：${assignee.name} (${assignee.role})`}
              >
                {assignee.name.slice(0, 1)}
              </div>
            ) : (
              <div
                className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] flex items-center justify-center ring-2 ring-white dark:ring-[#131924]"
                title="未指派主负责人"
              >
                <Users className="w-3 h-3" />
              </div>
            )}

            {collaborators.slice(0, 2).map((collab) => (
              <div
                key={collab.id}
                className={`w-5 h-5 rounded-full bg-gradient-to-br ${collab.avatar_bg} text-white text-[9px] font-medium flex items-center justify-center ring-2 ring-white dark:ring-[#131924] opacity-90`}
                title={`协作相关人员：${collab.name} (${collab.role})`}
              >
                {collab.name.slice(0, 1)}
              </div>
            ))}

            {collaborators.length > 2 && (
              <div
                className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-mono flex items-center justify-center ring-2 ring-white dark:ring-[#131924]"
                title={`还有 ${collaborators.length - 2} 位协作人员`}
              >
                +{collaborators.length - 2}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
