import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Member, Project, Task } from '../../types';
import { getDueStatus } from '../../utils/dateUtils';
import { TaskCard } from '../TaskCard';

interface ProjectBoardProps {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (defaults: Partial<Task>) => void;
  onOpenNewProject: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onStartPomodoro: (task: Task) => void;
}

export const ProjectBoard: React.FC<ProjectBoardProps> = ({
  tasks,
  projects,
  members,
  onUpdateTask,
  onSelectTask,
  onQuickCreate,
  onOpenNewProject,
  onEditProject,
  onDeleteProject,
  onStartPomodoro,
}) => {
  const [dragOverProj, setDragOverProj] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, projectId: string) => {
    e.preventDefault();
    setDragOverProj(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.project_id !== projectId) {
      onUpdateTask(taskId, { project_id: projectId });
    }
  };

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden px-6 py-4">
      <div className="flex h-full gap-4 min-w-max">
        {projects.map((proj) => {
          const projTasks = tasks.filter((t) => t.project_id === proj.id);
          const doneCount = projTasks.filter((t) => t.status === 'done').length;
          const overdueCount = projTasks.filter(
            (t) => getDueStatus(t.due_date, t.status) === 'overdue'
          ).length;
          const progressPct =
            projTasks.length > 0
              ? Math.round((doneCount / projTasks.length) * 100)
              : 0;
          const isOver = dragOverProj === proj.id;

          return (
            <div
              key={proj.id}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverProj !== proj.id) setDragOverProj(proj.id);
              }}
              onDragLeave={() => setDragOverProj(null)}
              onDrop={(e) => handleDrop(e, proj.id)}
              className={`w-84 flex flex-col h-full rounded-2xl border transition-all ${
                isOver
                  ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                  : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#0E1420]/90'
              }`}
              style={{ width: '330px' }}
            >
              {/* Top Color Accent Strip */}
              <div
                className="h-1.5 rounded-t-2xl"
                style={{ backgroundColor: proj.color }}
              />

              {/* Project Column Header */}
              <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                        style={{
                          backgroundColor: `${proj.color}20`,
                          color: proj.color,
                        }}
                      >
                        {proj.code}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {proj.name}
                      </h3>
                    </div>
                    {proj.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                        {proj.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditProject(proj)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title={`编辑项目「${proj.name}」`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title={`删除项目「${proj.name}」`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickCreate({ project_id: proj.id })}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title={`在「${proj.name}」下新建任务`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Project Progress & Health Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      完成进度 {doneCount}/{projTasks.length} ({progressPct}%)
                    </span>
                    {overdueCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        {overdueCount} 逾期
                      </span>
                    )}
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progressPct}%`,
                        backgroundColor: proj.color,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Project Tasks List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {projTasks.length === 0 ? (
                  <div className="h-36 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-xs p-4 text-center">
                    <span>将任意卡片拖入此列即可归属至该项目</span>
                    <button
                      type="button"
                      onClick={() => onQuickCreate({ project_id: proj.id })}
                      className="mt-2 text-indigo-500 hover:underline text-[11px] font-medium"
                    >
                      + 新建该项目任务
                    </button>
                  </div>
                ) : (
                  projTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      project={proj}
                      members={members}
                      hideProjectBadge
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

        {/* Add New Project Column Card */}
        <button
          type="button"
          onClick={onOpenNewProject}
          className="w-64 h-40 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 dark:hover:border-indigo-500/60 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition-colors bg-white/40 dark:bg-slate-900/30"
        >
          <FolderPlus className="w-6 h-6" />
          <span className="text-xs font-semibold">+ 新建项目看板列</span>
        </button>
      </div>
    </div>
  );
};
