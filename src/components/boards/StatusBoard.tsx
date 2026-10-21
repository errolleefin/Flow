import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock,
  PlayCircle,
  Plus,
} from 'lucide-react';
import type { Member, Project, Task, TaskStatus } from '../../types';
import { TaskCard } from '../TaskCard';

interface StatusBoardProps {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (defaults: Partial<Task>) => void;
  onStartPomodoro: (task: Task) => void;
}

export const STATUS_COLUMNS: Array<{
  id: TaskStatus;
  label: string;
  accentColor: string;
  headerBg: string;
  description: string;
}> = [
  {
    id: 'backlog',
    label: '待规划 Backlog',
    accentColor: '#64748b',
    headerBg: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
    description: '需求池与待排期想法',
  },
  {
    id: 'todo',
    label: '待处理 Todo',
    accentColor: '#6366f1',
    headerBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    description: '已明确排期、待启动',
  },
  {
    id: 'in_progress',
    label: '进行中 In Progress',
    accentColor: '#3b82f6',
    headerBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    description: '正在核心推进的任务',
  },
  {
    id: 'review',
    label: '审核/阻塞 In Review',
    accentColor: '#f59e0b',
    headerBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    description: '代码评审、验收或外部阻塞',
  },
  {
    id: 'done',
    label: '已完成 Done',
    accentColor: '#10b981',
    headerBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    description: '已闭环交付归档',
  },
];

export const StatusBoard: React.FC<StatusBoardProps> = ({
  tasks,
  projects,
  members,
  onUpdateTask,
  onSelectTask,
  onQuickCreate,
  onStartPomodoro,
}) => {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status) {
      onUpdateTask(taskId, { status });
    }
  };

  const renderStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'backlog':
        return <CircleDashed className="w-4 h-4 text-slate-400" />;
      case 'todo':
        return <CircleDot className="w-4 h-4 text-indigo-500" />;
      case 'in_progress':
        return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'review':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden px-6 py-4">
      <div className="flex h-full gap-4 min-w-max">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const totalHours = colTasks.reduce(
            (acc, t) => acc + (Number(t.estimate_hours) || 0),
            0
          );
          const isOver = dragOverCol === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverCol !== col.id) setDragOverCol(col.id);
              }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-80 flex flex-col h-full rounded-2xl border transition-all ${
                isOver
                  ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                  : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#0E1420]/90'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderStatusIcon(col.id)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {col.label}
                      </h3>
                      <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                        {colTasks.length}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {col.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500"
                    title="本列预估总工时"
                  >
                    <Clock className="w-3 h-3" />
                    {totalHours}h
                  </span>
                  <button
                    type="button"
                    onClick={() => onQuickCreate({ status: col.id })}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    title={`在「${col.label}」下新建任务`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colTasks.length === 0 ? (
                  <div className="h-36 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-xs p-4 text-center">
                    <span>拖拽卡片至此列自动更新状态</span>
                    <button
                      type="button"
                      onClick={() => onQuickCreate({ status: col.id })}
                      className="mt-2 text-indigo-500 hover:underline text-[11px] font-medium"
                    >
                      + 添加首条任务
                    </button>
                  </div>
                ) : (
                  colTasks.map((task) => (
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
      </div>
    </div>
  );
};
