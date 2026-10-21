import React, { useState } from 'react';
import { Clock, Pencil, Plus, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import type { Member, Project, Task } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { TaskCard } from '../TaskCard';

interface MemberBoardProps {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (defaults: Partial<Task>) => void;
  onOpenNewMember: () => void;
  onEditMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
  onStartPomodoro: (task: Task) => void;
}

export const MemberBoard: React.FC<MemberBoardProps> = ({
  tasks,
  projects,
  members,
  onUpdateTask,
  onSelectTask,
  onQuickCreate,
  onOpenNewMember,
  onEditMember,
  onDeleteMember,
  onStartPomodoro,
}) => {
  const { tr } = useI18n();
  const [dragOverMember, setDragOverMember] = useState<string | null>(null);
  const [showCollaboratedInColumn, setShowCollaboratedInColumn] = useState<boolean>(false);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, assigneeId: string | null) => {
    e.preventDefault();
    setDragOverMember(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.assignee_id !== assigneeId) {
      onUpdateTask(taskId, { assignee_id: assigneeId });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-toolbar for Personnel Workload Board */}
      <div className="px-6 pt-3 pb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400">
            {tr(
              '💡 跨列拖拽卡片可直接改派主负责人；负载水位按成员未完成任务预估工时 / 周容量计算',
              '💡 Drag cards across columns to reassign the primary owner; saturation = active est. hours / weekly capacity'
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCollaboratedInColumn(!showCollaboratedInColumn)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
              showCollaboratedInColumn
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            {showCollaboratedInColumn
              ? tr(
                  '当前：展示主负责 + 协同参与任务',
                  'Showing: Primary + Collaborated Tasks'
                )
              : tr(
                  '当前：仅按主负责人归列（点击含协同任务）',
                  'Showing: Primary Assignee Only (Click to include collaborated)'
                )}
          </button>
        </div>
      </div>

      {/* Columns Viewport */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-3">
        <div className="flex h-full gap-4 min-w-max">
          {members.map((mem) => {
            const memTasks = tasks.filter((t) =>
              showCollaboratedInColumn
                ? t.assignee_id === mem.id || t.collaborator_ids.includes(mem.id)
                : t.assignee_id === mem.id
            );
            const activeTasks = tasks.filter(
              (t) => t.assignee_id === mem.id && t.status !== 'done'
            );
            const collabCount = tasks.filter(
              (t) =>
                t.collaborator_ids.includes(mem.id) &&
                t.assignee_id !== mem.id &&
                t.status !== 'done'
            ).length;

            const activeHours = activeTasks.reduce(
              (acc, t) => acc + (Number(t.estimate_hours) || 0),
              0
            );
            const capacity = mem.capacity_hours || 40;
            const loadPct = Math.round((activeHours / capacity) * 100);

            const loadStatus =
              loadPct > 100
                ? {
                    label: tr('超载预警', 'Overloaded'),
                    bar: 'bg-rose-500',
                    text: 'text-rose-500',
                  }
                : loadPct >= 70
                ? {
                    label: tr('负载饱满', 'Near Capacity'),
                    bar: 'bg-amber-500',
                    text: 'text-amber-500',
                  }
                : {
                    label: tr('余量充裕', 'Optimal'),
                    bar: 'bg-emerald-500',
                    text: 'text-emerald-500',
                  };

            const isOver = dragOverMember === mem.id;

            return (
              <div
                key={mem.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverMember !== mem.id) setDragOverMember(mem.id);
                }}
                onDragLeave={() => setDragOverMember(null)}
                onDrop={(e) => handleDrop(e, mem.id)}
                className={`w-80 flex flex-col h-full rounded-2xl border transition-all ${
                  isOver
                    ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#0E1420]/90'
                }`}
              >
                {/* Member Header */}
                <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${mem.avatar_bg} text-white text-xs font-bold flex items-center justify-center shadow-sm shrink-0`}
                      >
                        {mem.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {mem.name}
                          </h3>
                          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                            {memTasks.length}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                          {mem.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditMember(mem)}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        title={tr(
                          `编辑成员「${mem.name}」`,
                          `Edit member "${mem.name}"`
                        )}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMember(mem)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        title={tr(
                          `删除成员「${mem.name}」`,
                          `Delete member "${mem.name}"`
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onQuickCreate({ assignee_id: mem.id })}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        title={tr(
                          `指派新任务给 ${mem.name}`,
                          `Assign new task to ${mem.name}`
                        )}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Workload Saturation Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        {tr(
                          `在途工时 ${activeHours}h / ${capacity}h`,
                          `Active ${activeHours}h / ${capacity}h`
                        )}
                      </span>
                      <span className={`font-semibold ${loadStatus.text}`}>
                        {loadStatus.label} ({loadPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${loadStatus.bar}`}
                        style={{ width: `${Math.min(loadPct, 100)}%` }}
                      />
                    </div>
                    {collabCount > 0 && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {tr(
                          `另作为协同相关人员参与 ${collabCount} 项进行中任务`,
                          `Also collaborating on ${collabCount} active task(s)`
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Member Tasks */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {memTasks.length === 0 ? (
                    <div className="h-32 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-xs p-4 text-center">
                      <span>
                        {tr(
                          `拖拽任务卡片至此指派给 ${mem.name}`,
                          `Drag task cards here to assign to ${mem.name}`
                        )}
                      </span>
                    </div>
                  ) : (
                    memTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        project={projectMap.get(task.project_id)}
                        members={members}
                        onSelect={onSelectTask}
                        onToggleDone={(t) =>
                          onUpdateTask(t.id, {
                            status: t.status === 'done' ? 'todo' : 'done',
                          })
                        }
                        onStartPomodoro={onStartPomodoro}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Unassigned Column */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverMember !== 'unassigned') setDragOverMember('unassigned');
            }}
            onDragLeave={() => setDragOverMember(null)}
            onDrop={(e) => handleDrop(e, null)}
            className={`w-72 flex flex-col h-full rounded-2xl border transition-all ${
              dragOverMember === 'unassigned'
                ? 'border-indigo-500 bg-indigo-500/5'
                : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#0E1420]/60'
            }`}
          >
            <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {tr('待认领 / 未指派', 'Unassigned')}
                </h3>
              </div>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-800 text-slate-500">
                {tasks.filter((t) => !t.assignee_id).length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
              {tasks
                .filter((t) => !t.assignee_id)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={projectMap.get(task.project_id)}
                    members={members}
                    onSelect={onSelectTask}
                    onToggleDone={(t) =>
                      onUpdateTask(t.id, {
                        status: t.status === 'done' ? 'todo' : 'done',
                      })
                    }
                    onStartPomodoro={onStartPomodoro}
                  />
                ))}
            </div>
          </div>

          {/* Add New Member Card */}
          <button
            type="button"
            onClick={onOpenNewMember}
            className="w-60 h-40 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <UserPlus className="w-6 h-6" />
            <span className="text-xs font-semibold">
              {tr('+ 新增相关人员列', '+ New Member Column')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
