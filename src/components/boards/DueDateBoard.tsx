import React, { useState } from 'react';
import {
  AlertOctagon,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Kanban,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { DueBucket, Member, Project, Task } from '../../types';
import {
  getDateForBucket,
  getDueBucket,
  getTodayISO,
} from '../../utils/dateUtils';
import { TaskCard } from '../TaskCard';

interface DueDateBoardProps {
  tasks: Task[];
  projects: Project[];
  members: Member[];
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onSelectTask: (task: Task) => void;
  onQuickCreate: (defaults: Partial<Task>) => void;
  onStartPomodoro: (task: Task) => void;
}

const DUE_COLUMNS: Array<{
  id: DueBucket;
  label: string;
  subtitle: string;
  badgeClass: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    id: 'overdue',
    label: '🚨 已逾期 Overdue',
    subtitle: '已超过截止日期，需立即处理',
    badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    icon: AlertOctagon,
  },
  {
    id: 'today',
    label: '🔥 今日到期 Today',
    subtitle: '今日死线聚焦冲刺',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    icon: Flame,
  },
  {
    id: 'next3days',
    label: '⚡ 未来 3 天内 Next 3 Days',
    subtitle: '近期即将到期的关键任务',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    icon: Clock,
  },
  {
    id: 'upcoming',
    label: '📅 远期规划 Upcoming',
    subtitle: '3 天以后到期的排期事项',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    icon: CalendarDays,
  },
  {
    id: 'nodate',
    label: '⏳ 未设截止日 No Date',
    subtitle: '尚未锁定具体死线的任务',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
    icon: Sparkles,
  },
];

export const DueDateBoard: React.FC<DueDateBoardProps> = ({
  tasks,
  projects,
  members,
  onUpdateTask,
  onSelectTask,
  onQuickCreate,
  onStartPomodoro,
}) => {
  const [subMode, setSubMode] = useState<'kanban' | 'calendar'>('kanban');
  const [hideCompleted, setHideCompleted] = useState<boolean>(false);
  const [dragOverBucket, setDragOverBucket] = useState<DueBucket | null>(null);

  const todayISO = getTodayISO();
  const [calYear, setCalYear] = useState<number>(() =>
    Number(todayISO.split('-')[0])
  );
  const [calMonth, setCalMonth] = useState<number>(() =>
    Number(todayISO.split('-')[1])
  );

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const visibleTasks = hideCompleted
    ? tasks.filter((t) => t.status !== 'done')
    : tasks;

  const handleDropBucket = (
    e: React.DragEvent<HTMLDivElement>,
    bucket: DueBucket
  ) => {
    e.preventDefault();
    setDragOverBucket(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    const targetDate = getDateForBucket(bucket, todayISO);
    onUpdateTask(taskId, { due_date: targetDate });
  };

  // Calendar grid calculation
  const renderCalendarView = () => {
    const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, iso: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(calMonth).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, iso: `${calYear}-${mStr}-${dStr}` });
    }

    const changeMonth = (delta: number) => {
      const dt = new Date(calYear, calMonth - 1 + delta, 1);
      setCalYear(dt.getFullYear());
      setCalMonth(dt.getMonth() + 1);
    };

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    return (
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E1420] shadow-sm overflow-hidden">
          {/* Calendar Top Bar */}
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {calYear} 年 {calMonth} 月 · 任务截止日期排期月历
              </h3>
              <span className="text-xs text-slate-400">
                点击任意日期格「+」可直接创建该日截止的任务
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const [y, m] = todayISO.split('-').map(Number);
                  setCalYear(y);
                  setCalMonth(m);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                回到今天
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
            {weekDays.map((w) => (
              <div
                key={w}
                className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
              >
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-[minmax(125px,auto)] divide-x divide-y divide-slate-200 dark:divide-slate-800/80">
            {cells.map((cell, idx) => {
              if (!cell.day || !cell.iso) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="bg-slate-50/40 dark:bg-slate-950/30 p-2"
                  />
                );
              }
              const dayTasks = visibleTasks.filter(
                (t) => t.due_date === cell.iso
              );
              const isToday = cell.iso === todayISO;

              return (
                <div
                  key={cell.iso}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId && cell.iso) {
                      onUpdateTask(taskId, { due_date: cell.iso });
                    }
                  }}
                  className={`group p-2 flex flex-col justify-between transition-colors ${
                    isToday
                      ? 'bg-indigo-500/5 dark:bg-indigo-500/10'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <div>
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
                          isToday
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cell.day}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickCreate({ due_date: cell.iso })}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-indigo-500/15 text-indigo-500 transition-opacity"
                        title={`新建 ${cell.iso} 截止的任务`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Day Task Pills */}
                    <div className="space-y-1">
                      {dayTasks.map((t) => {
                        const proj = projectMap.get(t.project_id);
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData('text/plain', t.id)
                            }
                            onClick={() => onSelectTask(t)}
                            className={`px-2 py-1 rounded-md text-[11px] border cursor-pointer truncate flex items-center gap-1.5 transition-all ${
                              t.status === 'done'
                                ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 line-through border-transparent'
                                : 'bg-white dark:bg-[#151D2C] text-slate-800 dark:text-slate-100 border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-500'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: proj?.color || '#6366f1',
                              }}
                            />
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">
                              {t.task_key}
                            </span>
                            <span className="truncate">{t.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-mode Switcher Bar */}
      <div className="px-6 pt-3 pb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl p-1 bg-slate-200/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSubMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                subMode === 'kanban'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              死线时间分列看板
            </button>
            <button
              type="button"
              onClick={() => setSubMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                subMode === 'calendar'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              月度排期日历视图
            </button>
          </div>
          <span className="text-slate-400 dark:text-slate-500 hidden md:inline">
            · 跨列或跨日期格拖拽卡片，自动同步更新任务的截止日期
          </span>
        </div>

        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-0"
          />
          <span>隐藏已完成任务</span>
        </label>
      </div>

      {subMode === 'calendar' ? (
        renderCalendarView()
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-3">
          <div className="flex h-full gap-4 min-w-max">
            {DUE_COLUMNS.map((col) => {
              const colTasks = visibleTasks.filter(
                (t) => getDueBucket(t.due_date, todayISO) === col.id
              );
              const isOver = dragOverBucket === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverBucket !== col.id) setDragOverBucket(col.id);
                  }}
                  onDragLeave={() => setDragOverBucket(null)}
                  onDrop={(e) => handleDropBucket(e, col.id)}
                  className={`w-80 flex flex-col h-full rounded-2xl border transition-all ${
                    isOver
                      ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#0E1420]/90'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-bold ${col.badgeClass}`}
                        >
                          {col.label}
                        </span>
                        <span className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {colTasks.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {col.subtitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onQuickCreate({
                          due_date: getDateForBucket(col.id, todayISO),
                        })
                      }
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title="在此时间段新建任务"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    {colTasks.length === 0 ? (
                      <div className="h-32 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600 text-xs p-4 text-center">
                        拖拽卡片至此自动重设截止日
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
      )}
    </div>
  );
};
